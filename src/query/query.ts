import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { metrics, type PalworldRosterEntry, playerRoster, roster } from "../shared";

const REFRESH_SECONDS = 15;

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

		const current = await metrics.sample(context);

		return {
			online: current?.currentplayernum ?? null,
			max: current?.maxplayernum ?? null,
		};
	},
};
