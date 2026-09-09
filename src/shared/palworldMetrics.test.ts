import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import {
	createMetricsSampler,
	LAG_COOLDOWN_MS,
	LAG_FPS_THRESHOLD,
	type LagState,
	lagDecision,
	METRICS_PATH,
	type PalworldMetrics,
	SAMPLE_MIN_AGE_MS,
} from "./palworldMetrics";

const IDLE: LagState = {
	low: 0,
	lastEmittedAt: null,
};

const HEALTHY = 59;

const LOW = 11;

describe("deciding when a slow palworld tick is worth telling the platform about", () => {
	test("says nothing about a single slow sample, which is what a save or a raid looks like", () => {
		expect(lagDecision(IDLE, LOW, 1000)).toEqual({
			state: {
				low: 1,
				lastEmittedAt: null,
			},
			emit: false,
		});
	});

	test("speaks up on the second slow sample in a row", () => {
		const first = lagDecision(IDLE, LOW, 1000);
		const second = lagDecision(first.state, LOW, 16_000);

		expect(second.emit).toBe(true);
		expect(second.state).toEqual({
			low: 2,
			lastEmittedAt: 16_000,
		});
	});

	test("counts the threshold itself as healthy, so a server sitting on it stays quiet", () => {
		const first = lagDecision(IDLE, LAG_FPS_THRESHOLD, 1000);
		const second = lagDecision(first.state, LAG_FPS_THRESHOLD, 16_000);

		expect(second.emit).toBe(false);
		expect(second.state.low).toBe(0);
	});

	test("counts a frame under the threshold as slow", () => {
		expect(lagDecision(IDLE, LAG_FPS_THRESHOLD - 1, 1000).state.low).toBe(1);
	});

	test("forgets the slow sample once the server recovers", () => {
		const first = lagDecision(IDLE, LOW, 1000);
		const recovered = lagDecision(first.state, HEALTHY, 16_000);
		const next = lagDecision(recovered.state, LOW, 31_000);

		expect(recovered.state.low).toBe(0);
		expect(next.emit).toBe(false);
	});

	test("forgets the slow sample when the server reports no frame rate at all", () => {
		const first = lagDecision(IDLE, LOW, 1000);
		const missing = lagDecision(first.state, null, 16_000);

		expect(missing.emit).toBe(false);
		expect(missing.state.low).toBe(0);
	});

	test("keeps the last emission across a recovery, so a flapping server cannot spam the platform", () => {
		const first = lagDecision(IDLE, LOW, 1000);
		const emitted = lagDecision(first.state, LOW, 16_000);
		const recovered = lagDecision(emitted.state, HEALTHY, 31_000);

		expect(recovered.state.lastEmittedAt).toBe(16_000);
	});

	test("stays silent while the cooldown runs, however long the lag lasts", () => {
		let state = lagDecision(lagDecision(IDLE, LOW, 0).state, LOW, 15_000).state;

		for (const now of [
			30_000,
			45_000,
			60_000,
		]) {
			const outcome = lagDecision(state, LOW, now);

			expect(outcome.emit).toBe(false);
			state = outcome.state;
		}

		expect(state.lastEmittedAt).toBe(15_000);
		expect(state.low).toBe(5);
	});

	test("says it again once the cooldown has passed, so a lag that never ends is never forgotten", () => {
		const emitted = lagDecision(lagDecision(IDLE, LOW, 0).state, LOW, 15_000);
		const again = lagDecision(emitted.state, LOW, 15_000 + LAG_COOLDOWN_MS);

		expect(again.emit).toBe(true);
		expect(again.state.lastEmittedAt).toBe(15_000 + LAG_COOLDOWN_MS);
	});
});

interface Emitted {
	event: string;
	payload: Bridge.Values | undefined;
}

const metricsServer = (answers: (PalworldMetrics | null)[]) => {
	const remaining = [
		...answers,
	];

	return Bun.serve({
		port: 0,
		fetch(request) {
			if (new URL(request.url).pathname !== METRICS_PATH) {
				return new Response("not found", {
					status: 404,
				});
			}

			const answer = remaining.shift() ?? null;

			return answer === null
				? new Response("down", {
						status: 500,
					})
				: Response.json(answer);
		},
	});
};

const samplerContext = (port: number, emitted: Emitted[], warned: string[]) => {
	return {
		codec: {
			ueIni: {
				read: async () => {
					return {
						AdminPassword: "s3cret",
						RESTAPIPort: port,
					};
				},
			},
		},
		emit: (event: string, payload?: Bridge.Values) => {
			emitted.push({
				event,
				payload,
			});
		},
		log: {
			warn: (message: string) => {
				warned.push(message);
			},
		},
	} as unknown as Bridge.Context;
};

const QUERY_INTERVAL_MS = 15_000;

const sampleAll = async (answers: (PalworldMetrics | null)[]) => {
	const emitted: Emitted[] = [];
	const warned: string[] = [];
	const server = metricsServer(answers);
	const sampler = createMetricsSampler();

	try {
		const context = samplerContext(server.port ?? 0, emitted, warned);
		const samples: (PalworldMetrics | null)[] = [];

		for (let index = 0; index < answers.length; index += 1) {
			setSystemTime(new Date(index * QUERY_INTERVAL_MS));
			samples.push(await sampler.sample(context));
		}

		return {
			emitted,
			latest: sampler.latest(),
			samples,
			warned,
		};
	} finally {
		setSystemTime();
		await server.stop(true);
	}
};

afterEach(() => {
	setSystemTime();
});

const SMOOTH: PalworldMetrics = {
	currentplayernum: 0,
	serverfps: 59,
	serverfpsaverage: 59.34,
	serverframetime: 16.76,
	days: 0,
	maxplayernum: 32,
	basecampnum: 0,
	uptime: 31,
};

const LAGGING: PalworldMetrics = {
	...SMOOTH,
	serverfps: 11,
	serverframetime: 90.5,
};

describe("sampling the palworld metrics endpoint on every query tick", () => {
	test("keeps the answer the server gave, so the panel never waits on its own call", async () => {
		const { latest, samples } = await sampleAll([
			SMOOTH,
		]);

		expect(samples).toEqual([
			SMOOTH,
		]);
		expect(latest).toEqual(SMOOTH);
	});

	test("answers nothing when the rest api is unreachable, and keeps what it already had", async () => {
		const { latest, samples } = await sampleAll([
			SMOOTH,
			null,
		]);

		expect(samples.at(-1)).toBeNull();
		expect(latest).toEqual(SMOOTH);
	});

	test("tells the platform about a lag the owner would otherwise only feel in game", async () => {
		const { emitted, warned } = await sampleAll([
			LAGGING,
			LAGGING,
		]);

		expect(emitted).toEqual([
			{
				event: "TickLagging",
				payload: {
					fps: 11,
					frametime: 90.5,
				},
			},
		]);
		expect(warned.length).toBe(1);
	});

	test("says nothing at all while the world runs smooth", async () => {
		const { emitted, warned } = await sampleAll([
			SMOOTH,
			SMOOTH,
			SMOOTH,
		]);

		expect(emitted).toEqual([]);
		expect(warned).toEqual([]);
	});

	test("forgets everything on clear, so a restarted server starts from a clean slate", async () => {
		const sampler = createMetricsSampler();

		sampler.clear();

		expect(sampler.latest()).toBeNull();
	});
});

const repeating = (answer: PalworldMetrics) => {
	const emitted: Emitted[] = [];
	const warned: string[] = [];

	let requests = 0;

	const server = Bun.serve({
		port: 0,
		fetch(request) {
			if (new URL(request.url).pathname !== METRICS_PATH) {
				return new Response("not found", {
					status: 404,
				});
			}

			requests += 1;

			return Response.json(answer);
		},
	});

	return {
		context: samplerContext(server.port ?? 0, emitted, warned),
		emitted,
		requests: () => requests,
		server,
		warned,
	};
};

describe("sharing one sample between the query loop and the health card", () => {
	test("answers a second reader from the sample it already has, without asking the server again", async () => {
		const { context, requests, server } = repeating(SMOOTH);
		const sampler = createMetricsSampler();

		try {
			setSystemTime(new Date(0));

			const first = await sampler.sample(context);

			setSystemTime(new Date(SAMPLE_MIN_AGE_MS - 1));

			expect(await sampler.sample(context)).toEqual(first ?? {});
			expect(requests()).toBe(1);
		} finally {
			await server.stop(true);
		}
	});

	test("asks the server again once the sample it holds is older than the minimum age", async () => {
		const { context, requests, server } = repeating(SMOOTH);
		const sampler = createMetricsSampler();

		try {
			setSystemTime(new Date(0));

			await sampler.sample(context);

			setSystemTime(new Date(SAMPLE_MIN_AGE_MS));

			await sampler.sample(context);

			expect(requests()).toBe(2);
		} finally {
			await server.stop(true);
		}
	});

	test("never counts a shared sample twice, so two readers cannot fake a lag the server never had", async () => {
		const { context, emitted, requests, server } = repeating(LAGGING);
		const sampler = createMetricsSampler();

		try {
			setSystemTime(new Date(0));

			await sampler.sample(context);

			setSystemTime(new Date(SAMPLE_MIN_AGE_MS - 1));

			await sampler.sample(context);

			expect(emitted).toEqual([]);
			expect(requests()).toBe(1);

			setSystemTime(new Date(QUERY_INTERVAL_MS));

			await sampler.sample(context);

			expect(emitted.length).toBe(1);
			expect(requests()).toBe(2);
		} finally {
			await server.stop(true);
		}
	});
});
