import type { Bridge } from "@serverkgg/bridge";
import { avatars } from "./palworldAvatars";
import { platformOf } from "./palworldBans";
import { palworldGet } from "./restApi";

const PLAYERS_PATH = "/v1/api/players";

const roundedOf = (value: number | undefined) => {
	return value === undefined || !Number.isFinite(value) ? null : Math.round(value);
};

const wholeOf = (value: number | undefined) => {
	return value === undefined || !Number.isFinite(value) ? null : Math.trunc(value);
};

interface PalworldPlayer {
	name?: string;
	accountName?: string;
	playerId?: string;
	userId?: string;
	level?: number;
	ping?: number;
	building_count?: number;
}

export interface PalworldPlayers {
	players?: PalworldPlayer[];
}

export type PalworldRosterEntry = Bridge.Row & {
	name: string;
	account: string | null;
	platform: string;
	level: number | null;
	ping: number | null;
	buildings: number | null;
	avatarHash: string | null;
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
				account: player.accountName ?? null,
				platform: platformOf(id),
				level: wholeOf(player.level),
				ping: roundedOf(player.ping),
				buildings: wholeOf(player.building_count),
				avatarHash: null,
			},
		];
	});
};

export const playerRoster = async (context: Bridge.Context): Promise<PalworldRosterEntry[]> => {
	const players = rosterOf(await palworldGet<PalworldPlayers>(context, PLAYERS_PATH));
	const hashes = await avatars.resolve(
		context,
		players.map((player) => player.id),
	);

	return players.map((player) => {
		const hash = hashes.get(player.id);

		return hash === undefined
			? player
			: {
					...player,
					avatarHash: hash,
				};
	});
};
