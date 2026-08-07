import { type Bridge, BridgeKind, BridgeTerminalLevel } from "@serverkgg/bridge";

const player: Bridge.TerminalArg = {
	key: "player",
	label: {
		ar: "اللاعب",
		en: "Player",
	},
	required: true,
	module: "players",
	column: "name",
};

const commands: Bridge.TerminalCommand[] = [
	{
		name: "Broadcast",
		summary: {
			ar: "رسالة تظهر لكل اللاعبين.",
			en: "Broadcast a message to everyone.",
		},
		syntax: "Broadcast <message>",
	},
	{
		name: "ShowPlayers",
		summary: {
			ar: "يعرض اللاعبين المتصلين الحين.",
			en: "List the players who are online.",
		},
	},
	{
		name: "Info",
		summary: {
			ar: "يعرض معلومات السيرفر.",
			en: "Show server information.",
		},
	},
	{
		name: "Save",
		summary: {
			ar: "يحفظ العالم على القرص.",
			en: "Save the world to disk.",
		},
	},
	{
		name: "KickPlayer",
		summary: {
			ar: "يطرد لاعب من السيرفر.",
			en: "Kick a player from the server.",
		},
		syntax: "KickPlayer <player>",
		args: [
			player,
		],
	},
	{
		name: "BanPlayer",
		summary: {
			ar: "يحظر لاعب نهائيًا.",
			en: "Ban a player.",
		},
		syntax: "BanPlayer <player>",
		args: [
			player,
		],
		danger: true,
	},
	{
		name: "TeleportToPlayer",
		summary: {
			ar: "ينقلك لمكان لاعب.",
			en: "Teleport to a player.",
		},
		syntax: "TeleportToPlayer <player>",
		args: [
			player,
		],
	},
	{
		name: "Shutdown",
		summary: {
			ar: "يوقف السيرفر بعد مهلة مع رسالة.",
			en: "Shut the server down after a delay, with a message.",
		},
		syntax: "Shutdown <seconds> <message>",
		danger: true,
	},
	{
		name: "DoExit",
		summary: {
			ar: "يوقف السيرفر فورًا بدون حفظ.",
			en: "Stop the server immediately without saving.",
		},
		danger: true,
	},
];

const rules: Bridge.TerminalRule[] = [
	{
		match: /\b(?:Error|Fatal):/,
		level: BridgeTerminalLevel.Error,
	},
	{
		match: /^\[[^\]]*\]\[[^\]]*\]Log\w+:\s*Error:/,
		level: BridgeTerminalLevel.Error,
	},
	{
		match: /\bWarning:/,
		level: BridgeTerminalLevel.Warn,
	},
	{
		match: /\bAssertion failed\b/,
		level: BridgeTerminalLevel.Error,
	},
];

export const terminal: Bridge.Terminal = {
	kind: BridgeKind.Terminal,
	commands,
	rules,
};
