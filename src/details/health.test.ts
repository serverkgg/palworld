import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeDetailTone } from "@serverkgg/bridge";
import { LAG_FPS_THRESHOLD, metrics, SAMPLE_MIN_AGE_MS } from "../shared";
import { formatUptime, fpsBadge, health, SMOOTH_FPS_THRESHOLD } from "./health";

const toneOf = (fps: number) => {
	return fpsBadge(fps).tone;
};

describe("telling the owner in one word how his world is running", () => {
	test("calls a server holding the full frame rate smooth", () => {
		expect(toneOf(60)).toBe(BridgeDetailTone.Success);
		expect(toneOf(SMOOTH_FPS_THRESHOLD)).toBe(BridgeDetailTone.Success);
	});

	test("warns the moment the frame rate drops under smooth", () => {
		expect(toneOf(SMOOTH_FPS_THRESHOLD - 1)).toBe(BridgeDetailTone.Warning);
		expect(toneOf(LAG_FPS_THRESHOLD)).toBe(BridgeDetailTone.Warning);
	});

	test("calls it lag once the frame rate falls under the threshold the platform acts on", () => {
		expect(toneOf(LAG_FPS_THRESHOLD - 1)).toBe(BridgeDetailTone.Danger);
		expect(toneOf(0)).toBe(BridgeDetailTone.Danger);
	});

	test("labels every tone in both arabic and english", () => {
		for (const fps of [
			60,
			30,
			5,
		]) {
			expect(fpsBadge(fps).label.ar.length).toBeGreaterThan(0);
			expect(fpsBadge(fps).label.en.length).toBeGreaterThan(0);
		}
	});
});

describe("reading the uptime the server reports in seconds", () => {
	test("says less than a minute before the first minute is up", () => {
		expect(formatUptime(31)).toEqual({
			ar: "أقل من دقيقة",
			en: "Less than a minute",
		});
	});

	test("counts the minutes of a server that just started", () => {
		expect(formatUptime(60)).toEqual({
			ar: "دقيقة",
			en: "1m",
		});
		expect(formatUptime(9 * 60)).toEqual({
			ar: "9 دقايق",
			en: "9m",
		});
		expect(formatUptime(40 * 60)).toEqual({
			ar: "40 دقيقة",
			en: "40m",
		});
	});

	test("drops the minutes when the hour lands exactly", () => {
		expect(formatUptime(3600)).toEqual({
			ar: "ساعة",
			en: "1h",
		});
		expect(formatUptime(2 * 3600)).toEqual({
			ar: "ساعتين",
			en: "2h",
		});
	});

	test("reads the hours and the minutes together on a server that has been up a while", () => {
		expect(formatUptime(3 * 3600 + 15 * 60 + 42)).toEqual({
			ar: "3 ساعات و15 دقيقة",
			en: "3h 15m",
		});
		expect(formatUptime(30 * 3600 + 2 * 60)).toEqual({
			ar: "30 ساعة ودقيقتين",
			en: "30h 2m",
		});
	});

	test("writes every number in western digits, never arabic-indic ones", () => {
		const arabic = formatUptime(5 * 3600 + 20 * 60).ar;

		expect(arabic).toContain("5");
		expect(arabic).toContain("20");
		expect(arabic).not.toMatch(/[٠-٩]/);
	});

	test("never reads a negative uptime as a duration", () => {
		expect(formatUptime(-90)).toEqual({
			ar: "أقل من دقيقة",
			en: "Less than a minute",
		});
	});
});

describe("declaring the health card the controls tab opens with", () => {
	test("only reads a running server, because the rest api is gone with it", () => {
		expect(health.requiresRunning).toBe(true);
	});

	test("refreshes as often as the query loop samples, so the card never lags the numbers", () => {
		expect(health.refreshSeconds).toBe(15);
	});
});

const METRICS = {
	currentplayernum: 3,
	maxplayernum: 32,
	serverfps: 58,
	serverframetime: 17.2,
	uptime: 5400,
	basecampnum: 4,
	days: 12,
};

interface Answering {
	reachable: boolean;
}

const harness = (answering: Answering) => {
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request) {
			if (!answering.reachable) {
				return new Response("down", {
					status: 503,
				});
			}

			return new URL(request.url).pathname === "/v1/api/metrics"
				? Response.json(METRICS)
				: Response.json({
						version: "v0.6.0",
					});
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
		log: Object.assign(() => {}, {
			warn() {},
			error() {},
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		server,
	};
};

beforeEach(() => {
	metrics.clear();
	setSystemTime(new Date(0));
});

afterEach(() => {
	setSystemTime();
});

describe("reading the health card off a server that may not answer", () => {
	test("asks the server itself rather than serving the sample the query loop left behind", async () => {
		const answering = {
			reachable: true,
		};
		const { context, server } = harness(answering);

		try {
			const card = await health.read(context);

			expect(card?.stale).toBe(false);
			expect(card?.stats.find((stat) => stat.key === "players")?.value).toBe("3/32");
		} finally {
			await server.stop(true);
		}
	});

	test("falls back to the last numbers it saw and says they are stale once the server stops answering", async () => {
		const answering = {
			reachable: true,
		};
		const { context, server } = harness(answering);

		try {
			await health.read(context);

			answering.reachable = false;

			setSystemTime(new Date(SAMPLE_MIN_AGE_MS));

			const card = await health.read(context);

			expect(card?.stale).toBe(true);
			expect(card?.stats.find((stat) => stat.key === "players")?.value).toBe("3/32");
		} finally {
			await server.stop(true);
		}
	});

	test("serves a second reader the sample it just took, without a second call to the server", async () => {
		const answering = {
			reachable: true,
		};
		const { context, server } = harness(answering);

		try {
			await health.read(context);

			answering.reachable = false;

			const card = await health.read(context);

			expect(card?.stale).toBe(false);
			expect(card?.stats.find((stat) => stat.key === "players")?.value).toBe("3/32");
		} finally {
			await server.stop(true);
		}
	});

	test("shows no card at all when it never had a sample to fall back on", async () => {
		const { context, server } = harness({
			reachable: false,
		});

		try {
			expect(await health.read(context)).toBeNull();
		} finally {
			await server.stop(true);
		}
	});
});
