import { describe, expect, it } from "bun:test";
import {
	MOD_DEPLOY_FILE,
	ModRuleType,
	modDestinationsOf,
	modInfoOf,
	PalworldEdition,
	PalworldModKind,
	placedModsOf,
	readPlacedMods,
	WHOLE_PACKAGE,
	writeInstallStamp,
} from "../shared";
import { fakeFiles } from "../testing";
import { deployMods, MOD_SETTINGS_FILE, placementsOf } from "./modDeploy";

const UE4SS_IMAGE = {
	"/opt/serverk/ue4ss/dwmapi.dll": "loader",
	"/opt/serverk/ue4ss/ue4ss/UE4SS.dll": "ue4ss",
	"/opt/serverk/ue4ss/ue4ss/Mods/mods.txt": "BPModLoaderMod : 1",
	"/opt/serverk/ue4ss/ue4ss/Mods/PalSchema/dlls/main.dll": "palschema",
};

const WORKSHOP_EXTRAS = {
	".workshop.json": "{}",
	"thumbnail.png": "png",
};

const infoOf = (packageName: string, rules: unknown[], dependencies: unknown = null) => {
	return JSON.stringify({
		ModName: packageName,
		PackageName: packageName,
		Version: "1.1.1",
		MinRevision: 82_182,
		Dependencies: dependencies,
		InstallRule: rules,
	});
};

const scriptsRules = [
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
];

const packageAt = (root: string, files: Record<string, string>) => {
	return Object.fromEntries(
		Object.entries(files).map(([path, content]) => [
			`${root}/${path}`,
			content,
		]),
	);
};

const REMOTE_FAST_TRAVEL = {
	"Info.json": infoOf("RemoteFastTravel", [
		{
			Type: "Lua",
			Targets: [
				"./Scripts",
			],
		},
	]),
	...WORKSHOP_EXTRAS,
	"Scripts/main.lua": "-- travel",
	"Scripts/config.json": "{}",
};

const PALSCHEMA_LOADER = {
	"Info.json": infoOf(
		"PalSchema",
		[
			{
				Type: "Lua",
				Targets: [
					".",
				],
			},
			{
				Type: "Lua",
				IsServer: true,
				Targets: [
					".",
				],
			},
		],
		[
			"UE4SSExperimentalPW",
		],
	),
	...WORKSHOP_EXTRAS,
	"dlls/main.dll": "palschema",
};

const STORAGE_BAGS = {
	"Info.json": infoOf("8xStorageInvBags", [
		{
			Type: "PalSchema",
			Targets: [
				"./PalSchema/",
			],
		},
	]),
	...WORKSHOP_EXTRAS,
	"PalSchema/blueprints/Misc.jsonc": "{}",
	"PalSchema/items/AdditionalInventorySlot.jsonc": "{}",
};

const EXPEDITION_XP = {
	"Info.json": infoOf("ExpeditionXP", scriptsRules, [
		"UE4SSExperimentalPW",
	]),
	...WORKSHOP_EXTRAS,
	"enabled.txt": "1",
	"Scripts/main.lua": "-- expedition",
};

const PALS_LEARN_OVER_TIME = {
	"Info.json": infoOf("PalsLearnOverTime", scriptsRules, [
		"UE4SSExperimentalPW",
	]),
	...WORKSHOP_EXTRAS,
	"Scripts/main.lua": "-- learn",
};

const filesOf = (tree: Record<string, string>) => {
	return Object.keys(tree);
};

const pathsUnder = (files: Map<string, string>, root: string) => {
	return [
		...files.keys(),
	]
		.filter((path) => path.startsWith(`${root}/`))
		.map((path) => path.slice(root.length + 1))
		.sort();
};

const disable = async (context: Parameters<typeof deployMods>[0], ids: string[]) => {
	await writeInstallStamp(context, {
		buildId: "1",
		edition: PalworldEdition.Windows,
		mods: ids.map((id) => ({
			id,
			enabled: false,
		})),
		adminPasswordNext: null,
		settingsPending: null,
		settingsBaseline: null,
	});
};

describe("placementsOf", () => {
	it("keeps a lua target's own path, so ./Scripts lands as Scripts in the mod's folder", () => {
		expect(
			placementsOf(
				{
					files: filesOf(REMOTE_FAST_TRAVEL),
				},
				ModRuleType.Lua,
				"Scripts",
			),
		).toEqual(
			new Map([
				[
					"Scripts/main.lua",
					"Scripts/main.lua",
				],
				[
					"Scripts/config.json",
					"Scripts/config.json",
				],
			]),
		);
	});

	it("places the whole package for a . target, without Info.json, the workshop files or the thumbnail", () => {
		expect([
			...placementsOf(
				{
					files: filesOf(PALSCHEMA_LOADER),
				},
				ModRuleType.Lua,
				WHOLE_PACKAGE,
			).keys(),
		]).toEqual([
			"dlls/main.dll",
		]);
	});

	it("places the contents of a palschema, logicmods or paks target, not the target folder itself", () => {
		expect([
			...placementsOf(
				{
					files: filesOf(STORAGE_BAGS),
				},
				ModRuleType.PalSchema,
				"PalSchema",
			),
		]).toEqual([
			[
				"blueprints/Misc.jsonc",
				"PalSchema/blueprints/Misc.jsonc",
			],
			[
				"items/AdditionalInventorySlot.jsonc",
				"PalSchema/items/AdditionalInventorySlot.jsonc",
			],
		]);

		expect([
			...placementsOf(
				{
					files: [
						"LogicMods/RaidBoss.pak",
						"Paks/RaidBoss_P.pak",
					],
				},
				ModRuleType.LogicMods,
				"LogicMods/RaidBoss.pak",
			).keys(),
		]).toEqual([
			"RaidBoss.pak",
		]);
	});

	it("matches a target in any letter case, as windows does", () => {
		expect([
			...placementsOf(
				{
					files: [
						"scripts/main.lua",
						"scripts/config.json",
					],
				},
				ModRuleType.Lua,
				"Scripts",
			).keys(),
		]).toEqual([
			"scripts/main.lua",
			"scripts/config.json",
		]);
	});

	it("never places the readers' files at the package root, and places a nested file that only looks like one", () => {
		expect([
			...placementsOf(
				{
					files: [
						"WorkshopDescription.txt",
						"CHANGELOG.txt",
						"LICENSE",
						"config.json.example",
						"Scripts/main.lua",
						"Scripts/license_check.lua",
						"Scripts/config.json.example",
					],
				},
				ModRuleType.Lua,
				WHOLE_PACKAGE,
			).keys(),
		]).toEqual([
			"Scripts/main.lua",
			"Scripts/license_check.lua",
			"Scripts/config.json.example",
		]);
	});
});

describe("deploying the mods at a windows start", () => {
	it("places each lua package under its package name in the pinned ue4ss, keeping Scripts, with our own empty enabled.txt", async () => {
		const { context, files } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				...packageAt("Mods/Workshop/3412345678", REMOTE_FAST_TRAVEL),
				...packageAt("Mods/Workshop/3412345679", EXPEDITION_XP),
				...packageAt("Mods/Workshop/3412345680", PALS_LEARN_OVER_TIME),
			},
		});

		await deployMods(context);

		expect(files.get("Pal/Binaries/Win64/dwmapi.dll")).toBe("loader");
		expect(pathsUnder(files, "Pal/Binaries/Win64/ue4ss/Mods/RemoteFastTravel")).toEqual([
			"Scripts/config.json",
			"Scripts/main.lua",
			"enabled.txt",
		]);
		expect(pathsUnder(files, "Pal/Binaries/Win64/ue4ss/Mods/ExpeditionXP")).toEqual([
			"Scripts/main.lua",
			"enabled.txt",
		]);
		expect(files.get("Pal/Binaries/Win64/ue4ss/Mods/ExpeditionXP/enabled.txt")).toBe("");
		expect(pathsUnder(files, "Pal/Binaries/Win64/ue4ss/Mods/PalsLearnOverTime")).toEqual([
			"Scripts/main.lua",
			"enabled.txt",
		]);
	});

	it("places a palschema package's contents under its package name in palschema's mods folder", async () => {
		const { context, files } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				...packageAt("Mods/Workshop/3412345681", STORAGE_BAGS),
			},
		});

		await deployMods(context);

		expect(pathsUnder(files, "Pal/Binaries/Win64/ue4ss/Mods/PalSchema/mods/8xStorageInvBags")).toEqual([
			"blueprints/Misc.jsonc",
			"items/AdditionalInventorySlot.jsonc",
		]);
		expect(files.get("Pal/Binaries/Win64/ue4ss/Mods/PalSchema/dlls/main.dll")).toBe("palschema");
	});

	it("places a paks package in its own folder under ~mods and leaves ue4ss out, since paks need no ue4ss", async () => {
		const { context, files, commands } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				"Mods/PakMods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak": "pak",
			},
		});

		await deployMods(context);

		expect(pathsUnder(files, "Pal/Content/Paks/~mods/ExpandedBaseRadius")).toEqual([
			"ExpandedBaseRadius_P.pak",
		]);
		expect(files.has("Pal/Binaries/Win64/dwmapi.dll")).toBe(false);
		expect(commands.some((command) => command.includes("/opt/serverk/ue4ss"))).toBe(false);
	});

	it("places a logicmods package under its package name in LogicMods, and ue4ss with it for the blueprint loader", async () => {
		const { context, files } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				...packageAt("Mods/Workshop/RaidBoss", {
					"Info.json": infoOf("RaidBoss", [
						{
							Type: "LogicMods",
							IsServer: true,
							Targets: [
								"./LogicMods/",
							],
						},
					]),
					"LogicMods/RaidBoss.pak": "pak",
				}),
			},
		});

		await deployMods(context);

		expect(pathsUnder(files, "Pal/Content/Paks/LogicMods/RaidBoss")).toEqual([
			"RaidBoss.pak",
		]);
		expect(files.has("Pal/Binaries/Win64/dwmapi.dll")).toBe(true);
	});

	it("places the folders an older driver stored without Info.json by their layout", async () => {
		const { context, files } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
				"Mods/PalSchemaMods/BetterRates/raw/rates.json": "{}",
			},
		});

		await deployMods(context);

		expect(pathsUnder(files, "Pal/Binaries/Win64/ue4ss/Mods/FastCraft")).toEqual([
			"Scripts/main.lua",
			"enabled.txt",
		]);
		expect(pathsUnder(files, "Pal/Binaries/Win64/ue4ss/Mods/PalSchema/mods/BetterRates")).toEqual([
			"raw/rates.json",
		]);
	});

	it("places only the mods that are on, and records what it placed", async () => {
		const { context, files } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				...packageAt("Mods/Workshop/3412345678", REMOTE_FAST_TRAVEL),
				"Mods/PakMods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak": "pak",
			},
		});

		await disable(context, [
			"paks:ExpandedBaseRadius",
		]);
		await deployMods(context);

		expect(files.has("Pal/Content/Paks/~mods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak")).toBe(false);
		expect(await readPlacedMods(context)).toEqual([
			{
				id: "workshop:3412345678",
				paths: [
					"Pal/Binaries/Win64/ue4ss/Mods/RemoteFastTravel",
				],
			},
		]);
	});

	it("skips a target the package does not carry and still places the rest", async () => {
		const { context, files, logged } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				...packageAt("Mods/Workshop/Partial", {
					"Info.json": infoOf("Partial", [
						{
							Type: "Lua",
							Targets: [
								"./Scripts",
								"./dlls",
							],
						},
					]),
					"Scripts/main.lua": "--",
				}),
			},
		});

		await deployMods(context);

		expect(pathsUnder(files, "Pal/Binaries/Win64/ue4ss/Mods/Partial")).toEqual([
			"Scripts/main.lua",
			"enabled.txt",
		]);
		expect(logged).toContain("skipped a mod target the package does not carry");
	});

	it("keeps pocketpair's loader off with a fixed PalModSettings.ini on every windows start", async () => {
		const { context, files } = fakeFiles({
			files: {
				"Mods/PalModSettings.ini": "[PalModSettings]\nbGlobalEnableMod=true\nActiveModList=Old\n",
			},
		});

		await deployMods(context);

		expect(files.get(MOD_SETTINGS_FILE)).toBe("[PalModSettings]\nbGlobalEnableMod=False\nConfigVersion=1.0\n");
	});
});

describe("guarding the folders a start places into", () => {
	it("never empties ~mods or LogicMods for a package named . or .., and the start still succeeds", async () => {
		const { context, files } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				"Pal/Content/Paks/~mods/Hand_P.pak": "pak",
				"Pal/Content/Paks/LogicMods/HandLogic.pak": "pak",
				...packageAt("Mods/Workshop/Dot", {
					"Info.json": infoOf(".", [
						{
							Type: "Paks",
							IsServer: true,
						},
					]),
					"Dot_P.pak": "pak",
				}),
				...packageAt("Mods/Workshop/DotDot", {
					"Info.json": infoOf("..", [
						{
							Type: "LogicMods",
							IsServer: true,
						},
					]),
					"DotDot.pak": "pak",
				}),
			},
		});

		await disable(context, [
			"workshop:Dot",
		]);
		await deployMods(context);

		expect(files.has("Pal/Content/Paks/~mods/Hand_P.pak")).toBe(true);
		expect(files.has("Pal/Content/Paks/LogicMods/HandLogic.pak")).toBe(true);
		expect(files.has("Pal/Content/Paks/LogicMods/DotDot/DotDot.pak")).toBe(true);
	});

	it("gives no destination to a package whose name is not one folder, whatever its Info.json said", () => {
		for (const packageName of [
			".",
			"..",
			"a/b",
			"",
		]) {
			expect(
				modDestinationsOf({
					kind: PalworldModKind.Workshop,
					folder: "Mod",
					path: "Mods/Workshop/Mod",
					info: {
						...modInfoOf(null),
						packageName,
					},
					rules: [
						{
							type: ModRuleType.Paks,
							targets: [
								WHOLE_PACKAGE,
							],
						},
					],
					files: [
						"Mod_P.pak",
					],
					sizeBytes: 3,
					oversized: false,
				}),
			).toEqual([]);
		}
	});

	it("never places a package named like a mod the pinned ue4ss ships, in any letter case, and keeps the shipped one", async () => {
		const { context, files } = fakeFiles({
			files: {
				...UE4SS_IMAGE,
				"/opt/serverk/ue4ss/ue4ss/Mods/shared/Types.lua": "types",
				"Mods/UE4SSMods/shared/Scripts/main.lua": "-- not ours",
				"Mods/UE4SSMods/keybinds/Scripts/main.lua": "-- not ours",
				"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
			},
		});

		await deployMods(context);

		expect(pathsUnder(files, "Pal/Binaries/Win64/ue4ss/Mods/shared")).toEqual([
			"Types.lua",
		]);
		expect(files.has("Pal/Binaries/Win64/ue4ss/Mods/keybinds/Scripts/main.lua")).toBe(false);
		expect(files.has("Pal/Binaries/Win64/ue4ss/Mods/FastCraft/Scripts/main.lua")).toBe(true);
	});
});

describe("deploying a server with many mod files", () => {
	const paksOf = (name: string, count: number) => {
		return Object.fromEntries(
			Array.from(
				{
					length: count,
				},
				(_, index) => [
					`Mods/PakMods/${name}/${name}_${index}_P.pak`,
					"pak",
				],
			),
		);
	};

	it("places two packages whose files together exceed the listing cap, since each package is listed on its own", async () => {
		const { context, files } = fakeFiles({
			listLimit: 3,
			files: {
				...paksOf("BiggerBase", 3),
				...paksOf("FasterPals", 3),
			},
		});

		await deployMods(context);

		expect(pathsUnder(files, "Pal/Content/Paks/~mods/BiggerBase").length).toBe(3);
		expect(pathsUnder(files, "Pal/Content/Paks/~mods/FasterPals").length).toBe(3);
	});

	it("skips a package over the cap and still places the rest, so the start goes on", async () => {
		const { context, files, logged } = fakeFiles({
			listLimit: 3,
			files: {
				...paksOf("Huge", 4),
				...paksOf("FasterPals", 1),
			},
		});

		await deployMods(context);

		expect(pathsUnder(files, "Pal/Content/Paks/~mods/Huge")).toEqual([]);
		expect(pathsUnder(files, "Pal/Content/Paks/~mods/FasterPals")).toEqual([
			"FasterPals_0_P.pak",
		]);
		expect(logged).toContain("skipped a mod with too many files to place");
		expect((await readPlacedMods(context)).map((placed) => placed.id)).toEqual([
			"paks:FasterPals",
		]);
	});
});

describe("cleaning up what an earlier start placed", () => {
	it("removes a paks package that was removed since, and leaves the paks the owner placed by hand", async () => {
		const { context, files } = fakeFiles({
			files: {
				[MOD_DEPLOY_FILE]: JSON.stringify([
					{
						id: "paks:Gone",
						paths: [
							"Pal/Content/Paks/~mods/Gone",
						],
					},
				]),
				"Pal/Content/Paks/~mods/Gone/Gone_P.pak": "pak",
				"Pal/Content/Paks/~mods/Hand_P.pak": "pak",
				"Pal/Content/Paks/~mods/HandFolder/Hand_P.pak": "pak",
			},
		});

		await deployMods(context);

		expect(files.has("Pal/Content/Paks/~mods/Gone/Gone_P.pak")).toBe(false);
		expect(files.has("Pal/Content/Paks/~mods/Hand_P.pak")).toBe(true);
		expect(files.has("Pal/Content/Paks/~mods/HandFolder/Hand_P.pak")).toBe(true);
		expect(await readPlacedMods(context)).toEqual([]);
	});

	it("removes the placed folder of a mod that is off even when no record names it, as after a restored backup", async () => {
		const { context, files } = fakeFiles({
			files: {
				"Mods/PakMods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak": "pak",
				"Pal/Content/Paks/~mods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak": "pak",
			},
		});

		await disable(context, [
			"paks:ExpandedBaseRadius",
		]);
		await deployMods(context);

		expect(files.has("Pal/Content/Paks/~mods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak")).toBe(false);
	});

	it("places nothing on linux and takes back every managed folder and ue4ss, since linux runs no server mods", async () => {
		const { context, files } = fakeFiles({
			edition: PalworldEdition.Linux,
			files: {
				...UE4SS_IMAGE,
				"Mods/PakMods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak": "pak",
				"Pal/Content/Paks/~mods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak": "pak",
				"Pal/Binaries/Win64/dwmapi.dll": "loader",
				"Pal/Binaries/Win64/ue4ss/UE4SS.dll": "ue4ss",
			},
		});

		expect(await deployMods(context)).toEqual([]);
		expect(files.has("Pal/Content/Paks/~mods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak")).toBe(false);
		expect(files.has("Pal/Binaries/Win64/dwmapi.dll")).toBe(false);
		expect(files.has("Pal/Binaries/Win64/ue4ss/UE4SS.dll")).toBe(false);
		expect(files.has(MOD_SETTINGS_FILE)).toBe(false);
	});
});

describe("placedModsOf", () => {
	it("reads the id list an older driver wrote, and ignores a recorded path outside the folders it manages", () => {
		expect(
			placedModsOf([
				"ue4ss:FastCraft",
				{
					id: "paks:Gone",
					paths: [
						"Pal/Content/Paks/~mods/Gone",
						"Pal/Saved/SaveGames",
						"Pal/Content/Paks/~mods/../../Saved",
						"Pal/Content/Paks/~mods",
					],
				},
				7,
			]),
		).toEqual([
			{
				id: "ue4ss:FastCraft",
				paths: [],
			},
			{
				id: "paks:Gone",
				paths: [
					"Pal/Content/Paks/~mods/Gone",
				],
			},
		]);
	});
});
