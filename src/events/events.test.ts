import { describe, expect, test } from "bun:test";
import { STEAM_APP_ID } from "../shared";
import { events } from "./events";

const emitted = (line: string) => {
	return events.patterns.flatMap((pattern) => {
		const match = pattern.match.exec(line);

		return match === null
			? []
			: [
					{
						emit: pattern.emit,
						groups: match.groups ?? {},
					},
				];
	});
};

const emits = (line: string) => {
	return emitted(line).map((event) => event.emit);
};

describe("reading the palworld log for the events the panel shows", () => {
	test("marks the server started once it prints the minidump line", () => {
		expect(emits(`[2026.09.03-12.00.00:000][  0]Setting breakpad minidump AppID = ${STEAM_APP_ID}`)).toEqual([
			"ServerStarted",
		]);
	});

	test("marks the server crashed on an unreal fatal error", () => {
		expect(
			emits("[2026.09.03-12.00.00:000][  0]LogWindows: Fatal error: [File:Runtime/Core/Private/Misc/Fork.cpp]"),
		).toEqual([
			"ServerCrashed",
		]);
	});

	test("marks the server crashed on a failed assertion", () => {
		expect(emits("Assertion failed: IsValid() [File:D:/build/Pal/Source/Pal/PalCharacter.cpp] [Line: 512]")).toEqual([
			"ServerCrashed",
		]);
	});

	test("carries the assertion text so the crash is readable in the panel", () => {
		expect(emitted("Assertion failed: IsValid() [File:PalCharacter.cpp] [Line: 512]").at(0)?.groups.detail).toBe(
			"IsValid() [File:PalCharacter.cpp] [Line: 512]",
		);
	});

	test("stops the assertion detail at the end of the line", () => {
		expect(emitted("Assertion failed: IsValid()\nLogPal: something else").at(0)?.groups.detail).toBe("IsValid()");
	});

	test("stays silent on the ordinary chatter a running server prints", () => {
		for (const line of [
			"[2026.09.03-12.00.00:000][  0]LogPal: Display: Save completed",
			"[2026.09.03-12.00.00:000][  0]LogNet: Join succeeded: Meslzy",
			"[2026.09.03-12.00.00:000][  0]LogPal: Warning: guild not found",
		]) {
			expect(emits(line)).toEqual([]);
		}
	});

	test("does not treat another game's minidump line as a start", () => {
		expect(emits("Setting breakpad minidump AppID = 730")).toEqual([]);
	});
});

describe("declaring the events the driver emits from outside the log", () => {
	test("declares the presence events the query loop emits", () => {
		expect(events.emits).toContain("PlayerJoined");
		expect(events.emits).toContain("PlayerLeft");
	});

	test("declares the stopping event the lifecycle emits", () => {
		expect(events.emits).toContain("ServerStopping");
	});

	test("does not redeclare an event a log pattern already emits", () => {
		for (const pattern of events.patterns) {
			expect(events.emits).not.toContain(pattern.emit);
		}
	});
});
