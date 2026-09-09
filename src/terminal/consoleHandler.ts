import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { banPlayer, banUserId, kickPlayer } from "../collections";
import {
	messageArgument,
	type PalworldInfo,
	type PalworldRosterEntry,
	playerRoster,
	readInfo,
	requireUserId,
	SHUTDOWN_MESSAGE,
	sendAnnounce,
	sendSave,
	sendShutdown,
	sendStop,
	sendUnban,
	USER_ID_PATTERN,
} from "../shared";

const SPACING = /\s+/;

const SHUTDOWN_DELAY_LIMIT_SECONDS = 3600;

const ROSTER_HEADER = "name,userid,level,ping";

export interface PalworldConsoleLine {
	name: string;
	rest: string;
	args: string[];
}

export const parseConsoleLine = (input: string): PalworldConsoleLine => {
	const trimmed = input.trim();
	const boundary = trimmed.search(SPACING);
	const rest = boundary < 0 ? "" : trimmed.slice(boundary).trim();

	return {
		name: (boundary < 0 ? trimmed : trimmed.slice(0, boundary)).toLowerCase(),
		rest,
		args: rest.length === 0 ? [] : rest.split(SPACING),
	};
};

export const rosterLines = (players: PalworldRosterEntry[]): string[] => {
	if (players.length === 0) {
		return [
			"no players online",
		];
	}

	return [
		ROSTER_HEADER,
		...players.map((player) => {
			return [
				player.name,
				player.id,
				player.level === null ? "" : String(player.level),
				player.ping === null ? "" : String(player.ping),
			].join(",");
		}),
	];
};

export const infoLines = (info: PalworldInfo): string[] => {
	return [
		`version: ${info.version ?? "unknown"}`,
		`name: ${info.servername ?? "unknown"}`,
		`description: ${info.description ?? ""}`,
		`world: ${info.worldguid ?? "unknown"}`,
	];
};

export const findPlayer = (players: PalworldRosterEntry[], needle: string): PalworldRosterEntry | null => {
	const wanted = needle.toLowerCase();

	return (
		players.find((player) => {
			return player.id.toLowerCase() === wanted || player.name.toLowerCase() === wanted;
		}) ?? null
	);
};

export const shutdownSeconds = (raw: string | undefined): number | null => {
	if (raw === undefined || !/^\d+$/.test(raw)) {
		return null;
	}

	const seconds = Number(raw);

	return seconds > 0 && seconds <= SHUTDOWN_DELAY_LIMIT_SECONDS ? seconds : null;
};

const needleOf = (line: PalworldConsoleLine) => {
	if (line.rest.length === 0) {
		throw new BridgeUserError({
			ar: "اكتب اسم اللاعب أو الـ ID أول.",
			en: "Write the player name or id first.",
		});
	}

	return line.rest;
};

const targetOf = async (context: Bridge.Context, line: PalworldConsoleLine) => {
	const player = findPlayer(await playerRoster(context), needleOf(line));

	if (!player) {
		throw new BridgeUserError({
			ar: "ما فيه لاعب بهذا الاسم متصل الحين.",
			en: "No player with that name is online right now.",
		});
	}

	return player;
};

type PalworldConsoleCommand = (context: Bridge.Context, line: PalworldConsoleLine) => Promise<string[]>;

export const consoleCommands: Record<string, PalworldConsoleCommand> = {
	async broadcast(context, line) {
		const message = messageArgument({
			message: line.rest,
		});

		await sendAnnounce(context, message);

		return [
			`broadcasted: ${message}`,
		];
	},

	async showplayers(context) {
		return rosterLines(await playerRoster(context));
	},

	async info(context) {
		return infoLines(await readInfo(context));
	},

	async save(context) {
		await sendSave(context);

		return [
			"complete save",
		];
	},

	async kickplayer(context, line) {
		const player = await targetOf(context, line);

		await kickPlayer(context, player, {});

		return [
			`kicked: ${player.name}`,
		];
	},

	async banplayer(context, line) {
		const needle = needleOf(line);
		const player = findPlayer(await playerRoster(context), needle);

		if (player) {
			await banPlayer(context, player, {});

			return [
				`banned: ${player.name}`,
			];
		}

		if (!USER_ID_PATTERN.test(needle)) {
			throw new BridgeUserError({
				ar: "ما فيه لاعب بهذا الاسم متصل الحين. لو تبي تحظر واحد مو متصل، اكتب معرّفه زي steam_76561198000000001",
				en: "No player with that name is online right now. To ban someone who is offline, write their user id like steam_76561198000000001.",
			});
		}

		await banUserId(context, needle);

		return [
			`banned: ${needle}`,
		];
	},

	async unbanplayer(context, line) {
		const userId = requireUserId(line.rest);

		await sendUnban(context, userId);

		return [
			`unbanned: ${userId}`,
		];
	},

	async teleporttoplayer() {
		throw new BridgeUserError({
			ar: "TeleportToPlayer يشتغل داخل اللعبة بس، ما ينفع من الكونسول.",
			en: "TeleportToPlayer only works inside the game, not from the console.",
		});
	},

	async shutdown(context, line) {
		const seconds = shutdownSeconds(line.args.at(0));

		if (seconds === null) {
			throw new BridgeUserError({
				ar: "اكتب عدد الثواني كذا: Shutdown 30 رسالة",
				en: "Write the seconds first, like this: Shutdown 30 message",
			});
		}

		const message = line.args.slice(1).join(" ").trim();

		await sendShutdown(context, seconds, message.length === 0 ? SHUTDOWN_MESSAGE : message);

		return [
			`shutting down in ${String(seconds)}s`,
		];
	},

	async doexit(context) {
		await sendStop(context);

		return [
			"stopping now",
		];
	},
};

export const consoleHandler: NonNullable<Bridge.Terminal["run"]> = async (context, input) => {
	const line = parseConsoleLine(input);
	const command = consoleCommands[line.name];

	if (!command) {
		throw new BridgeUserError({
			ar: "ما نعرف هذا الأمر. جرّب أمر من قائمة الأوامر.",
			en: "That command does not exist. Try one from the command list.",
		});
	}

	const lines = await command(context, line);

	return {
		sent: input,
		line: lines.join("\n"),
		groups: {},
	};
};
