import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { palworldPost, playerRoster, presenceOf } from "../shared";

const REFRESH_SECONDS = 15;

const KICK_PATH = "/v1/api/kick";

const BAN_PATH = "/v1/api/ban";

const presenceOfRow = (row: Bridge.Row) => {
	return presenceOf({
		id: row.id,
		level: typeof row.level === "number" ? row.level : null,
		name: typeof row.name === "string" && row.name.length > 0 ? row.name : row.id,
		ping: typeof row.ping === "number" ? row.ping : null,
	});
};

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

			context.emit(BridgeEventName.PlayerKicked, presenceOfRow(row));
		},
		async ban(context, row) {
			await palworldPost(context, BAN_PATH, {
				userid: row.id,
				message: "You were banned by an admin.",
			});

			context.emit(BridgeEventName.PlayerBanned, presenceOfRow(row));
		},
	},
};
