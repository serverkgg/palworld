import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	BAN_MESSAGE,
	bannedActivity,
	KICK_MESSAGE,
	kickedActivity,
	platformOf,
	playerRoster,
	presenceOf,
	sendBan,
	sendKick,
} from "../shared";

const REFRESH_SECONDS = 15;

const presenceOfRow = (row: Bridge.Row) => {
	return presenceOf({
		id: row.id,
		name: typeof row.name === "string" && row.name.length > 0 ? row.name : row.id,
		account: typeof row.account === "string" ? row.account : null,
		platform: typeof row.platform === "string" && row.platform.length > 0 ? row.platform : platformOf(row.id),
		level: typeof row.level === "number" ? row.level : null,
		ping: typeof row.ping === "number" ? row.ping : null,
		buildings: typeof row.buildings === "number" ? row.buildings : null,
		avatarHash: typeof row.avatarHash === "string" ? row.avatarHash : null,
	});
};

export const kickPlayer: Bridge.RowAction = async (context, row) => {
	await sendKick(context, row.id, KICK_MESSAGE);

	const presence = presenceOfRow(row);

	context.emit(BridgeEventName.PlayerKicked, presence);
	context.activity.report(kickedActivity(presence));
};

export const banPlayer: Bridge.RowAction = async (context, row) => {
	await sendBan(context, row.id, BAN_MESSAGE);

	const presence = presenceOfRow(row);

	context.emit(BridgeEventName.PlayerBanned, presence);
	context.activity.report(bannedActivity(presence));
};

export const players: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,
	async list(context) {
		return await playerRoster(context);
	},
	actions: {
		kick: kickPlayer,
		ban: banPlayer,
	},
};
