import { describe, expect, test } from "bun:test";
import { PalworldApiError, REST_API_PORT, restCredentials } from "./restApi";

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
		}).toThrow(PalworldApiError);
	});

	test("refuses to build a request when the admin password is missing", () => {
		expect(() => {
			return restCredentials({});
		}).toThrow(PalworldApiError);
	});

	test("reports a missing password with no http status, because nothing was sent", () => {
		try {
			restCredentials({});

			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(PalworldApiError);
			expect((error as PalworldApiError).status).toBeNull();
		}
	});
});
