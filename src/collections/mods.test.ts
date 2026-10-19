import { describe, expect, it } from "bun:test";
import { PalworldEdition, PalworldModKind } from "../shared";
import { bundledUploadOf, type ModStatus, stagedPathOf, stateOf, uploadedModsOf } from "./mods";

const STAGED = ".serverk-staging/mod-upload/RefinedRanches";

const NEXUS_STAGED = ".serverk-staging/mod-upload/RefinedRanches Lean 5069 1 2026-08-13T06-05Z Ab1rBHP6A";

const UE4SS_RELEASE = [
	`${STAGED}/dwmapi.dll`,
	`${STAGED}/ue4ss/UE4SS.dll`,
	`${STAGED}/ue4ss/UE4SS-settings.ini`,
	`${STAGED}/ue4ss/Mods/mods.txt`,
	`${STAGED}/ue4ss/Mods/BPModLoaderMod/Scripts/main.lua`,
	`${STAGED}/ue4ss/Mods/BPML_GenericFunctions/Scripts/main.lua`,
	`${STAGED}/ue4ss/Mods/CheatManagerEnablerMod/Scripts/main.lua`,
	`${STAGED}/ue4ss/Mods/ConsoleCommandsMod/Scripts/main.lua`,
	`${STAGED}/ue4ss/Mods/ConsoleEnablerMod/Scripts/main.lua`,
	`${STAGED}/ue4ss/Mods/Keybinds/Scripts/main.lua`,
	`${STAGED}/ue4ss/Mods/LineTraceMod/Scripts/main.lua`,
	`${STAGED}/ue4ss/Mods/SplitScreenMod/Scripts/main.lua`,
	`${STAGED}/ue4ss/Mods/shared/Types.lua`,
	`${STAGED}/ue4ss/Mods/shared/main.lua`,
];

describe("stagedPathOf", () => {
	it("accepts a path inside the mod upload staging folder", () => {
		expect(stagedPathOf(` ${STAGED} `)).toEqual(STAGED);
	});

	it("refuses a path outside staging or one that climbs out of it", () => {
		for (const input of [
			"Pal/Saved/SaveGames",
			"/home/container/.serverk-staging/mod-upload/a.zip",
			".serverk-staging/mod-upload/../../Pal",
			".serverk-staging/mod-upload",
		]) {
			expect(stagedPathOf(input)).toEqual(null);
		}
	});
});

describe("uploadedModsOf", () => {
	it("reads a steam workshop package by its Info.json", () => {
		expect(
			uploadedModsOf(
				[
					`${STAGED}/CreativeMenu/Info.json`,
					`${STAGED}/CreativeMenu/Paks/creative.pak`,
				],
				STAGED,
			),
		).toEqual([
			{
				kind: PalworldModKind.Workshop,
				folder: "CreativeMenu",
				root: `${STAGED}/CreativeMenu`,
			},
		]);
	});

	it("reads a palschema mod zipped with the full ue4ss path, and skips the bundled palschema", () => {
		expect(
			uploadedModsOf(
				[
					`${STAGED}/ue4ss/Mods/PalSchema/dlls/main.dll`,
					`${STAGED}/ue4ss/Mods/PalSchema/mods/RefinedRanches/raw/ranch.json`,
					`${STAGED}/ue4ss/Mods/PalSchema/mods/RefinedRanches/translations/en/text.json`,
				],
				STAGED,
			),
		).toEqual([
			{
				kind: PalworldModKind.PalSchema,
				folder: "RefinedRanches",
				root: `${STAGED}/ue4ss/Mods/PalSchema/mods/RefinedRanches`,
			},
		]);
	});

	it("names a palschema mod zipped without its folder after the uploaded file", () => {
		expect(
			uploadedModsOf(
				[
					`${STAGED}/raw/ranch.json`,
				],
				STAGED,
			),
		).toEqual([
			{
				kind: PalworldModKind.PalSchema,
				folder: "RefinedRanches",
				root: STAGED,
			},
		]);
	});

	it("reads a lua mod and a c++ mod by their entry points", () => {
		expect(
			uploadedModsOf(
				[
					`${STAGED}/BetterChat/Scripts/main.lua`,
					`${STAGED}/FastCraft/dlls/main.dll`,
				],
				STAGED,
			),
		).toEqual([
			{
				kind: PalworldModKind.Ue4ss,
				folder: "BetterChat",
				root: `${STAGED}/BetterChat`,
			},
			{
				kind: PalworldModKind.Ue4ss,
				folder: "FastCraft",
				root: `${STAGED}/FastCraft`,
			},
		]);
	});

	it("names a mod downloaded from nexus after the mod, without the id, version and timestamp nexus adds", () => {
		expect(
			uploadedModsOf(
				[
					`${NEXUS_STAGED}/raw/ranch.json`,
				],
				NEXUS_STAGED,
			),
		).toEqual([
			{
				kind: PalworldModKind.PalSchema,
				folder: "RefinedRanches Lean",
				root: NEXUS_STAGED,
			},
		]);
	});

	it("skips the mods bundled in the ue4ss release", () => {
		expect(uploadedModsOf(UE4SS_RELEASE, STAGED)).toEqual([]);
	});

	it("keeps the customer's mod zipped beside the ue4ss release", () => {
		expect(
			uploadedModsOf(
				[
					...UE4SS_RELEASE,
					`${STAGED}/ue4ss/Mods/BetterChat/Scripts/main.lua`,
				],
				STAGED,
			),
		).toEqual([
			{
				kind: PalworldModKind.Ue4ss,
				folder: "BetterChat",
				root: `${STAGED}/ue4ss/Mods/BetterChat`,
			},
		]);
	});

	it("finds nothing in a palschema folder zipped without the folder around its files", () => {
		const staged = ".serverk-staging/mod-upload/raw";

		expect(
			uploadedModsOf(
				[
					`${staged}/ranch.json`,
					`${staged}/pals.jsonc`,
				],
				staged,
			),
		).toEqual([]);
	});

	it("finds nothing in an archive with no mod in it", () => {
		expect(
			uploadedModsOf(
				[
					`${STAGED}/readme.txt`,
				],
				STAGED,
			),
		).toEqual([]);
	});
});

describe("bundledUploadOf", () => {
	it("recognises the ue4ss release and the palschema release", () => {
		expect(bundledUploadOf(UE4SS_RELEASE)).toEqual(true);

		expect(
			bundledUploadOf([
				`${STAGED}/ue4ss/Mods/PalSchema/dlls/main.dll`,
			]),
		).toEqual(true);
	});

	it("does not mistake an archive with no mod in it for ue4ss", () => {
		expect(
			bundledUploadOf([
				`${STAGED}/readme.txt`,
			]),
		).toEqual(false);
	});
});

describe("stateOf", () => {
	const status = (overrides: Partial<ModStatus>): ModStatus => {
		return {
			enabled: true,
			server: true,
			deployed: true,
			started: true,
			loaded: true,
			...overrides,
		};
	};

	it("says a mod runs on windows only while the server is on linux", () => {
		expect(stateOf(PalworldEdition.Linux, status({})).en).toEqual("Runs on Windows only");
	});

	it("confirms a mod only when the last start loaded it", () => {
		expect(
			[
				stateOf(PalworldEdition.Windows, status({})),
				stateOf(
					PalworldEdition.Windows,
					status({
						loaded: false,
					}),
				),
				stateOf(
					PalworldEdition.Windows,
					status({
						deployed: false,
					}),
				),
				stateOf(
					PalworldEdition.Windows,
					status({
						started: false,
						loaded: false,
					}),
				),
			].map((state) => state.en),
		).toEqual([
			"Running",
			"Couldn't start. Check the console",
			"Runs after a restart",
			"Runs after a restart",
		]);
	});

	it("marks a mod turned off and one made only for players", () => {
		expect(
			[
				stateOf(
					PalworldEdition.Windows,
					status({
						enabled: false,
					}),
				),
				stateOf(
					PalworldEdition.Windows,
					status({
						server: false,
					}),
				),
			].map((state) => state.en),
		).toEqual([
			"Off",
			"Doesn't run on servers",
		]);
	});
});
