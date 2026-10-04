import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeTerminalLevel, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	consoleCommands,
	consoleHandler,
	findPlayer,
	infoLines,
	parseConsoleLine,
	rosterLines,
	shutdownSeconds,
} from "./consoleHandler";
import { terminal } from "./terminal";

const levelOf = (line: string) => {
	const rule = (terminal.rules ?? []).find((candidate) => candidate.match.test(line));

	return rule?.level ?? null;
};

describe("colouring a palworld log line in the terminal", () => {
	it("marks an unreal error line as an error", () => {
		expect(levelOf("[2026.09.03-12.00.00:000][  0]LogPal: Error: could not load the save")).toBe(
			BridgeTerminalLevel.Error,
		);
	});

	it("marks a fatal line as an error", () => {
		expect(levelOf("[2026.09.03-12.00.00:000][  0]LogWindows: Fatal: unhandled exception")).toBe(
			BridgeTerminalLevel.Error,
		);
	});

	it("marks a failed assertion as an error", () => {
		expect(levelOf("Assertion failed: IsValid() [File:PalCharacter.cpp]")).toBe(BridgeTerminalLevel.Error);
	});

	it("marks a warning line as a warning", () => {
		expect(levelOf("[2026.09.03-12.00.00:000][  0]LogPal: Warning: guild not found")).toBe(BridgeTerminalLevel.Warn);
	});

	it("leaves an ordinary line alone", () => {
		for (const line of [
			"[2026.09.03-12.00.00:000][  0]LogPal: Display: Save completed",
			"[2026.09.03-12.00.00:000][  0]LogNet: Join succeeded: Meslzy",
			"Setting breakpad minidump AppID = 2394010",
		]) {
			expect(levelOf(line)).toBeNull();
		}
	});

	it("reads an error before a warning when a line carries both", () => {
		expect(levelOf("LogPal: Error: Warning: both words on one line")).toBe(BridgeTerminalLevel.Error);
	});

	it("does not colour a line that merely mentions the word error", () => {
		expect(levelOf("[2026.09.03-12.00.00:000][  0]LogPal: Display: no error occurred")).toBeNull();
	});
});

describe("the commands an admin can run from the terminal", () => {
	const named = new Map(
		terminal.commands.map((command) => [
			command.name,
			command,
		]),
	);

	it("offers the palworld console commands the panel documents", () => {
		expect([
			...named.keys(),
		]).toEqual([
			"Broadcast",
			"ShowPlayers",
			"Info",
			"Save",
			"KickPlayer",
			"BanPlayer",
			"UnBanPlayer",
			"Shutdown",
			"DoExit",
		]);
	});

	it("warns before anything that removes a player or drops the world", () => {
		for (const name of [
			"BanPlayer",
			"Shutdown",
			"DoExit",
		]) {
			expect(named.get(name)?.danger).toBe(true);
		}
	});

	it("does not warn before a command that only reads or saves", () => {
		for (const name of [
			"Broadcast",
			"ShowPlayers",
			"Info",
			"Save",
			"UnBanPlayer",
		]) {
			expect(named.get(name)?.danger).toBeUndefined();
		}
	});

	it("completes every player argument from the live roster", () => {
		for (const command of terminal.commands) {
			for (const arg of command.args ?? []) {
				if (arg.key !== "player") {
					continue;
				}

				expect(arg.module).toBe("players");
				expect(arg.column).toBe("name");
				expect(arg.required).toBe(true);
			}
		}
	});

	it("declares the text every free-form command needs, so a bare command is never sent", () => {
		const named = new Map(
			terminal.commands.map((command) => [
				command.name,
				command,
			]),
		);

		expect(named.get("Broadcast")?.args?.map((arg) => arg.key)).toEqual([
			"message",
		]);
		expect(named.get("Shutdown")?.args?.map((arg) => arg.key)).toEqual([
			"seconds",
			"message",
		]);

		for (const command of terminal.commands) {
			for (const arg of command.args ?? []) {
				expect(arg.required).toBe(true);
			}
		}
	});

	it("gives every command that takes an argument a syntax line", () => {
		for (const command of terminal.commands) {
			if ((command.args ?? []).length > 0) {
				expect(command.syntax).toBeString();
			}
		}
	});

	it("writes every summary in both arabic and english", () => {
		for (const command of terminal.commands) {
			expect(command.summary.ar.length).toBeGreaterThan(0);
			expect(command.summary.en.length).toBeGreaterThan(0);
		}
	});
});

const ROSTER = {
	players: [
		{
			name: "Meslzy",
			userId: "steam_1",
			level: 42,
			ping: 31,
		},
		{
			name: "Nasser",
			userId: "steam_2",
		},
	],
};

const INFO = {
	version: "v0.6.0",
	servername: "Serverk Palworld",
	description: "a test server",
	worldguid: "A7E97BAA",
};

interface RestCall {
	path: string;
	body: string;
}

const restServer = (calls: RestCall[]) => {
	return Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			const path = new URL(request.url).pathname;

			calls.push({
				path,
				body: await request.text(),
			});

			if (path === "/v1/api/players") {
				return Response.json(ROSTER);
			}

			if (path === "/v1/api/info") {
				return Response.json(INFO);
			}

			return new Response("OK");
		},
	});
};

interface Emitted {
	event: string;
	payload: Bridge.Values | undefined;
}

const contextWith = (port: number, logged: string[], emitted: Emitted[], reported: Bridge.Activity[]) => {
	return {
		codec: {
			ueIni: {
				read: async () => ({
					AdminPassword: "s3cret",
					RESTAPIPort: port,
				}),
			},
		},
		secret: () => null,
		emit: (event: string, payload?: Bridge.Values) => {
			emitted.push({
				event,
				payload,
			});
		},
		activity: {
			report: (entry: Bridge.Activity) => {
				reported.push(entry);
			},
		},
		log: (message: string) => {
			logged.push(message);
		},
	} as unknown as Bridge.Context;
};

const run = async (input: string) => {
	const calls: RestCall[] = [];
	const logged: string[] = [];
	const emitted: Emitted[] = [];
	const reported: Bridge.Activity[] = [];
	const server = restServer(calls);

	try {
		const reply = await consoleHandler(contextWith(server.port ?? 0, logged, emitted, reported), input);

		return {
			calls,
			emitted,
			logged,
			reported,
			reply,
		};
	} finally {
		await server.stop(true);
	}
};

const refusalOf = async (input: string) => {
	try {
		await run(input);

		expect.unreachable();
	} catch (error) {
		expect(error).toBeInstanceOf(BridgeUserError);

		return (error as BridgeUserError).text;
	}
};

describe("reading a line an admin typed into the console", () => {
	it("splits the command from everything that follows it", () => {
		expect(parseConsoleLine("Broadcast hello world")).toEqual({
			name: "broadcast",
			rest: "hello world",
			args: [
				"hello",
				"world",
			],
		});
	});

	it("reads the command whatever case it was typed in", () => {
		for (const input of [
			"ShowPlayers",
			"showplayers",
			"SHOWPLAYERS",
		]) {
			expect(parseConsoleLine(input).name).toBe("showplayers");
		}
	});

	it("ignores the spacing around and inside the line", () => {
		expect(parseConsoleLine("   KickPlayer    steam_1   ")).toEqual({
			name: "kickplayer",
			rest: "steam_1",
			args: [
				"steam_1",
			],
		});
	});

	it("reads a command that carries nothing after it", () => {
		expect(parseConsoleLine("Save")).toEqual({
			name: "save",
			rest: "",
			args: [],
		});
	});
});

describe("mapping every declared command onto the rest api", () => {
	it("implements every command the panel offers", () => {
		for (const command of terminal.commands) {
			expect(consoleCommands[command.name.toLowerCase()]).toBeFunction();
		}
	});

	it("sends a broadcast as an announcement", async () => {
		const { calls, reply, logged } = await run("Broadcast serverk-e2e");

		expect(calls.at(-1)).toEqual({
			path: "/v1/api/announce",
			body: JSON.stringify({
				message: "serverk-e2e",
			}),
		});
		expect(reply?.line).toBe("broadcasted: serverk-e2e");
		expect(logged).toEqual([]);
	});

	it("refuses a broadcast with no message", async () => {
		expect((await refusalOf("Broadcast   "))?.en).toBe("Write the message first.");
	});

	it("saves the world, and says so, so a backup can trust the save happened", async () => {
		const { calls, emitted, reply } = await run("Save");

		expect(calls.at(-1)?.path).toBe("/v1/api/save");
		expect(reply?.line).toBe("complete save");
		expect(emitted.map((event) => event.event)).toEqual([
			BridgeEventName.WorldSaved,
		]);
	});

	it("answers ShowPlayers with the live roster", async () => {
		const { calls, reply } = await run("ShowPlayers");

		expect(calls.at(-1)?.path).toBe("/v1/api/players");
		expect(reply?.line).toBe("name,userid,level,ping\nMeslzy,steam_1,42,31\nNasser,steam_2,,");
	});

	it("answers Info with what the server reports about itself", async () => {
		const { calls, reply } = await run("Info");

		expect(calls.at(-1)?.path).toBe("/v1/api/info");
		expect(reply?.line).toContain("version: v0.6.0");
	});

	it("kicks the player the line names, and says who left", async () => {
		const { calls, emitted, reply } = await run("KickPlayer steam_1");

		expect(calls.map((call) => call.path)).toEqual([
			"/v1/api/players",
			"/v1/api/kick",
		]);
		expect(JSON.parse(calls.at(-1)?.body ?? "{}")).toMatchObject({
			userid: "steam_1",
		});
		expect(emitted.at(0)?.event).toBe(BridgeEventName.PlayerKicked);
		expect(reply?.line).toBe("kicked: Meslzy");
	});

	it("bans the player the line names by their in-game name", async () => {
		const { calls, emitted, reply } = await run("BanPlayer nasser");

		expect(calls.at(-1)?.path).toBe("/v1/api/ban");
		expect(JSON.parse(calls.at(-1)?.body ?? "{}")).toMatchObject({
			userid: "steam_2",
		});
		expect(emitted.at(0)?.event).toBe(BridgeEventName.PlayerBanned);
		expect(reply?.line).toBe("banned: Nasser");
	});

	it("bans a user id nobody on the roster carries, so an offline player can be banned", async () => {
		const { calls, emitted, logged, reply } = await run("BanPlayer steam_9");

		expect(calls.map((call) => call.path)).toEqual([
			"/v1/api/players",
			"/v1/api/ban",
		]);
		expect(JSON.parse(calls.at(-1)?.body ?? "{}")).toMatchObject({
			userid: "steam_9",
		});
		expect(emitted.at(0)).toEqual({
			event: BridgeEventName.PlayerBanned,
			payload: {
				player: "steam_9",
				userId: "steam_9",
				platform: "Steam",
			},
		});
		expect(logged.length).toBe(1);
		expect(reply?.line).toBe("banned: steam_9");
	});

	it("prefers the online player when the line names one, rather than banning the raw id", async () => {
		const { emitted, logged, reply } = await run("BanPlayer steam_1");

		expect(emitted.at(0)?.payload).toMatchObject({
			player: "Meslzy",
		});
		expect(logged).toEqual([]);
		expect(reply?.line).toBe("banned: Meslzy");
	});

	it("refuses to ban a name that is neither online nor a user id", async () => {
		expect((await refusalOf("BanPlayer ghost"))?.en).toContain("write their user ID");
	});

	it("lifts a ban from the user id the line names", async () => {
		const { calls, emitted, reply } = await run("UnBanPlayer steam_9");

		expect(calls.at(-1)).toEqual({
			path: "/v1/api/unban",
			body: JSON.stringify({
				userid: "steam_9",
			}),
		});
		expect(emitted).toEqual([]);
		expect(reply?.line).toBe("unbanned: steam_9");
	});

	it("refuses an unban that names anything but a user id", async () => {
		for (const input of [
			"UnBanPlayer",
			"UnBanPlayer Meslzy",
			"UnBanPlayer 76561198000000001",
		]) {
			expect((await refusalOf(input))?.en).toContain("That isn't a user ID");
		}
	});

	it("refuses to kick a player who is not online", async () => {
		expect((await refusalOf("KickPlayer ghost"))?.en).toBe("No player with that name is online right now.");
	});

	it("refuses to kick nobody at all", async () => {
		expect((await refusalOf("KickPlayer"))?.en).toBe("Write the player name or ID first.");
	});

	it("shuts the server down after the delay the line asks for", async () => {
		const { calls, reply } = await run("Shutdown 30 be right back");

		expect(calls.at(-1)).toEqual({
			path: "/v1/api/shutdown",
			body: JSON.stringify({
				waittime: 30,
				message: "be right back",
			}),
		});
		expect(reply?.line).toBe("shutting down in 30s");
	});

	it("falls back to the platform's own message when the line carries none", async () => {
		const { calls } = await run("Shutdown 30");

		expect(JSON.parse(calls.at(-1)?.body ?? "{}")).toMatchObject({
			message: "The server is shutting down.",
		});
	});

	it("refuses a shutdown that names no delay", async () => {
		for (const input of [
			"Shutdown",
			"Shutdown now",
			"Shutdown -5",
		]) {
			expect((await refusalOf(input))?.en).toContain("Write the seconds first");
		}
	});

	it("stops the server outright on DoExit", async () => {
		const { calls, reply } = await run("DoExit");

		expect(calls.at(-1)?.path).toBe("/v1/api/stop");
		expect(reply?.line).toBe("stopping now");
	});
});

describe("answering a line the rest api cannot serve", () => {
	it("never offers TeleportToPlayer, because the panel has no character to teleport", () => {
		expect(terminal.commands.map((command) => command.name)).not.toContain("TeleportToPlayer");
	});

	it("still explains TeleportToPlayer to anyone who types it", async () => {
		const text = await refusalOf("TeleportToPlayer Meslzy");

		expect(text?.en).toContain("only works inside the game");
		expect(text?.ar.length ?? 0).toBeGreaterThan(0);
	});

	it("refuses an unknown line instead of writing it to a stdin nothing reads", async () => {
		const text = await refusalOf("op Meslzy");

		expect(text?.en).toBe("That command doesn't exist. Try one from the command list.");
		expect(text?.ar.length ?? 0).toBeGreaterThan(0);
	});
});

describe("formatting what the rest api answers back", () => {
	it("prints one line per player under a header", () => {
		expect(
			rosterLines([
				{
					id: "steam_1",
					name: "Meslzy",
					account: "meslzy",
					platform: "Steam",
					level: 42,
					ping: 31,
					buildings: 7,
					avatarHash: null,
				},
			]),
		).toEqual([
			"name,userid,level,ping",
			"Meslzy,steam_1,42,31",
		]);
	});

	it("says nobody is online rather than printing an empty table", () => {
		expect(rosterLines([])).toEqual([
			"no players online",
		]);
	});

	it("prints the four fields the info endpoint carries", () => {
		expect(infoLines(INFO)).toEqual([
			"version: v0.6.0",
			"name: Serverk Palworld",
			"description: a test server",
			"world: A7E97BAA",
		]);
	});

	it("finds a player by id or by name, whatever case was typed", () => {
		const players = [
			{
				id: "steam_1",
				name: "Meslzy",
				account: null,
				platform: "Steam",
				level: null,
				ping: null,
				buildings: null,
				avatarHash: null,
			},
		];

		for (const needle of [
			"steam_1",
			"STEAM_1",
			"meslzy",
		]) {
			expect(findPlayer(players, needle)?.id).toBe("steam_1");
		}

		expect(findPlayer(players, "ghost")).toBeNull();
	});

	it("takes a shutdown delay only when it is a real number of seconds", () => {
		expect(shutdownSeconds("30")).toBe(30);
		expect(shutdownSeconds("3600")).toBe(3600);

		for (const raw of [
			undefined,
			"",
			"0",
			"-5",
			"3601",
			"30s",
			"soon",
		]) {
			expect(shutdownSeconds(raw)).toBeNull();
		}
	});
});

describe("telling the owner what a console command changed", () => {
	it("reports a kick once, with the player it names", async () => {
		const { reported } = await run("KickPlayer steam_1");

		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.PlayerKicked,
		]);
		expect(reported.at(0)?.subject).toBe("Meslzy");
		expect(reported.at(0)?.text.en).toBe("Kicked Meslzy (Steam)");
	});

	it("reports a ban once, whether the player is online or only a user id", async () => {
		for (const input of [
			"BanPlayer nasser",
			"BanPlayer steam_9",
		]) {
			const { reported } = await run(input);

			expect(reported.map((entry) => entry.name)).toEqual([
				BridgeEventName.PlayerBanned,
			]);
		}
	});

	it("reports an unban once, by the user id when no name can be found", async () => {
		const { reported } = await run("UnBanPlayer steam_9");

		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.PlayerUnbanned,
		]);
		expect(reported.at(0)?.subject).toBe("steam_9");
	});

	it("reports a broadcast once, as an excerpt", async () => {
		const { reported } = await run(`Broadcast ${"a".repeat(150)}`);

		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.BroadcastSent,
		]);
		expect(reported.at(0)?.text.en).not.toContain("a".repeat(100));
	});

	it("reports a save once, beside the save event a backup waits for", async () => {
		const { emitted, reported } = await run("Save");

		expect(emitted.map((event) => event.event)).toEqual([
			BridgeEventName.WorldSaved,
		]);
		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.GameplayChanged,
		]);
	});

	it("reports nothing for a command that only reads", async () => {
		for (const input of [
			"ShowPlayers",
			"Info",
		]) {
			expect((await run(input)).reported).toEqual([]);
		}
	});

	it("never puts the admin password into what it reports", async () => {
		for (const input of [
			"KickPlayer steam_1",
			"BanPlayer steam_9",
			"UnBanPlayer steam_9",
			"Broadcast hello",
			"Save",
		]) {
			expect(JSON.stringify((await run(input)).reported)).not.toContain("s3cret");
		}
	});
});
