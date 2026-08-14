import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { palworldPost, playerRoster } from "../shared";

const REFRESH_SECONDS = 15;

const KICK_PATH = "/v1/api/kick";

const BAN_PATH = "/v1/api/ban";

export const players: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,
	async list(context) {
		return await playerRoster(context);
	},
	actions: {
		async kick(context, row) {
			await palworldPost(context, KICK_PATH, {
				userid: row.id,
				message: "You were kicked by an admin.",
			});
		},
		async ban(context, row) {
			await palworldPost(context, BAN_PATH, {
				userid: row.id,
				message: "You were banned by an admin.",
			});
		},
	},
};
