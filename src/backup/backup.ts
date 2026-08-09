import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { palworldPost } from "../shared";

const SETTLE_SECONDS = 5;

export const backup: Bridge.Backup = {
	kind: BridgeKind.Backup,
	settleSeconds: SETTLE_SECONDS,
	async quiesce(context) {
		await palworldPost(context, "/v1/api/save");
	},
};
