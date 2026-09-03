import { describe, expect, test } from "bun:test";
import { BridgeTerminalLevel } from "@serverkgg/bridge";
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
			"TeleportToPlayer",
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
				expect(arg.module).toBe("players");
				expect(arg.column).toBe("name");
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
