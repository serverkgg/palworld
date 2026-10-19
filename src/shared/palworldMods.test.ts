import { describe, expect, it } from "bun:test";
import {
	activePackages,
	classicMods,
	foldersOf,
	modInfoOf,
	modLoadsOf,
	modSettingsOf,
	modsOf,
	PalworldModKind,
	parseModId,
	windowsPathOf,
} from "./palworldMods";

const infoOf = (packageName: string) => {
	return {
		packageName,
		name: packageName,
		version: "1.0.0",
		server: true,
	};
};

describe("modsOf", () => {
	it("keeps valid folder entries and treats a missing flag as on", () => {
		expect(
			modsOf([
				{
					id: "workshop:PalSchema",
				},
				{
					id: "palschema:RefinedRanches",
					enabled: false,
				},
				{
					id: "ue4ss:../etc",
				},
				{
					id: "unknown:Mod",
				},
				"workshop:PalSchema",
			]),
		).toEqual([
			{
				id: "workshop:PalSchema",
				enabled: true,
			},
			{
				id: "palschema:RefinedRanches",
				enabled: false,
			},
		]);
	});

	it("reads an old stamp without mods as an empty list", () => {
		expect(modsOf(undefined)).toEqual([]);
	});
});

describe("modInfoOf", () => {
	it("reads the package name and whether any install rule runs on servers", () => {
		expect(
			modInfoOf({
				ModName: "Refined Ranches",
				PackageName: "RefinedRanches",
				Version: "1.2.0",
				InstallRule: [
					{
						Type: "PalSchema",
						IsServer: true,
					},
				],
			}),
		).toEqual({
			packageName: "RefinedRanches",
			name: "Refined Ranches",
			version: "1.2.0",
			server: true,
		});
	});

	it("marks a client-only mod and refuses a package name that could break the ini", () => {
		expect(
			modInfoOf({
				PackageName: "Bad\nActiveModList=Other",
				InstallRule: [
					{
						Type: "Paks",
					},
				],
			}),
		).toEqual({
			packageName: null,
			name: null,
			version: null,
			server: false,
		});
	});
});

describe("windowsPathOf", () => {
	it("maps a container path onto the wine z drive", () => {
		expect(windowsPathOf("Mods/Workshop")).toEqual("Z:\\home\\container\\Mods\\Workshop");
	});
});

describe("activePackages", () => {
	it("lists each installed mod that is on, once, and skips one turned off or made only for players", () => {
		expect(
			activePackages(
				[
					{
						kind: PalworldModKind.Workshop,
						folder: "UE4SS",
						info: infoOf("UE4SS"),
					},
					{
						kind: PalworldModKind.Workshop,
						folder: "PalSchema",
						info: infoOf("PalSchema"),
					},
					{
						kind: PalworldModKind.Workshop,
						folder: "PalSchema copy",
						info: infoOf("PalSchema"),
					},
					{
						kind: PalworldModKind.Workshop,
						folder: "Creative",
						info: infoOf("CreativeMenu"),
					},
					{
						kind: PalworldModKind.Workshop,
						folder: "Skins",
						info: {
							...infoOf("ClientSkins"),
							server: false,
						},
					},
				],
				[
					{
						id: "workshop:Creative",
						enabled: false,
					},
				],
			),
		).toEqual([
			"UE4SS",
			"PalSchema",
		]);
	});
});

describe("parseModId", () => {
	it("splits a row id into its kind and folder", () => {
		expect(parseModId("palschema:Refined Ranches")).toEqual({
			kind: PalworldModKind.PalSchema,
			folder: "Refined Ranches",
		});
	});

	it("refuses an unknown kind or a folder that climbs out", () => {
		for (const id of [
			"RefinedRanches",
			"mods:RefinedRanches",
			"ue4ss:..",
			"ue4ss:a/b",
		]) {
			expect(parseModId(id)).toEqual(null);
		}
	});
});

describe("foldersOf", () => {
	it("names each mod folder that holds a file at any depth, and ignores a file loose in the root", () => {
		expect(
			foldersOf(
				[
					"Mods/PalSchemaMods/RefinedRanches/raw/ranch.json",
					"Mods/PalSchemaMods/RefinedRanches/translations/en/text.json",
					"Mods/PalSchemaMods/BetterBases/items/a.json",
					"Mods/PalSchemaMods/readme.txt",
				],
				"Mods/PalSchemaMods",
			),
		).toEqual([
			"BetterBases",
			"RefinedRanches",
		]);
	});
});

describe("classicMods", () => {
	it("keeps the palschema and ue4ss mods that are on, and leaves workshop packages to the official loader", () => {
		const installed = [
			{
				kind: PalworldModKind.Workshop,
				folder: "Creative",
				info: infoOf("CreativeMenu"),
			},
			{
				kind: PalworldModKind.PalSchema,
				folder: "RefinedRanches",
				info: infoOf("RefinedRanches"),
			},
			{
				kind: PalworldModKind.Ue4ss,
				folder: "BetterChat",
				info: infoOf("BetterChat"),
			},
		];

		expect(
			classicMods(installed, [
				{
					id: "ue4ss:BetterChat",
					enabled: false,
				},
			]).map((mod) => mod.folder),
		).toEqual([
			"RefinedRanches",
		]);
	});
});

describe("modSettingsOf", () => {
	it("enables mods and lists each active package once per line", () => {
		expect(
			modSettingsOf([
				"UE4SS",
				"PalSchema",
			]),
		).toEqual(
			[
				"[PalModSettings]",
				"bGlobalEnableMod=true",
				"WorkshopRootDir=Z:\\home\\container\\Mods\\Workshop",
				"ConfigVersion=1.0",
				"ActiveModList=UE4SS",
				"ActiveModList=PalSchema",
				"",
			].join("\n"),
		);
	});

	it("turns mods off when nothing is active", () => {
		expect(modSettingsOf([])).toContain("bGlobalEnableMod=false");
	});
});

describe("modLoadsOf", () => {
	it("reads the palschema and ue4ss mods the last start loaded from the ue4ss log", () => {
		const loads = modLoadsOf(
			[
				"[2026-10-19 12:03:33.8903143] Mod 'PalSchema' has enabled.txt, starting mod.",
				"[2026-10-19 12:03:39.9012979] [PalSchema] Loading mod: RefinedRanches Lean",
				"[2026-10-19 12:03:40.3818816] Mod 'ServerkHello' has enabled.txt, starting mod.",
			].join("\n"),
		);

		expect(loads.log).toEqual(true);
		expect([
			...loads.palschema,
		]).toEqual([
			"RefinedRanches Lean",
		]);
		expect([
			...loads.ue4ss,
		]).toEqual([
			"PalSchema",
			"ServerkHello",
		]);
	});

	it("knows the server has not written a log yet", () => {
		expect(modLoadsOf(null).log).toEqual(false);
	});
});
