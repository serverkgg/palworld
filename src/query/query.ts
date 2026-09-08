import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { type PalworldRosterEntry, palworldGet, playerRoster, roster } from "../shared";

const REFRESH_SECONDS = 15;

const METRICS_PATH = "/v1/api/metrics";

interface PalworldMetrics {
	currentplayernum?: number;
	maxplayernum?: number;
}

const currentRoster = async (context: Bridge.Context): Promise<PalworldRosterEntry[] | null> => {
	try {
		return await playerRoster(context);
	} catch {
		return null;
	}
};

export const query: Bridge.Query = {
	kind: BridgeKind.Query,
	refreshSeconds: REFRESH_SECONDS,
	async sample(context) {
		const players = await currentRoster(context);

		if (players !== null) {
			roster.sync(context, players);
		}

		try {
			const metrics = await palworldGet<PalworldMetrics>(context, METRICS_PATH);

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
