import { describe, expect, it } from "bun:test";
import { PalworldModKind } from "../shared";
import { bundledUploadOf, proxyUploadOf, stagedPathOf, uploadedModsOf } from "./modStaging";

const STAGED = ".serverk-staging/mod-upload/RefinedRanches";

const NEXUS_STAGED = ".serverk-staging/mod-upload/RefinedRanches Lean 5069 1 2026-08-13T06-05Z Ab1rBHP6A";

const UE4SS_RELEASE = [
	"Pal/Binaries/Win64/dwmapi.dll",
	"Pal/Binaries/Win64/ue4ss/UE4SS.dll",
	"Pal/Binaries/Win64/ue4ss/UE4SS-settings.ini",
	"Pal/Binaries/Win64/ue4ss/Mods/mods.txt",
	"Pal/Binaries/Win64/ue4ss/Mods/BPModLoaderMod/Scripts/main.lua",
	"Pal/Binaries/Win64/ue4ss/Mods/shared/Types.lua",
];

const PALDEFENDER = [
	"Pal/Binaries/Win64/PalDefender.dll",
	"Pal/Binaries/Win64/d3d9.dll",
];

const found = (kind: PalworldModKind, folder: string, root: string) => {
	return {
		kind,
		folder,
		root: root.length === 0 ? STAGED : `${STAGED}/${root}`,
	};
};

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
	it("reads a nexus mod folder with its own Info.json as one package, and ignores the readme beside it", () => {
		expect(
			uploadedModsOf(
				[
					"ExpeditionXP/Info.json",
					"ExpeditionXP/Scripts/main.lua",
					"ExpeditionXP/enabled.txt",
					"shared/README.txt",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.Workshop, "ExpeditionXP", "ExpeditionXP"),
		]);
	});

	it("finds a lua mod behind any of the folder prefixes mod sites use", () => {
		for (const prefix of [
			"",
			"Pal/Binaries/Win64/ue4ss/Mods/",
			"Win64/ue4ss/Mods/",
			"ue4ss/Mods/",
			"Mods/NativeMods/UE4SS/Mods/",
		]) {
			expect(
				uploadedModsOf(
					[
						`${prefix}BetterChat/Scripts/main.lua`,
						`${prefix}BetterChat/enabled.txt`,
					],
					STAGED,
				),
			).toEqual([
				found(PalworldModKind.Lua, "BetterChat", `${prefix}BetterChat`),
			]);
		}
	});

	it("reads a workshop package zipped inside its Mods/Workshop folder", () => {
		expect(
			uploadedModsOf(
				[
					"Mods/Workshop/RemoteFastTravel/Info.json",
					"Mods/Workshop/RemoteFastTravel/Scripts/main.lua",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.Workshop, "RemoteFastTravel", "Mods/Workshop/RemoteFastTravel"),
		]);
	});

	it("reads a c++ mod by its dll entry point", () => {
		expect(
			uploadedModsOf(
				[
					"FastCraft/dlls/main.dll",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.Lua, "FastCraft", "FastCraft"),
		]);
	});

	it("reads a bare palschema folder, and names one zipped without its folder after the upload", () => {
		expect(
			uploadedModsOf(
				[
					"RefinedRanches/raw/ranch.json",
					"RefinedRanches/translations/en/text.json",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.PalSchema, "RefinedRanches", "RefinedRanches"),
		]);

		expect(
			uploadedModsOf(
				[
					"raw/ranch.json",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.PalSchema, "RefinedRanches", ""),
		]);
	});

	it("reads a palschema mod zipped with the full ue4ss path", () => {
		expect(
			uploadedModsOf(
				[
					"ue4ss/Mods/PalSchema/mods/RefinedRanches/raw/ranch.json",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.PalSchema, "RefinedRanches", "ue4ss/Mods/PalSchema/mods/RefinedRanches"),
		]);
	});

	it("names a mod downloaded from nexus after the mod, without the id, version and timestamp nexus adds", () => {
		expect(
			uploadedModsOf(
				[
					"raw/ranch.json",
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

	it("makes a bare pak at the archive root a paks package named after the upload", () => {
		expect(
			uploadedModsOf(
				[
					"ExpandedBaseRadius_P.pak",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.Paks, "RefinedRanches", ""),
		]);
	});

	it("names a pak folder after itself, and a pak zipped inside the game's pak folders after the upload", () => {
		expect(
			uploadedModsOf(
				[
					"BiggerBase/BiggerBase_P.pak",
					"BiggerBase/BiggerBase_P.utoc",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.Paks, "BiggerBase", "BiggerBase"),
		]);

		expect(
			uploadedModsOf(
				[
					"Pal/Content/Paks/~mods/BiggerBase_P.pak",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.Paks, "RefinedRanches", "Pal/Content/Paks/~mods"),
		]);
	});

	it("keeps a lua mod and a pak zipped beside it as two packages", () => {
		expect(
			uploadedModsOf(
				[
					"BetterChat/Scripts/main.lua",
					"BetterChat_P.pak",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.Lua, "BetterChat", "BetterChat"),
			found(PalworldModKind.Paks, "RefinedRanches", ""),
		]);
	});

	it("reads a catalog archive with Info.json at its root as one package named after its staging folder", () => {
		expect(
			uploadedModsOf(
				[
					"Info.json",
					"Scripts/main.lua",
					"Paks/Mod_P.pak",
				],
				STAGED,
			),
		).toEqual([
			found(PalworldModKind.Workshop, "RefinedRanches", ""),
		]);
	});

	it("finds nothing in a palschema folder zipped without the folder around its files", () => {
		expect(
			uploadedModsOf(
				[
					"ranch.json",
					"pals.jsonc",
				],
				".serverk-staging/mod-upload/raw",
			),
		).toEqual([]);
	});

	it("finds nothing in an archive with no mod in it", () => {
		expect(
			uploadedModsOf(
				[
					"readme.txt",
				],
				STAGED,
			),
		).toEqual([]);
	});
});

describe("bundledUploadOf", () => {
	it("recognises the ue4ss release and the palschema release by their files", () => {
		expect(bundledUploadOf(UE4SS_RELEASE)).toEqual(true);
		expect(
			bundledUploadOf([
				"PalSchema/dlls/main.dll",
				"PalSchema/enabled.txt",
			]),
		).toEqual(true);
		expect(
			bundledUploadOf([
				"ue4ss/UE4SS.dll",
			]),
		).toEqual(true);
	});

	it("looks at the files, never at a folder named ue4ss", () => {
		expect(
			bundledUploadOf([
				"Pal/Binaries/Win64/ue4ss/Mods/BetterChat/Scripts/main.lua",
				"UE4SS/Mods/FastCraft/dlls/main.dll",
			]),
		).toEqual(false);
		expect(
			bundledUploadOf([
				"readme.txt",
			]),
		).toEqual(false);
	});
});

describe("proxyUploadOf", () => {
	it("recognises a native mod that loads through a proxy dll, such as paldefender", () => {
		expect(proxyUploadOf(PALDEFENDER)).toEqual(true);
		expect(
			proxyUploadOf([
				"PalDefender.dll",
				"d3d9.dll",
				"PalDefender/Config.json",
			]),
		).toEqual(true);
	});

	it("leaves a proxy-named dll alone when nothing beside it loads, or when the archive carries a ue4ss mod", () => {
		expect(
			proxyUploadOf([
				"Win64/version.dll",
				"Win64/readme.txt",
			]),
		).toEqual(false);
		expect(
			proxyUploadOf([
				"FastCraft/dlls/main.dll",
				"FastCraft/dlls/version.dll",
			]),
		).toEqual(false);
	});
});
