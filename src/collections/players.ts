import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { palworldGet, palworldPost } from "../shared";

const REFRESH_SECONDS = 15;

interface PalworldPlayer {
	name?: string;
	playerId?: string;
	userId?: string;
	level?: number;
	ping?: number;
}

interface PalworldPlayers {
	players?: PalworldPlayer[];
}

export const players: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,
	async list(context) {
		const response = await palworldGet<PalworldPlayers>(context, "/v1/api/players");

		return (response.players ?? []).flatMap((player) => {
			const id = player.userId ?? player.playerId ?? "";

			if (id.length === 0) {
				return [];
			}

			return [
				{
					id,
					name: player.name ?? id,
					level: player.level ?? null,
					ping: player.ping ?? null,
				},
			];
		});
	},
	actions: {
		async kick(context, row) {
			await palworldPost(context, "/v1/api/kick", {
				userid: row.id,
				message: "You were kicked by an admin.",
			});
		},
		async ban(context, row) {
			await palworldPost(context, "/v1/api/ban", {
				userid: row.id,
				message: "You were banned by an admin.",
			});
		},
	},
};
