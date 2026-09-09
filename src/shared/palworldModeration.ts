import type { Bridge } from "@serverkgg/bridge";
import { palworldPost } from "./restApi";

export const KICK_PATH = "/v1/api/kick";

export const BAN_PATH = "/v1/api/ban";

export const UNBAN_PATH = "/v1/api/unban";

export const KICK_MESSAGE = "You were kicked by an admin.";

export const BAN_MESSAGE = "You were banned by an admin.";

export const sendKick = async (context: Bridge.Context, userId: string, message: string) => {
	await palworldPost(context, KICK_PATH, {
		userid: userId,
		message,
	});
};

export const sendBan = async (context: Bridge.Context, userId: string, message: string) => {
	await palworldPost(context, BAN_PATH, {
		userid: userId,
		message,
	});
};

export const sendUnban = async (context: Bridge.Context, userId: string) => {
	await palworldPost(context, UNBAN_PATH, {
		userid: userId,
	});
};
