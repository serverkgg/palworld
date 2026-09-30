import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeNetError, BridgeUserError } from "@serverkgg/bridge";
import { palworldPost, REST_API_PORT, restCredentials, restFailure } from "./restApi";

describe("deciding how the panel reaches the palworld rest api", () => {
	test("uses the admin password and the port the settings declare", () => {
		expect(
			restCredentials({
				AdminPassword: "s3cret",
				RESTAPIPort: 8300,
			}),
		).toEqual({
			password: "s3cret",
			port: 8300,
		});
	});

	test("falls back to the default port when the settings do not name one", () => {
		expect(
			restCredentials({
				AdminPassword: "s3cret",
			}).port,
		).toBe(REST_API_PORT);
	});

	test("reads a port the ini codec handed back as text", () => {
		expect(
			restCredentials({
				AdminPassword: "s3cret",
				RESTAPIPort: "8300",
			}).port,
		).toBe(8300);
	});

	test("ignores a port that is not a number", () => {
		expect(
			restCredentials({
				AdminPassword: "s3cret",
				RESTAPIPort: "not-a-port",
			}).port,
		).toBe(REST_API_PORT);
	});

	test("ignores a port of zero or below", () => {
		for (const port of [
			0,
			-1,
		]) {
			expect(
				restCredentials({
					AdminPassword: "s3cret",
					RESTAPIPort: port,
				}).port,
			).toBe(REST_API_PORT);
		}
	});

	test("keeps a password the codec handed back as a number", () => {
		expect(
			restCredentials({
				AdminPassword: 1234,
			}).password,
		).toBe("1234");
	});

	test("refuses to build a request when the admin password is empty", () => {
		expect(() => {
			return restCredentials({
				AdminPassword: "",
			});
		}).toThrow(BridgeNetError);
	});

	test("refuses to build a request when the admin password is missing", () => {
		expect(() => {
			return restCredentials({});
		}).toThrow(BridgeNetError);
	});

	test("reports a missing password with no http status, because nothing was sent", () => {
		try {
			restCredentials({});

			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(BridgeNetError);
			expect((error as BridgeNetError).status).toBeNull();
		}
	});
});

const contextOn = (port: number) => {
	return {
		codec: {
			ueIni: {
				read: async () => ({
					AdminPassword: "s3cret",
					RESTAPIPort: port,
				}),
			},
		},
	} as unknown as Bridge.Context;
};

const refusalOf = async (run: () => Promise<unknown>) => {
	try {
		await run();
	} catch (error) {
		return error;
	}

	throw new Error("the call was expected to fail");
};

describe("explaining a rest api call that failed during an action", () => {
	test("tells the owner to wait when the game does not answer yet, and keeps the raw failure", async () => {
		const server = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch() {
				return new Response("OK");
			},
		});
		const port = server.port ?? 0;

		await server.stop(true);

		const error = await refusalOf(() => palworldPost(contextOn(port), "/v1/api/save"));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text.en).toBe(
			"The server is not answering the panel right now. If it just started, wait a bit, then try again.",
		);
		expect((error as BridgeUserError).cause).toBeInstanceOf(BridgeNetError);
	});

	test("tells the owner to restart when the game still runs with an older admin password", async () => {
		const server = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			fetch() {
				return new Response("Unauthorized", {
					status: 401,
				});
			},
		});

		try {
			const error = await refusalOf(() => palworldPost(contextOn(server.port ?? 0), "/v1/api/save"));

			expect(error).toBeInstanceOf(BridgeUserError);
			expect((error as BridgeUserError).text.en).toContain("Restart the server");
			expect(JSON.stringify((error as BridgeUserError).text)).not.toContain("s3cret");
		} finally {
			await server.stop(true);
		}
	});

	test("keeps any other failure raw, because the owner cannot act on it", () => {
		const failure = new BridgeNetError(500, "127.0.0.1:8212 answered 500");
		const other = new Error("boom");

		expect(restFailure(failure)).toBe(failure);
		expect(restFailure(other)).toBe(other);
	});
});
