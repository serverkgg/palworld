import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { type PalworldRosterEntry, palworldGet, playerRoster } from "../shared";

const REFRESH_SECONDS = 15;

const METRICS_PATH = "/v1/api/metrics";

interface PalworldMetrics {
	currentplayernum?: number;
	maxplayernum?: number;
}

const online = new Map<string, PalworldRosterEntry>();

export const presenceOf = (id: string, player: PalworldRosterEntry) => {
	return {
		player: player.name,
		userId: id,
		...(player.level === null
			? {}
			: {
					level: String(player.level),
				}),
		...(player.ping === null
			? {}
			: {
					ping: String(player.ping),
				}),
	};
};

const syncSessions = async (context: Bridge.Context) => {
	let current: Map<string, PalworldRosterEntry>;

	try {
		current = new Map(
			(await playerRoster(context)).map((player) => [
				player.id,
				player,
			]),
		);
	} catch {
		return;
	}

	for (const [id, player] of current) {
		if (!online.has(id)) {
			context.emit("PlayerJoined", presenceOf(id, player));
		}
	}

	for (const [id, player] of online) {
		if (!current.has(id)) {
			context.emit("PlayerLeft", presenceOf(id, player));
		}
	}

	online.clear();

	for (const [id, player] of current) {
		online.set(id, player);
	}
};

export const query: Bridge.Query = {
	kind: BridgeKind.Query,
	refreshSeconds: REFRESH_SECONDS,
	async sample(context) {
		await syncSessions(context);

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
