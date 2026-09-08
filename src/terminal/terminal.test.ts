import { describe, expect, test } from "bun:test";
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
	test("marks an unreal error line as an error", () => {
		expect(levelOf("[2026.09.03-12.00.00:000][  0]LogPal: Error: could not load the save")).toBe(
			BridgeTerminalLevel.Error,
		);
	});

	test("marks a fatal line as an error", () => {
		expect(levelOf("[2026.09.03-12.00.00:000][  0]LogWindows: Fatal: unhandled exception")).toBe(
			BridgeTerminalLevel.Error,
		);
	});

	test("marks a failed assertion as an error", () => {
		expect(levelOf("Assertion failed: IsValid() [File:PalCharacter.cpp]")).toBe(BridgeTerminalLevel.Error);
	});

	test("marks a warning line as a warning", () => {
		expect(levelOf("[2026.09.03-12.00.00:000][  0]LogPal: Warning: guild not found")).toBe(BridgeTerminalLevel.Warn);
	});

	test("leaves an ordinary line alone", () => {
		for (const line of [
			"[2026.09.03-12.00.00:000][  0]LogPal: Display: Save completed",
			"[2026.09.03-12.00.00:000][  0]LogNet: Join succeeded: Meslzy",
			"Setting breakpad minidump AppID = 2394010",
		]) {
			expect(levelOf(line)).toBeNull();
		}
	});

	test("reads an error before a warning when a line carries both", () => {
		expect(levelOf("LogPal: Error: Warning: both words on one line")).toBe(BridgeTerminalLevel.Error);
	});

	test("does not colour a line that merely mentions the word error", () => {
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

	test("offers the palworld console commands the panel documents", () => {
		expect([
			...named.keys(),
		]).toEqual([
			"Broadcast",
			"ShowPlayers",
			"Info",
			"Save",
			"KickPlayer",
			"BanPlayer",
			"Shutdown",
			"DoExit",
		]);
	});

	test("warns before anything that removes a player or drops the world", () => {
		for (const name of [
			"BanPlayer",
			"Shutdown",
			"DoExit",
		]) {
			expect(named.get(name)?.danger).toBe(true);
		}
	});

	test("does not warn before a command that only reads or saves", () => {
		for (const name of [
			"Broadcast",
			"ShowPlayers",
			"Info",
			"Save",
		]) {
			expect(named.get(name)?.danger).toBeUndefined();
		}
	});

	test("completes every player argument from the live roster", () => {
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

	test("declares the text every free-form command needs, so a bare command is never sent", () => {
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

	test("gives every command that takes an argument a syntax line", () => {
		for (const command of terminal.commands) {
			if ((command.args ?? []).length > 0) {
				expect(command.syntax).toBeString();
			}
		}
	});

	test("writes every summary in both arabic and english", () => {
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

const contextWith = (port: number, logged: string[], emitted: Emitted[]) => {
	return {
		codec: {
			ueIni: {
				read: async () => ({
					AdminPassword: "s3cret",
					RESTAPIPort: port,
				}),
			},
		},
		emit: (event: string, payload?: Bridge.Values) => {
			emitted.push({
				event,
				payload,
			});
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
	const server = restServer(calls);

	try {
		const reply = await consoleHandler(contextWith(server.port ?? 0, logged, emitted), input);

		return {
			calls,
			emitted,
			logged,
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
	test("splits the command from everything that follows it", () => {
		expect(parseConsoleLine("Broadcast hello world")).toEqual({
			name: "broadcast",
			rest: "hello world",
			args: [
				"hello",
				"world",
			],
		});
	});

	test("reads the command whatever case it was typed in", () => {
		for (const input of [
			"ShowPlayers",
			"showplayers",
			"SHOWPLAYERS",
		]) {
			expect(parseConsoleLine(input).name).toBe("showplayers");
		}
	});

	test("ignores the spacing around and inside the line", () => {
		expect(parseConsoleLine("   KickPlayer    steam_1   ")).toEqual({
			name: "kickplayer",
			rest: "steam_1",
			args: [
				"steam_1",
			],
		});
	});

	test("reads a command that carries nothing after it", () => {
		expect(parseConsoleLine("Save")).toEqual({
			name: "save",
			rest: "",
			args: [],
		});
	});
});

describe("mapping every declared command onto the rest api", () => {
	test("implements every command the panel offers", () => {
		for (const command of terminal.commands) {
			expect(consoleCommands[command.name.toLowerCase()]).toBeFunction();
		}
	});

	test("sends a broadcast as an announcement", async () => {
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

	test("refuses a broadcast with no message", async () => {
		expect((await refusalOf("Broadcast   "))?.en).toBe("Write the message first.");
	});

	test("saves the world", async () => {
		const { calls, reply } = await run("Save");

		expect(calls.at(-1)?.path).toBe("/v1/api/save");
		expect(reply?.line).toBe("complete save");
	});

	test("answers ShowPlayers with the live roster", async () => {
		const { calls, reply } = await run("ShowPlayers");

		expect(calls.at(-1)?.path).toBe("/v1/api/players");
		expect(reply?.line).toBe("name,userid,level,ping\nMeslzy,steam_1,42,31\nNasser,steam_2,,");
	});

	test("answers Info with what the server reports about itself", async () => {
		const { calls, reply } = await run("Info");

		expect(calls.at(-1)?.path).toBe("/v1/api/info");
		expect(reply?.line).toContain("version: v0.6.0");
	});

	test("kicks the player the line names, and says who left", async () => {
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

	test("bans the player the line names by their in-game name", async () => {
		const { calls, emitted, reply } = await run("BanPlayer nasser");

		expect(calls.at(-1)?.path).toBe("/v1/api/ban");
		expect(JSON.parse(calls.at(-1)?.body ?? "{}")).toMatchObject({
			userid: "steam_2",
		});
		expect(emitted.at(0)?.event).toBe(BridgeEventName.PlayerBanned);
		expect(reply?.line).toBe("banned: Nasser");
	});

	test("refuses to kick a player who is not online", async () => {
		expect((await refusalOf("KickPlayer ghost"))?.en).toBe("No player with that name is online right now.");
	});

	test("refuses to kick nobody at all", async () => {
		expect((await refusalOf("KickPlayer"))?.en).toBe("Write the player name or id first.");
	});

	test("shuts the server down after the delay the line asks for", async () => {
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

	test("falls back to the platform's own message when the line carries none", async () => {
		const { calls } = await run("Shutdown 30");

		expect(JSON.parse(calls.at(-1)?.body ?? "{}")).toMatchObject({
			message: "The server is shutting down.",
		});
	});

	test("refuses a shutdown that names no delay", async () => {
		for (const input of [
			"Shutdown",
			"Shutdown now",
			"Shutdown -5",
		]) {
			expect((await refusalOf(input))?.en).toContain("Write the seconds first");
		}
	});

	test("stops the server outright on DoExit", async () => {
		const { calls, reply } = await run("DoExit");

		expect(calls.at(-1)?.path).toBe("/v1/api/stop");
		expect(reply?.line).toBe("stopping now");
	});
});

describe("answering a line the rest api cannot serve", () => {
	test("never offers TeleportToPlayer, because the panel has no character to teleport", () => {
		expect(terminal.commands.map((command) => command.name)).not.toContain("TeleportToPlayer");
	});

	test("still explains TeleportToPlayer to anyone who types it", async () => {
		const text = await refusalOf("TeleportToPlayer Meslzy");

		expect(text?.en).toContain("only works inside the game");
		expect(text?.ar.length ?? 0).toBeGreaterThan(0);
	});

	test("refuses an unknown line instead of writing it to a stdin nothing reads", async () => {
		const text = await refusalOf("op Meslzy");

		expect(text?.en).toBe("That command does not exist. Try one from the command list.");
		expect(text?.ar.length ?? 0).toBeGreaterThan(0);
	});
});

describe("formatting what the rest api answers back", () => {
	test("prints one line per player under a header", () => {
		expect(
			rosterLines([
				{
					id: "steam_1",
					name: "Meslzy",
					level: 42,
					ping: 31,
				},
			]),
		).toEqual([
			"name,userid,level,ping",
			"Meslzy,steam_1,42,31",
		]);
	});

	test("says nobody is online rather than printing an empty table", () => {
		expect(rosterLines([])).toEqual([
			"no players online",
		]);
	});

	test("prints the four fields the info endpoint carries", () => {
		expect(infoLines(INFO)).toEqual([
			"version: v0.6.0",
			"name: Serverk Palworld",
			"description: a test server",
			"world: A7E97BAA",
		]);
	});

	test("finds a player by id or by name, whatever case was typed", () => {
		const players = [
			{
				id: "steam_1",
				name: "Meslzy",
				level: null,
				ping: null,
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

	test("takes a shutdown delay only when it is a real number of seconds", () => {
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
