import { describe, expect, it } from "bun:test";
import { fakeFiles } from "../testing";
import { modInfoOf } from "./palworldModRules";
import { installedMods, modNameOf, modsOf, PalworldModKind, parseModId } from "./palworldMods";

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
					id: "paks:ExpandedBaseRadius",
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
			{
				id: "paks:ExpandedBaseRadius",
				enabled: true,
			},
		]);
	});

	it("reads an old stamp without mods as an empty list", () => {
		expect(modsOf(undefined)).toEqual([]);
	});

	it("keeps the workshop item, package and version a catalog install recorded", () => {
		expect(
			modsOf([
				{
					id: "workshop:3412345678",
					enabled: false,
					itemId: "3412345678",
					packageName: "RefinedRanches",
					version: "1.4.0",
				},
			]),
		).toEqual([
			{
				id: "workshop:3412345678",
				enabled: false,
				itemId: "3412345678",
				packageName: "RefinedRanches",
				version: "1.4.0",
			},
		]);
	});

	it("drops an item id that is not digits and a package name that could escape a folder", () => {
		expect(
			modsOf([
				{
					id: "workshop:Mod",
					itemId: "../3412345678",
					packageName: "Bad\nName",
					version: "",
				},
			]),
		).toEqual([
			{
				id: "workshop:Mod",
				enabled: true,
			},
		]);
	});
});

describe("parseModId", () => {
	it("splits a row id into its kind and folder", () => {
		expect(parseModId("palschema:Refined Ranches")).toEqual({
			kind: PalworldModKind.PalSchema,
			folder: "Refined Ranches",
		});
		expect(parseModId("paks:ExpandedBaseRadius")).toEqual({
			kind: PalworldModKind.Paks,
			folder: "ExpandedBaseRadius",
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

describe("installedMods", () => {
	it("lists the package folders of every root, each on its own, and skips an empty folder", async () => {
		const { context } = fakeFiles({
			files: {
				"Mods/PalSchemaMods/RefinedRanches/raw/ranch.json": "1234567890",
				"Mods/PalSchemaMods/RefinedRanches/translations/en/text.json": "12345",
				"Mods/PalSchemaMods/BetterBases/items/a.json": "123",
				"Mods/PalSchemaMods/readme.txt": "loose",
				"Mods/Workshop/3412345678/Info.json": JSON.stringify({
					ModName: "Remote Fast Travel",
					PackageName: "RemoteFastTravel",
				}),
			},
		});

		expect(
			(await installedMods(context)).map((mod) => [
				mod.kind,
				mod.folder,
				mod.files,
				mod.sizeBytes,
				modNameOf(mod),
			]),
		).toEqual([
			[
				PalworldModKind.Workshop,
				"3412345678",
				[
					"Info.json",
				],
				expect.any(Number),
				"RemoteFastTravel",
			],
			[
				PalworldModKind.PalSchema,
				"BetterBases",
				[
					"items/a.json",
				],
				3,
				"BetterBases",
			],
			[
				PalworldModKind.PalSchema,
				"RefinedRanches",
				[
					"raw/ranch.json",
					"translations/en/text.json",
				],
				15,
				"RefinedRanches",
			],
		]);
	});

	it("marks a package whose own listing reaches the bridge's cap as too large, and still reads its Info.json", async () => {
		const { context } = fakeFiles({
			listLimit: 2,
			files: {
				"Mods/Workshop/Huge/Info.json": JSON.stringify({
					ModName: "Huge Pack",
					PackageName: "HugePack",
				}),
				"Mods/Workshop/Huge/Paks/a.pak": "a",
				"Mods/Workshop/Huge/Paks/b.pak": "b",
				"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
			},
		});

		expect(
			(await installedMods(context)).map((mod) => [
				mod.folder,
				mod.oversized,
				mod.info.name,
			]),
		).toEqual([
			[
				"Huge",
				true,
				"Huge Pack",
			],
			[
				"FastCraft",
				false,
				null,
			],
		]);
	});
});

describe("modNameOf", () => {
	it("names a package by its Info.json package name, else by its folder", () => {
		expect(
			modNameOf({
				folder: "3412345678",
				info: modInfoOf({
					PackageName: "RemoteFastTravel",
				}),
			}),
		).toBe("RemoteFastTravel");
		expect(
			modNameOf({
				folder: "BetterChat",
				info: modInfoOf(null),
			}),
		).toBe("BetterChat");
	});
});
