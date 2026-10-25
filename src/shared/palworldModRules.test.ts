import { describe, expect, it } from "bun:test";
import {
	installRulesOf,
	isPackageExtra,
	isPackageName,
	layoutRuleOf,
	ModRuleType,
	modInfoOf,
	relativePathOf,
	rulesOf,
	WHOLE_PACKAGE,
} from "./palworldModRules";

describe("relativePathOf", () => {
	it("reads a target as a path inside the package, with the package root as the empty path", () => {
		expect(
			[
				"./Scripts",
				"./PalSchema/",
				".",
				"./",
				".\\Paks\\",
				"LogicMods/Mod.pak",
			].map(relativePathOf),
		).toEqual([
			"Scripts",
			"PalSchema",
			WHOLE_PACKAGE,
			WHOLE_PACKAGE,
			"Paks",
			"LogicMods/Mod.pak",
		]);
	});

	it("refuses a target that climbs out of the package or names an absolute path", () => {
		expect(
			[
				"../Pal/Saved",
				"./Scripts/../../x",
				"/etc",
				"C:\\Windows",
				7,
			].map(relativePathOf),
		).toEqual([
			null,
			null,
			null,
			null,
			null,
		]);
	});
});

describe("installRulesOf", () => {
	it("keeps only the rules marked for servers when a package marks any", () => {
		expect(
			installRulesOf([
				{
					Type: "Lua",
					Targets: [
						"./Scripts",
					],
				},
				{
					Type: "Lua",
					IsServer: true,
					Targets: [
						"./Scripts",
					],
				},
			]),
		).toEqual([
			{
				type: ModRuleType.Lua,
				targets: [
					"Scripts",
				],
			},
		]);
	});

	it("keeps every rule when none is marked for servers, because an uploaded package is what the owner asked for", () => {
		expect(
			installRulesOf([
				{
					Type: "Lua",
					Targets: [
						"./Scripts",
					],
				},
				{
					Type: "Paks",
					IsServer: false,
					Targets: [
						"./Paks/",
					],
				},
			]),
		).toEqual([
			{
				type: ModRuleType.Lua,
				targets: [
					"Scripts",
				],
			},
			{
				type: ModRuleType.Paks,
				targets: [
					"Paks",
				],
			},
		]);
	});

	it("drops a rule of an unknown type or shape, reads the type in any case, and treats a rule with no targets as the whole package", () => {
		expect(
			installRulesOf([
				"Lua",
				{
					Type: "Movies",
					IsServer: true,
				},
				{
					Type: "palschema",
				},
			]),
		).toEqual([
			{
				type: ModRuleType.PalSchema,
				targets: [
					WHOLE_PACKAGE,
				],
			},
		]);
	});

	it("drops a target that climbs out of the package and keeps the rest", () => {
		expect(
			installRulesOf([
				{
					Type: "Paks",
					Targets: [
						"../../Pal",
						"./Paks",
					],
				},
			]),
		).toEqual([
			{
				type: ModRuleType.Paks,
				targets: [
					"Paks",
				],
			},
		]);
	});
});

describe("modInfoOf", () => {
	it("reads a real workshop package, with no dependency list as an empty one", () => {
		expect(
			modInfoOf({
				ModName: "8x Storage Inventory Bags",
				PackageName: "8xStorageInvBags",
				Version: "0.6.7",
				MinRevision: 82_182,
				Dependencies: null,
				InstallRule: [
					{
						Type: "PalSchema",
						Targets: [
							"./PalSchema/",
						],
					},
				],
			}),
		).toEqual({
			packageName: "8xStorageInvBags",
			name: "8x Storage Inventory Bags",
			version: "0.6.7",
			rules: [
				{
					type: ModRuleType.PalSchema,
					targets: [
						"PalSchema",
					],
				},
			],
			dependencies: [],
		});
	});

	it("keeps the dependencies by package name and refuses a package name that could escape a folder", () => {
		const info = modInfoOf({
			PackageName: "../Expedition",
			Dependencies: [
				"UE4SSExperimentalPW",
				"Bad Name/..",
				3,
			],
		});

		expect(info.packageName).toBeNull();
		expect(info.dependencies).toEqual([
			"UE4SSExperimentalPW",
		]);
	});
});

describe("isPackageName", () => {
	it("takes a name that starts with a letter or digit and stays one folder, and refuses . and ..", () => {
		expect(
			[
				"8xStorageInvBags",
				"RemoteFastTravel",
				"Pal.Tweaks-2",
				".",
				"..",
				".hidden",
				"-flag",
				"_Mod",
				"a/b",
				"",
			].map(isPackageName),
		).toEqual([
			true,
			true,
			true,
			false,
			false,
			false,
			false,
			false,
			false,
			false,
		]);
	});

	it("drops a package name of . or .. from Info.json, so the folder names the package", () => {
		expect(
			[
				".",
				"..",
			].map(
				(name) =>
					modInfoOf({
						PackageName: name,
					}).packageName,
			),
		).toEqual([
			null,
			null,
		]);
	});
});

describe("layoutRuleOf", () => {
	it("derives one rule for the whole package from its layout", () => {
		expect(
			[
				[
					"Scripts/main.lua",
					"enabled.txt",
				],
				[
					"dlls/main.dll",
				],
				[
					"raw/ranch.json",
					"translations/en/text.json",
				],
				[
					"ExpandedBaseRadius_P.pak",
				],
				[
					"Mod_P.utoc",
					"Mod_P.ucas",
					"Mod_P.pak",
				],
			].map((files) => layoutRuleOf(files)?.type),
		).toEqual([
			ModRuleType.Lua,
			ModRuleType.Lua,
			ModRuleType.PalSchema,
			ModRuleType.Paks,
			ModRuleType.Paks,
		]);
	});

	it("finds no rule in a folder with nothing a server runs", () => {
		expect(
			layoutRuleOf([
				"README.txt",
				"raw.json",
			]),
		).toBeNull();
	});
});

describe("rulesOf", () => {
	it("prefers the rules of Info.json, and falls back to the layout when Info.json declares none", () => {
		const declared = modInfoOf({
			InstallRule: [
				{
					Type: "Paks",
					IsServer: true,
					Targets: [
						"./Paks",
					],
				},
			],
		});

		expect(
			rulesOf(declared, [
				"Scripts/main.lua",
			]).map((rule) => rule.type),
		).toEqual([
			ModRuleType.Paks,
		]);
		expect(
			rulesOf(modInfoOf({}), [
				"Scripts/main.lua",
			]).map((rule) => rule.type),
		).toEqual([
			ModRuleType.Lua,
		]);
		expect(rulesOf(modInfoOf({}), []).length).toBe(0);
	});
});

describe("isPackageExtra", () => {
	it("marks the files a package carries for the workshop and its readers, which a server never needs", () => {
		expect(
			[
				"Info.json",
				".workshop.json",
				"thumbnail.png",
				"WorkshopDescription.txt",
				"CHANGELOG.txt",
				"LICENSE",
				"LICENSE.md",
				"config.json.example",
				"Scripts/main.lua",
				"Scripts/config.json",
				"Scripts/license_check.lua",
				"Scripts/config.json.example",
				"enabled.txt",
			].map(isPackageExtra),
		).toEqual([
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			true,
			false,
			false,
			false,
			false,
			false,
		]);
	});
});
