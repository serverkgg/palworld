import { createRosterSync } from "@serverkgg/bridge/presence";
import type { PalworldRosterEntry } from "./palworldPlayers";

export const presenceOf = (player: PalworldRosterEntry) => {
	return {
		player: player.name,
		userId: player.id,
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

export const roster = createRosterSync<PalworldRosterEntry>({
	id: (player) => {
		return player.id;
	},
	presenceOf,
});
