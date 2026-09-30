import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { broadcastActivity, messageArgument, savedActivity, sendAnnounce, sendSave } from "../shared";

export const broadcastMessage = async (context: Bridge.Context, message: string) => {
	await sendAnnounce(context, message);

	context.activity.report(broadcastActivity(message));
};

export const saveWorld = async (context: Bridge.Context) => {
	await sendSave(context);

	context.activity.report(savedActivity());
};

export const live: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,
	actions: {
		async announce(context, args) {
			await broadcastMessage(context, messageArgument(args));
		},

		async save(context) {
			await saveWorld(context);
		},
	},
};
