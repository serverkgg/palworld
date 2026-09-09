import { describe, expect, test } from "bun:test";
import {
	enabledMods,
	folderNames,
	formatModLine,
	headlessMods,
	headlessOverrides,
	mergeModsList,
	parseModLine,
	parseModsList,
	UE4SS_HEADLESS_MODS,
	UE4SS_HEADLESS_SETTINGS,
	writeModsList,
} from "./ue4ssSettings";

const SHIPPED = [
	"CheatManagerEnablerMod : 1",
	"ActorDumperMod : 0",
	"ConsoleCommandsMod : 1",
	"ConsoleEnablerMod : 1",
	"SplitScreenMod : 0",
	"LineTraceMod : 1",
	"BPML_GenericFunctions : 1",
	"BPModLoaderMod : 1",
	"jsbLuaProfilerMod : 0",
	"",
	"",
	"; Built-in keybinds, do not move up!",
	"Keybinds : 1",
	"",
].join("\n");

describe("reading one line of the list ue4ss loads mods from", () => {
	test("reads the name and the switch the game writes", () => {
		expect(parseModLine("BPModLoaderMod : 1")).toEqual({
			name: "BPModLoaderMod",
			enabled: true,
		});
		expect(parseModLine("ActorDumperMod : 0")).toEqual({
			name: "ActorDumperMod",
			enabled: false,
		});
	});

	test("reads a line however the spacing was typed", () => {
		expect(parseModLine("   BPModLoaderMod:1   ")).toEqual({
			name: "BPModLoaderMod",
			enabled: true,
		});
	});

	test("skips anything ue4ss itself skips", () => {
		for (const line of [
			"",
			"   ",
			"; Built-in keybinds, do not move up!",
			"Keybinds : 1 ; still off",
			"BPModLoaderMod",
			"BPModLoaderMod : 2",
			"My Mod : 1",
		]) {
			expect(parseModLine(line)).toBeNull();
		}
	});

	test("writes a line back in the shape the shipped file uses", () => {
		expect(
			formatModLine({
				name: "Keybinds",
				enabled: false,
			}),
		).toBe("Keybinds : 0");
	});
});

describe("reading the whole list", () => {
	test("reads every mod the shipped file names", () => {
		expect(parseModsList(SHIPPED).map((mod) => mod.name)).toEqual([
			"CheatManagerEnablerMod",
			"ActorDumperMod",
			"ConsoleCommandsMod",
			"ConsoleEnablerMod",
			"SplitScreenMod",
			"LineTraceMod",
			"BPML_GenericFunctions",
			"BPModLoaderMod",
			"jsbLuaProfilerMod",
			"Keybinds",
		]);
	});

	test("names only the mods that are switched on", () => {
		expect(enabledMods(SHIPPED)).toEqual([
			"CheatManagerEnablerMod",
			"ConsoleCommandsMod",
			"ConsoleEnablerMod",
			"LineTraceMod",
			"BPML_GenericFunctions",
			"BPModLoaderMod",
			"Keybinds",
		]);
	});
});

describe("writing the list back", () => {
	test("flips only the mods it was handed", () => {
		const next = writeModsList(SHIPPED, {
			Keybinds: false,
		});

		expect(next).toContain("Keybinds : 0");
		expect(next).toContain("BPModLoaderMod : 1");
	});

	test("keeps the comments and the blank lines the shipped file carries", () => {
		const next = writeModsList(SHIPPED, {
			Keybinds: false,
		});

		expect(next).toContain("; Built-in keybinds, do not move up!");
		expect(next.split("\n").filter((line) => line.length === 0).length).toBeGreaterThan(0);
	});

	test("keeps the order the file already had", () => {
		expect(
			parseModsList(
				writeModsList(SHIPPED, {
					Keybinds: false,
				}),
			).map((mod) => mod.name),
		).toEqual(parseModsList(SHIPPED).map((mod) => mod.name));
	});

	test("adds a mod the file never named, so an upload lands in the list", () => {
		const next = writeModsList(SHIPPED, {
			AdminCommands: true,
		});

		expect(next).toContain("AdminCommands : 1");
		expect(parseModsList(next).length).toBe(parseModsList(SHIPPED).length + 1);
	});

	test("writes a list for a server that had none", () => {
		expect(
			writeModsList("", {
				AdminCommands: true,
			}),
		).toBe("AdminCommands : 1\n");
	});

	test("ends with exactly one newline, the way the shipped file does", () => {
		expect(writeModsList(SHIPPED, {}).endsWith("\n")).toBe(true);
		expect(writeModsList(SHIPPED, {}).endsWith("\n\n")).toBe(false);
	});
});

describe("merging the shipped list into the one the owner already has", () => {
	test("takes the shipped list whole on a first install", () => {
		expect(mergeModsList(SHIPPED, null)).toBe(SHIPPED);
	});

	test("keeps the owner's own switch on every mod both lists name", () => {
		const owner = "BPModLoaderMod : 0\nAdminCommands : 1\n";

		expect(parseModsList(mergeModsList(SHIPPED, owner))).toContainEqual({
			name: "BPModLoaderMod",
			enabled: false,
		});
		expect(parseModsList(mergeModsList(SHIPPED, owner))).toContainEqual({
			name: "AdminCommands",
			enabled: true,
		});
	});

	test("adds the shipped mods the owner's list never named", () => {
		const merged = parseModsList(mergeModsList(SHIPPED, "BPModLoaderMod : 0\n")).map((mod) => mod.name);

		for (const name of parseModsList(SHIPPED).map((mod) => mod.name)) {
			expect(merged).toContain(name);
		}
	});
});

describe("keeping ue4ss headless on a server with no screen", () => {
	const sectionOf = (name: string) => {
		return UE4SS_HEADLESS_SETTINGS.find((entry) => entry.section === name);
	};

	test("turns both gui windows off and leaves the console writing to stdout", () => {
		expect(sectionOf("Debug")?.values).toEqual({
			ConsoleEnabled: "1",
			GuiConsoleEnabled: "0",
			GuiConsoleVisible: "0",
		});
	});

	test("asks ue4ss not to hook the viewport tick, the one hook a server with no viewport gets refused", () => {
		expect(sectionOf("Hooks")?.values).toEqual({
			HookGameViewportClientTick: "0",
		});
	});

	test("says in the log why every headless section was written", () => {
		for (const entry of UE4SS_HEADLESS_SETTINGS) {
			expect(entry.reason.length).toBeGreaterThan(0);
		}
	});

	test("merges the viewport hook only because the shipped file really carries that key", () => {
		expect(
			headlessOverrides(
				{
					HookEngineTick: "1",
					HookGameViewportClientTick: "1",
				},
				sectionOf("Hooks")?.values ?? {},
			),
		).toEqual({
			HookGameViewportClientTick: "0",
		});
	});

	test("merges only keys the shipped file really carries", () => {
		expect(
			headlessOverrides(
				{
					ConsoleEnabled: "1",
					GuiConsoleFontScaling: "1",
				},
				{
					ConsoleEnabled: "0",
					GuiConsoleEnabled: "0",
					GuiConsoleVisible: "0",
				},
			),
		).toEqual({
			ConsoleEnabled: "0",
		});
	});

	test("writes nothing when the section holds none of them", () => {
		expect(
			headlessOverrides(
				{},
				{
					ConsoleEnabled: "0",
				},
			),
		).toEqual({});
	});

	test("turns off the mods a dedicated server cannot run, and leaves the rest as shipped", () => {
		expect(UE4SS_HEADLESS_MODS).toEqual([
			"Keybinds",
			"SplitScreenMod",
		]);
		expect(headlessMods(SHIPPED)).toEqual({
			Keybinds: false,
			SplitScreenMod: false,
		});
	});

	test("never adds a mod line for a mod the list does not name", () => {
		expect(headlessMods("BPModLoaderMod : 1\n")).toEqual({});
	});
});

describe("reading the mod folders off the volume", () => {
	test("takes one folder name per line and sorts them", () => {
		expect(folderNames("shared\nBPModLoaderMod\n\n  Keybinds  \n")).toEqual([
			"BPModLoaderMod",
			"Keybinds",
			"shared",
		]);
	});

	test("answers nothing for an empty listing", () => {
		expect(folderNames("")).toEqual([]);
	});
});
