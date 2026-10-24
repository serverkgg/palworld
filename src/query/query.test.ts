import { beforeEach, describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { METRICS_PATH, metrics, type PalworldMetrics } from "../shared";
import { query } from "./query";

const METRICS: PalworldMetrics = {
	currentplayernum: 3,
	maxplayernum: 32,
	serverfps: 58,
	serverframetime: 17.2,
	uptime: 5400,
};

const harness = (answer: PalworldMetrics | null) => {
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request) {
			if (answer === null || new URL(request.url).pathname !== METRICS_PATH) {
				return new Response("down", {
					status: 503,
				});
			}

			return Response.json(answer);
		},
	});

	const context = {
		codec: {
			ueIni: {
				read: async () => ({
					AdminPassword: "s3cret",
					RESTAPIPort: server.port ?? 0,
				}),
			},
		},
		emit() {},
		activity: {
			report() {},
		},
		log: Object.assign(() => {}, {
			warn() {},
			error() {},
		}),
		variable() {
			return null;
		},
	} as unknown as Bridge.Context;

	return {
		context,
		server,
	};
};

const sampled = async (answer: PalworldMetrics | null) => {
	const { context, server } = harness(answer);

	try {
		return await query.sample(context);
	} finally {
		await server.stop(true);
	}
};

beforeEach(() => {
	metrics.clear();
});

describe("sampling the players and the frame time for the panel analytics", () => {
	it("reports the frame time the server measures as the tick, in milliseconds", async () => {
		expect(await sampled(METRICS)).toEqual({
			online: 3,
			max: 32,
			tick: 17.2,
		});
	});

	it("reports no tick from a server that leaves the frame time out", async () => {
		expect(
			(
				await sampled({
					currentplayernum: 3,
					maxplayernum: 32,
				})
			).tick,
		).toBeNull();
	});

	it("reports no players and no tick while the rest api does not answer", async () => {
		expect(await sampled(null)).toEqual({
			online: null,
			max: null,
			tick: null,
		});
	});
});
