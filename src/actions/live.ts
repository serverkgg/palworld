import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { messageArgument, palworldPost, sendAnnounce } from "../shared";

const SAVE_PATH = "/v1/api/save";

export const live: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,
	actions: {
		async announce(context, args) {
			await sendAnnounce(context, messageArgument(args));
		},

		async save(context) {
			await palworldPost(context, SAVE_PATH);
		},
	},
};
