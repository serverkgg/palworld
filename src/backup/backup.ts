import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { sendSave } from "../shared";

const SETTLE_SECONDS = 5;

export const backup: Bridge.Backup = {
	kind: BridgeKind.Backup,
	settleSeconds: SETTLE_SECONDS,
	async quiesce(context) {
		await sendSave(context);
	},
};
