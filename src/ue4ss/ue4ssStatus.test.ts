import { describe, expect, test } from "bun:test";
import { headlessRefusal, logLines, UE4SS_HEADLESS_REFUSALS, ue4ssStatusOf } from "./ue4ssStatus";

const BOOT = [
	"[14:22:01] Console created",
	"[14:22:01] UE4SS - v3.0.1 - Git SHA #4bf136e",
	"[14:22:01]  Copyright (c) 2026 BlackBookOfficial",
	"[14:22:02] Palworld vtable sweep: 505 vtables, BeginPlay slot 0x388 (261/505); candidate 0x9f778f0 (261/505), EndPlay 0x9f64320 (259/505)",
	"[14:22:02] Palworld vtable sweep: BeginPlay 0x380 -> 0x388, EndPlay 0x388 -> 0x390",
	"[14:22:03] Starting mods (from mods.txt (Mods/mods.txt) load order)...",
	"[14:22:03] Starting Lua mod 'BPModLoaderMod'",
	"[14:22:03] Starting Lua mod 'ConsoleCommandsMod'",
].join("\n");

const REFUSED_LINE =
	"[14:22:02] Palworld hook validation REFUSED AGameModeBase::InitGameState at 0xa3b5000: no sane prologue (game updated? hook left disabled)";

const VIEWPORT_REFUSED_LINE =
	"[14:22:02] Palworld hook validation REFUSED UGameViewportClient::Tick at 0xa422eb0: target reads extra int-arg registers (crash class: float/int register mismatch, hook left disabled)";

const NOTE_LINE =
	"[14:22:02] Palworld hook validation NOTE UEngine::Tick at 0xaa39580: target reads 1 extra int-arg register(s) beyond the detour signature; installing anyway (trampoline pass-through).";

describe("splitting the log the port writes beside the library", () => {
	test("drops the blank lines and keeps the rest", () => {
		expect(logLines("one\n\n  \ntwo\n")).toEqual([
			"one",
			"two",
		]);
	});
});

describe("reading whether ue4ss really loaded", () => {
	test("takes the banner as proof the library came up, and reads its version", () => {
		const status = ue4ssStatusOf(logLines(BOOT));

		expect(status.loaded).toBe(true);
		expect(status.version).toBe("3.0.1");
	});

	test("says it never loaded when the banner is not there", () => {
		expect(
			ue4ssStatusOf([
				"[14:22:01] Console created",
			]).loaded,
		).toBe(false);
	});

	test("counts the self-healing sweeps the port prints after a game update", () => {
		expect(ue4ssStatusOf(logLines(BOOT)).sweeps).toBe(2);
	});

	test("names every mod the loader started, once each", () => {
		expect(
			ue4ssStatusOf([
				...logLines(BOOT),
				"[14:25:00] New Lua mod detected: 'AdminCommands', starting...",
				"[14:26:00] Starting Lua mod 'BPModLoaderMod'",
			]).modsLoaded,
		).toEqual([
			"BPModLoaderMod",
			"ConsoleCommandsMod",
			"AdminCommands",
		]);
	});
});

describe("reading the hooks a game update left disabled", () => {
	test("names a refused hook with the reason the port gave", () => {
		const status = ue4ssStatusOf([
			REFUSED_LINE,
		]);

		expect(status.refused).toEqual([
			"AGameModeBase::InitGameState at 0xa3b5000: no sane prologue (game updated? hook left disabled)",
		]);
		expect(status.notes).toEqual([]);
	});

	test("keeps a note apart from a refusal, because a noted hook still installed", () => {
		const status = ue4ssStatusOf([
			NOTE_LINE,
		]);

		expect(status.refused).toEqual([]);
		expect(status.notes.at(0)).toContain("UEngine::Tick");
	});

	test("never repeats the same refusal twice across two boots in one log", () => {
		expect(
			ue4ssStatusOf([
				REFUSED_LINE,
				REFUSED_LINE,
			]).refused.length,
		).toBe(1);
	});

	test("passes over the viewport tick, a hook a dedicated server never draws, and keeps the line as a note", () => {
		const status = ue4ssStatusOf([
			VIEWPORT_REFUSED_LINE,
		]);

		expect(status.refused).toEqual([]);
		expect(status.notes.at(0)).toContain("UGameViewportClient::Tick");
	});

	test("still counts every other refusal in the same log as a refusal", () => {
		const status = ue4ssStatusOf([
			VIEWPORT_REFUSED_LINE,
			REFUSED_LINE,
		]);

		expect(status.refused).toEqual([
			"AGameModeBase::InitGameState at 0xa3b5000: no sane prologue (game updated? hook left disabled)",
		]);
		expect(status.notes.length).toBe(1);
	});

	test("names the hooks a headless server is allowed to lose", () => {
		expect(UE4SS_HEADLESS_REFUSALS).toEqual([
			"UGameViewportClient::Tick",
		]);
		expect(headlessRefusal("UGameViewportClient::Tick at 0xa422eb0: whatever the port said")).toBe(true);
		expect(headlessRefusal("AGameModeBase::InitGameState at 0xa3b5000: no sane prologue")).toBe(false);
	});

	test("answers a clean boot with nothing refused and nothing noted", () => {
		const status = ue4ssStatusOf(logLines(BOOT));

		expect(status.refused).toEqual([]);
		expect(status.notes).toEqual([]);
	});
});
