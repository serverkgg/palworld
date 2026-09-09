import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { playerSummaries, steamWebApiReady } from "@serverkgg/bridge/steam";
import {
	BAN_MESSAGE,
	type PalworldBan,
	platformOf,
	readBanList,
	requireUserId,
	STEAM_PREFIX,
	sendBan,
	sendUnban,
	steamIdOf,
} from "../shared";

const REFRESH_SECONDS = 15;

const namesOf = async (context: Bridge.Context, bans: PalworldBan[]) => {
	const ids = bans.flatMap((ban) => {
		const steamId = steamIdOf(ban.userId);

		return steamId === null
			? []
			: [
					steamId,
				];
	});

	if (ids.length === 0 || !steamWebApiReady(context)) {
		return new Map<string, string>();
	}

	try {
		return new Map(
			(await playerSummaries(context, ids)).map((summary) => [
				`${STEAM_PREFIX}${summary.steamid}`,
				summary.personaname,
			]),
		);
	} catch (error) {
		context.log.warn("the steam web api did not answer for the ban list", {
			error: error instanceof Error ? error.message : String(error),
		});

		return new Map<string, string>();
	}
};

export const banRow = (ban: PalworldBan, player: string): Bridge.Row => {
	return {
		id: ban.userId,
		userId: ban.userId,
		platform: platformOf(ban.userId),
		player,
	};
};

export const banUserId = async (context: Bridge.Context, input: string) => {
	const userId = requireUserId(input);

	await sendBan(context, userId, BAN_MESSAGE);

	context.emit(BridgeEventName.PlayerBanned, {
		player: userId,
		userId,
		platform: platformOf(userId),
	});

	context.log("banned a user id that was not online", {
		userId,
	});
};

export const bans: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,
	async list(context) {
		const banned = await readBanList(context);
		const names = await namesOf(context, banned);

		return banned.map((ban) => banRow(ban, names.get(ban.userId) ?? ""));
	},
	async add(context, input) {
		await banUserId(context, input);
	},
	actions: {
		async remove(context, row) {
			await sendUnban(context, row.id);

			context.log("lifted a ban from the panel", {
				userId: row.id,
			});
		},
	},
};
