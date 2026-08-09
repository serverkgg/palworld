import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { palworldGet } from "../shared";

const REFRESH_SECONDS = 30;

interface PalworldMetrics {
	currentplayernum?: number;
	maxplayernum?: number;
}

export const query: Bridge.Query = {
	kind: BridgeKind.Query,
	refreshSeconds: REFRESH_SECONDS,
	async sample(context) {
		try {
			const metrics = await palworldGet<PalworldMetrics>(context, "/v1/api/metrics");

			return {
				online: metrics.currentplayernum ?? null,
				max: metrics.maxplayernum ?? null,
			};
		} catch {
			return {
				online: null,
				max: null,
			};
		}
	},
};
