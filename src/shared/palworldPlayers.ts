import type { Bridge } from "@serverkgg/bridge";
import { palworldGet } from "./restApi";

const PLAYERS_PATH = "/v1/api/players";

interface PalworldPlayer {
	name?: string;
	playerId?: string;
	userId?: string;
	level?: number;
	ping?: number;
}

export interface PalworldPlayers {
	players?: PalworldPlayer[];
}

export type PalworldRosterEntry = Bridge.Row & {
	name: string;
	level: number | null;
	ping: number | null;
};

export const rosterOf = (payload: PalworldPlayers): PalworldRosterEntry[] => {
	return (payload.players ?? []).flatMap((player) => {
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
};

export const playerRoster = async (context: Bridge.Context): Promise<PalworldRosterEntry[]> => {
	return rosterOf(await palworldGet<PalworldPlayers>(context, PLAYERS_PATH));
};
