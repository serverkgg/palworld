import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { SERVER_READY } from "../shared";

export const events: Bridge.Events = {
	kind: BridgeKind.Events,
	patterns: [
		{
			match: SERVER_READY,
			emit: "ServerStarted",
		},
		{
			match: /Fatal error/,
			emit: "ServerCrashed",
		},
		{
			match: /Assertion failed: (?<detail>[^\n]{1,200})/,
			emit: "ServerCrashed",
		},
	],
	emits: [
		"PlayerJoined",
		"PlayerLeft",
		"ServerStopping",
	],
};
