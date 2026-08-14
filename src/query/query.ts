import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { palworldGet, playerRoster } from "../shared";

const REFRESH_SECONDS = 15;

const METRICS_PATH = "/v1/api/metrics";

interface PalworldMetrics {
	currentplayernum?: number;
	maxplayernum?: number;
}

const online = new Map<string, string>();

const syncSessions = async (context: Bridge.Context) => {
	let current: Map<string, string>;

	try {
		current = new Map(
			(await playerRoster(context)).map((player) => [
				player.id,
				player.name,
			]),
		);
	} catch {
		return;
	}

	for (const [id, name] of current) {
		if (!online.has(id)) {
			context.emit("PlayerJoined", {
				player: name,
			});
		}
	}

	for (const [id, name] of online) {
		if (!current.has(id)) {
			context.emit("PlayerLeft", {
				player: name,
			});
		}
	}

	online.clear();

	for (const [id, name] of current) {
		online.set(id, name);
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
