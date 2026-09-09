import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { palworldGet } from "./restApi";

export const METRICS_PATH = "/v1/api/metrics";

export const LAG_FPS_THRESHOLD = 20;

export const LAG_CONSECUTIVE_SAMPLES = 2;

export const LAG_COOLDOWN_MS = 300_000;

export const SAMPLE_MIN_AGE_MS = 10_000;

export interface PalworldMetrics {
	currentplayernum?: number;
	maxplayernum?: number;
	serverfps?: number;
	serverfpsaverage?: number;
	serverframetime?: number;
	uptime?: number;
	basecampnum?: number;
	days?: number;
}

export interface LagState {
	low: number;
	lastEmittedAt: number | null;
}

export interface LagOutcome {
	state: LagState;
	emit: boolean;
}

export interface PalworldMetricsSampler {
	sample(context: Bridge.Context): Promise<PalworldMetrics | null>;
	latest(): PalworldMetrics | null;
	clear(): void;
}

const IDLE_LAG: LagState = {
	low: 0,
	lastEmittedAt: null,
};

export const readMetrics = async (context: Bridge.Context) => {
	return await palworldGet<PalworldMetrics>(context, METRICS_PATH);
};

export const lagDecision = (state: LagState, fps: number | null, now: number): LagOutcome => {
	if (fps === null || fps >= LAG_FPS_THRESHOLD) {
		return {
			state: {
				low: 0,
				lastEmittedAt: state.lastEmittedAt,
			},
			emit: false,
		};
	}

	const low = state.low + 1;

	if (low < LAG_CONSECUTIVE_SAMPLES) {
		return {
			state: {
				low,
				lastEmittedAt: state.lastEmittedAt,
			},
			emit: false,
		};
	}

	const cooled = state.lastEmittedAt === null || now - state.lastEmittedAt >= LAG_COOLDOWN_MS;

	return {
		state: {
			low,
			lastEmittedAt: cooled ? now : state.lastEmittedAt,
		},
		emit: cooled,
	};
};

export const createMetricsSampler = (): PalworldMetricsSampler => {
	let stored: PalworldMetrics | null = null;
	let storedAt = 0;
	let lag = IDLE_LAG;

	return {
		async sample(context) {
			const now = Date.now();

			if (stored !== null && now - storedAt < SAMPLE_MIN_AGE_MS) {
				return stored;
			}

			let answer: PalworldMetrics;

			try {
				answer = await readMetrics(context);
			} catch {
				return null;
			}

			stored = answer;
			storedAt = now;

			const fps = answer.serverfps ?? null;
			const outcome = lagDecision(lag, fps, now);

			lag = outcome.state;

			if (outcome.emit && fps !== null) {
				const payload = {
					fps,
					frametime: answer.serverframetime ?? 0,
				};

				context.emit(BridgeEventName.TickLagging, payload);
				context.log.warn("palworld is running below the frame rate a smooth world needs", payload);
			}

			return answer;
		},

		latest() {
			return stored;
		},

		clear() {
			stored = null;
			storedAt = 0;
			lag = IDLE_LAG;
		},
	};
};

export const metrics = createMetricsSampler();
