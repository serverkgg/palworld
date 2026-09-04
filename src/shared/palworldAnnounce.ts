import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { palworldPost } from "./restApi";

const ANNOUNCE_PATH = "/v1/api/announce";

const SPACING = /\s+/g;

export const ANNOUNCE_MESSAGE_LENGTH = 200;

export const messageArgument = (args: Bridge.Values) => {
	const message = String(args.message ?? "")
		.replaceAll(SPACING, " ")
		.trim();

	if (message.length === 0) {
		throw new BridgeUserError({
			ar: "اكتب الرسالة أول.",
			en: "Write the message first.",
		});
	}

	return message.slice(0, ANNOUNCE_MESSAGE_LENGTH);
};

export const sendAnnounce = async (context: Bridge.Context, message: string) => {
	await palworldPost(context, ANNOUNCE_PATH, {
		message,
	});
};
