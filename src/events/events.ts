import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { SERVER_READY } from "../shared";

export const events: Bridge.Events = {
	kind: BridgeKind.Events,
	patterns: [
		{
			match: SERVER_READY,
			emit: BridgeEventName.ServerStarted,
		},
		{
			match: /Fatal error/,
			emit: BridgeEventName.ServerCrashed,
		},
		{
			match: /Assertion failed: (?<detail>[^\n]{1,200})/,
			emit: BridgeEventName.ServerCrashed,
		},
	],
	emits: [
		BridgeEventName.PlayerJoined,
		BridgeEventName.PlayerLeft,
		BridgeEventName.PlayerKicked,
		BridgeEventName.PlayerBanned,
		BridgeEventName.ServerStopping,
		BridgeEventName.ServerUpdated,
	],
};
