import { type Bridge, BridgeKind, BridgeTerminalLevel } from "@serverkgg/bridge";
import { consoleHandler } from "./consoleHandler";

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

const message: Bridge.TerminalArg = {
	key: "message",
	label: {
		ar: "الرسالة",
		en: "Message",
	},
	required: true,
	variadic: true,
};

const userId: Bridge.TerminalArg = {
	key: "userId",
	label: {
		ar: "المعرّف",
		en: "User ID",
	},
	required: true,
};

const seconds: Bridge.TerminalArg = {
	key: "seconds",
	label: {
		ar: "الثواني",
		en: "Seconds",
	},
	required: true,
};

const commands: Bridge.TerminalCommand[] = [
	{
		name: "Broadcast",
		summary: {
			ar: "رسالة تظهر لكل اللاعبين.",
			en: "Broadcast a message to everyone.",
		},
		syntax: "Broadcast <message>",
		args: [
			message,
		],
	},
	{
		name: "ShowPlayers",
		summary: {
			ar: "يعرض اللاعبين المتصلين الآن.",
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
			ar: "يحفظ الماب على القرص.",
			en: "Save the world to disk.",
		},
	},
	{
		name: "KickPlayer",
		summary: {
			ar: "يطرد لاعبًا من السيرفر.",
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
			ar: "يحظر لاعبًا نهائيًا. إذا لم يكن متصلًا الآن، فاكتب معرّفه بدلًا من اسمه.",
			en: "Ban a player. If they're offline, write their user ID instead of their name.",
		},
		syntax: "BanPlayer <player>",
		args: [
			player,
		],
		danger: true,
	},
	{
		name: "UnBanPlayer",
		summary: {
			ar: "يفك الحظر عن لاعب بمعرّفه.",
			en: "Unban a player by their user ID.",
		},
		syntax: "UnBanPlayer <userId>",
		args: [
			userId,
		],
	},
	{
		name: "Shutdown",
		summary: {
			ar: "يوقف السيرفر بعد مهلة مع رسالة.",
			en: "Shut the server down after a delay, with a message.",
		},
		syntax: "Shutdown <seconds> <message>",
		args: [
			seconds,
			message,
		],
		danger: true,
	},
	{
		name: "DoExit",
		summary: {
			ar: "يوقف السيرفر فورًا دون حفظ.",
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
	run: consoleHandler,
};
