import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { workshopArchivePath } from "@serverkgg/bridge/steam";
import {
	type InstallStamp,
	MOD_DEPLOY_FILE,
	PalworldEdition,
	type PalworldMod,
	readInstallStamp,
	readPlacedMods,
	WORKSHOP_APP_ID,
	writeInstallStamp,
} from "../shared";
import { BRIDGE_READ_LIMIT, type FakeFiles, type FakeFilesOptions, fakeFiles } from "../testing";
import { UE4SS_LOG } from "./modStatus";
import { mods } from "./mods";
import { workshopStagingOf } from "./workshopInstall";

const ITEM = "3412345678";

const ARCHIVE = workshopArchivePath(WORKSHOP_APP_ID, ITEM);

const STAGING = workshopStagingOf(ITEM);

const PAK = "pak-bytes";

const infoOf = (packageName: string, version: string) => {
	return JSON.stringify({
		ModName: "Refined Ranches",
		PackageName: packageName,
		Version: version,
		InstallRule: [
			{
				Type: "Paks",
				IsServer: true,
			},
		],
	});
};

interface HarnessOptions extends FakeFilesOptions {
	stamped?: boolean;
	records?: PalworldMod[];
}

interface Harness extends FakeFiles {
	records: () => Promise<PalworldMod[]>;
}

const harness = async (options: HarnessOptions = {}): Promise<Harness> => {
	const fake = fakeFiles(options);

	if (options.stamped !== false) {
		const stamp: InstallStamp = {
			buildId: "1",
			edition: options.edition ?? PalworldEdition.Windows,
			mods: options.records ?? [],
			adminPasswordNext: null,
			settingsPending: null,
			settingsBaseline: null,
		};

		await writeInstallStamp(fake.context, stamp);
	}

	return {
		...fake,
		async records() {
			return (await readInstallStamp(fake.context))?.mods ?? [];
		},
	};
};

const catalogRecord: PalworldMod = {
	id: `workshop:${ITEM}`,
	enabled: true,
	itemId: ITEM,
	packageName: "RefinedRanches",
	version: "1.0.0",
};

const delivered = (packageName = "RefinedRanches", version = "1.4.0") => {
	return {
		[ARCHIVE]: {
			"Info.json": infoOf(packageName, version),
			"Paks/RefinedRanches.pak": PAK,
		},
	};
};

const leftovers = (files: Map<string, string>) => {
	return [
		...files.keys(),
	].filter((path) => path === ARCHIVE || path.startsWith(".serverk-staging/"));
};

const add = async (context: Bridge.Context, input: string) => {
	if (mods.add === undefined) {
		throw new Error("the mods catalog takes no uploads");
	}

	return await mods.add(context, input);
};

const toggle = async (context: Bridge.Context, id: string, enabled: boolean) => {
	if (mods.toggle === undefined) {
		throw new Error("the mods catalog has no toggle");
	}

	await mods.toggle(context, id, enabled);
};

const refusal = async (run: Promise<unknown>) => {
	try {
		await run;
	} catch (error) {
		return error;
	}

	return null;
};

describe("listing the installed mods", () => {
	it("lists a catalog install by its workshop item id, with the version it recorded and its steam page", async () => {
		const info = infoOf("RefinedRanches", "1.0.0");
		const { context } = await harness({
			records: [
				catalogRecord,
			],
			files: {
				[`Mods/Workshop/${ITEM}/Info.json`]: info,
				[`Mods/Workshop/${ITEM}/Paks/RefinedRanches.pak`]: PAK,
				[MOD_DEPLOY_FILE]: JSON.stringify([
					`workshop:${ITEM}`,
				]),
				"Pal/Content/Paks/~mods/RefinedRanches/RefinedRanches.pak": PAK,
			},
		});

		expect(await mods.installed(context)).toEqual([
			{
				id: ITEM,
				provider: "workshop",
				path: `Mods/Workshop/${ITEM}`,
				title: "Refined Ranches",
				version: "1.0.0",
				sizeBytes: info.length + PAK.length,
				enabled: true,
				gameVersion: null,
				stale: false,
				pageUrl: `https://steamcommunity.com/sharedfiles/filedetails/?id=${ITEM}`,
				icon: null,
				note: {
					ar: "شغّال",
					en: "Running",
				},
			},
		]);
	});

	it("lists an upload under an upload id with no provider, so the panel marks it manual", async () => {
		const { context } = await harness({
			files: {
				"Mods/Workshop/CreativeMenu/Info.json": infoOf("CreativeMenu", "2.0"),
				"Mods/PalSchemaMods/BetterRates/raw/rates.json": "{}",
				"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
				"Mods/PakMods/ExpandedBaseRadius/ExpandedBaseRadius_P.pak": PAK,
			},
		});

		expect(
			(await mods.installed(context)).map((entry) => [
				entry.id,
				entry.provider,
				entry.path,
				entry.version,
				entry.pageUrl,
			]),
		).toEqual([
			[
				"upload:workshop:CreativeMenu",
				null,
				"Mods/Workshop/CreativeMenu",
				"2.0",
				null,
			],
			[
				"upload:palschema:BetterRates",
				null,
				"Mods/PalSchemaMods/BetterRates",
				null,
				null,
			],
			[
				"upload:ue4ss:FastCraft",
				null,
				"Mods/UE4SSMods/FastCraft",
				null,
				null,
			],
			[
				"upload:paks:ExpandedBaseRadius",
				null,
				"Mods/PakMods/ExpandedBaseRadius",
				null,
				null,
			],
		]);
	});

	it("still lists a mod an older driver recorded, as an upload that keeps its off switch", async () => {
		const { context } = await harness({
			records: [
				{
					id: "ue4ss:FastCraft",
					enabled: false,
				},
			],
			files: {
				"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
			},
		});

		const [entry] = await mods.installed(context);

		expect(entry?.id).toBe("upload:ue4ss:FastCraft");
		expect(entry?.enabled).toBe(false);
	});
});

describe("installing a workshop item", () => {
	it("installs the archive the platform delivered, records it, and clears the archive and the staging", async () => {
		const { context, files, extracted, records } = await harness({
			archives: delivered(),
		});

		const entry = await mods.install(context, ITEM);

		expect(extracted).toEqual([
			{
				path: `.serverk/snapshots/workshop-1623730-${ITEM}.zip`,
				destination: STAGING,
				tree: true,
			},
		]);
		expect(entry.id).toBe(ITEM);
		expect(entry.provider).toBe("workshop");
		expect(entry.version).toBe("1.4.0");
		expect(files.get(`Mods/Workshop/${ITEM}/Paks/RefinedRanches.pak`)).toBe(PAK);
		expect(leftovers(files)).toEqual([]);
		expect(await records()).toEqual([
			{
				id: `workshop:${ITEM}`,
				enabled: true,
				itemId: ITEM,
				packageName: "RefinedRanches",
				version: "1.4.0",
			},
		]);
	});

	it("updates an installed item in place and keeps it off when the customer turned it off", async () => {
		const { context, files, records } = await harness({
			records: [
				{
					...catalogRecord,
					enabled: false,
				},
			],
			files: {
				[`Mods/Workshop/${ITEM}/Info.json`]: infoOf("RefinedRanches", "1.0.0"),
				[`Mods/Workshop/${ITEM}/Paks/Retired.pak`]: PAK,
			},
			archives: delivered(),
		});

		const entry = await mods.install(context, ITEM);

		expect(entry.version).toBe("1.4.0");
		expect(entry.enabled).toBe(false);
		expect(files.has(`Mods/Workshop/${ITEM}/Paks/Retired.pak`)).toBe(false);
		expect(await records()).toEqual([
			{
				...catalogRecord,
				enabled: false,
				version: "1.4.0",
			},
		]);
	});

	it("says an update of a running item runs after a restart until the next start places it, and keeps its placed folder for cleanup", async () => {
		const { context } = await harness({
			records: [
				catalogRecord,
			],
			files: {
				[`Mods/Workshop/${ITEM}/Info.json`]: infoOf("RefinedRanches", "1.0.0"),
				[`Mods/Workshop/${ITEM}/Paks/RefinedRanches.pak`]: PAK,
				"Pal/Content/Paks/~mods/RefinedRanches/RefinedRanches.pak": PAK,
				[MOD_DEPLOY_FILE]: JSON.stringify([
					{
						id: `workshop:${ITEM}`,
						paths: [
							"Pal/Content/Paks/~mods/RefinedRanches",
						],
					},
				]),
			},
			archives: delivered(),
		});

		expect((await mods.installed(context)).map((entry) => entry.note?.en)).toEqual([
			"Running",
		]);

		const entry = await mods.install(context, ITEM);

		expect(entry.note?.en).toBe("Runs after a restart");
		expect((await mods.installed(context)).map((installed) => installed.note?.en)).toEqual([
			"Runs after a restart",
		]);
		expect(await readPlacedMods(context)).toEqual([
			{
				id: null,
				paths: [
					"Pal/Content/Paks/~mods/RefinedRanches",
				],
			},
		]);
	});

	it("says an uploaded replacement of a running mod runs after a restart", async () => {
		const staged = ".serverk-staging/mod-upload/FastCraft";
		const { context } = await harness({
			files: {
				"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "-- old",
				[MOD_DEPLOY_FILE]: JSON.stringify([
					"ue4ss:FastCraft",
				]),
				[UE4SS_LOG]: "Mod 'FastCraft' has enabled.txt, starting mod.",
				[`${staged}/FastCraft/Scripts/main.lua`]: "-- new",
			},
		});

		expect((await add(context, staged)).note?.en).toBe("Runs after a restart");
	});

	it("replaces an uploaded copy of the same package, so the server places it once", async () => {
		const { context, files, records } = await harness({
			records: [
				{
					id: "workshop:RefinedRanches",
					enabled: true,
				},
			],
			files: {
				"Mods/Workshop/RefinedRanches/Info.json": infoOf("RefinedRanches", "0.9.0"),
			},
			archives: delivered(),
		});

		await mods.install(context, ITEM);

		expect(files.has("Mods/Workshop/RefinedRanches/Info.json")).toBe(false);
		expect((await records()).map((record) => record.id)).toEqual([
			`workshop:${ITEM}`,
		]);
	});

	it("refuses on the linux edition and still clears the delivered archive", async () => {
		const { context, files } = await harness({
			edition: PalworldEdition.Linux,
			archives: delivered(),
		});

		const error = await refusal(mods.install(context, ITEM));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).message).toContain("only on Windows");
		expect(leftovers(files)).toEqual([]);
		expect(files.has(`Mods/Workshop/${ITEM}/Info.json`)).toBe(false);
	});

	it("refuses UE4SS and PalSchema, which the server already ships, and installs nothing", async () => {
		for (const packageName of [
			"UE4SSExperimentalPW",
			"PalSchema",
		]) {
			const { context, files, records } = await harness({
				archives: delivered(packageName),
			});

			const error = await refusal(mods.install(context, ITEM));

			expect(error).toBeInstanceOf(BridgeUserError);
			expect((error as BridgeUserError).message).toContain("already included");
			expect(leftovers(files)).toEqual([]);
			expect(files.has(`Mods/Workshop/${ITEM}/Info.json`)).toBe(false);
			expect(await records()).toEqual([]);
		}
	});

	it("installs exactly the package at the archive root, with everything else inside it", async () => {
		const { context, files } = await harness({
			archives: {
				[ARCHIVE]: {
					"Info.json": infoOf("RefinedRanches", "1.4.0"),
					"Paks/RefinedRanches.pak": PAK,
					"Extra/Info.json": infoOf("Extra", "1.0.0"),
					"Other/Scripts/main.lua": "--",
				},
			},
		});

		await mods.install(context, ITEM);

		expect(files.get(`Mods/Workshop/${ITEM}/Extra/Info.json`)).toBeDefined();
		expect(files.get(`Mods/Workshop/${ITEM}/Other/Scripts/main.lua`)).toBe("--");
		expect((await mods.installed(context)).map((entry) => entry.id)).toEqual([
			ITEM,
		]);
	});

	it("installs nothing from an archive without Info.json at its root, even when packages sit inside it", async () => {
		const { context, files, records } = await harness({
			archives: {
				[ARCHIVE]: {
					"RefinedRanches/Info.json": infoOf("RefinedRanches", "1.4.0"),
					"RefinedRanches/Paks/RefinedRanches.pak": PAK,
					"Other/Scripts/main.lua": "--",
				},
			},
		});

		const error = await refusal(mods.install(context, ITEM));

		expect(error).toBeInstanceOf(Error);
		expect(error).not.toBeInstanceOf(BridgeUserError);
		expect(
			[
				...files.keys(),
			].filter((path) => path.startsWith("Mods/")),
		).toEqual([]);
		expect(await records()).toEqual([]);
		expect(leftovers(files)).toEqual([]);
	});

	it("refuses an id that is not a workshop item id before it touches a file", async () => {
		const { context, files } = await harness({
			archives: delivered(),
		});

		const error = await refusal(mods.install(context, "../../Pal/Saved"));

		expect(error).toBeInstanceOf(Error);
		expect(error).not.toBeInstanceOf(BridgeUserError);
		expect(files.has(ARCHIVE)).toBe(true);
	});

	it("fails loudly when the platform delivered no archive, and leaves no staging behind", async () => {
		const { context, files } = await harness();

		const error = await refusal(mods.install(context, ITEM));

		expect(error).toBeInstanceOf(Error);
		expect(error).not.toBeInstanceOf(BridgeUserError);
		expect(leftovers(files)).toEqual([]);
	});

	it("tells the customer to start the server once before the first install", async () => {
		const { context, files } = await harness({
			stamped: false,
			archives: delivered(),
		});

		const error = await refusal(mods.install(context, ITEM));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).message).toContain("Start it once");
		expect(leftovers(files)).toEqual([]);
	});
});

describe("uploading a mod", () => {
	const staged = ".serverk-staging/mod-upload/BetterChat";

	it("installs the uploaded zip, returns its entry and clears the staging", async () => {
		const { context, files } = await harness({
			files: {
				[`${staged}/BetterChat/Scripts/main.lua`]: "--",
			},
		});

		const entry = await add(context, staged);

		expect(entry.id).toBe("upload:ue4ss:BetterChat");
		expect(entry.provider).toBeNull();
		expect(entry.enabled).toBe(true);
		expect(files.get("Mods/UE4SSMods/BetterChat/Scripts/main.lua")).toBe("--");
		expect(leftovers(files)).toEqual([]);
	});

	it("turns a catalog install the upload overwrote into an upload", async () => {
		const upload = `.serverk-staging/mod-upload/${ITEM}`;
		const { context, records } = await harness({
			records: [
				catalogRecord,
			],
			files: {
				[`Mods/Workshop/${ITEM}/Info.json`]: infoOf("RefinedRanches", "1.0.0"),
				[`${upload}/Info.json`]: infoOf("RefinedRanches", "1.5.0-nexus"),
			},
		});

		const entry = await add(context, upload);

		expect(entry.id).toBe(`upload:workshop:${ITEM}`);
		expect(entry.version).toBe("1.5.0-nexus");
		expect(await records()).toEqual([
			{
				id: `workshop:${ITEM}`,
				enabled: true,
			},
		]);
	});

	it("refuses an upload on the linux edition and clears the staging", async () => {
		const { context, files } = await harness({
			edition: PalworldEdition.Linux,
			files: {
				[`${staged}/BetterChat/Scripts/main.lua`]: "--",
			},
		});

		const error = await refusal(add(context, staged));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect(leftovers(files)).toEqual([]);
		expect(files.has("Mods/UE4SSMods/BetterChat/Scripts/main.lua")).toBe(false);
	});

	it("refuses an upload of PalSchema itself in its workshop form", async () => {
		const { context } = await harness({
			files: {
				[`${staged}/Info.json`]: infoOf("PalSchema", "0.6.71"),
			},
		});

		const error = await refusal(add(context, staged));

		expect((error as BridgeUserError).message).toContain("already included");
	});

	it("refuses a path outside the upload staging", async () => {
		const { context } = await harness({
			files: {
				"Pal/Saved/SaveGames/0/Level.sav": "save",
			},
		});

		const error = await refusal(add(context, "Pal/Saved/SaveGames"));

		expect(error).toBeInstanceOf(BridgeUserError);
	});

	it("installs a bare pak as a paks package named after the upload", async () => {
		const upload = ".serverk-staging/mod-upload/Expanded Base Radius 1234 1 2026-08-13T06-05Z Ab1rBHP6A";
		const { context, files } = await harness({
			files: {
				[`${upload}/ExpandedBaseRadius_P.pak`]: PAK,
			},
		});

		const entry = await add(context, upload);

		expect(entry.id).toBe("upload:paks:Expanded Base Radius");
		expect(files.get("Mods/PakMods/Expanded Base Radius/ExpandedBaseRadius_P.pak")).toBe(PAK);
		expect(leftovers(files)).toEqual([]);
	});

	it("replaces an installed package of the same name, whichever folder kept it", async () => {
		const { context, files, records } = await harness({
			records: [
				{
					id: "ue4ss:BetterChat",
					enabled: false,
				},
			],
			files: {
				"Mods/UE4SSMods/BetterChat/Scripts/main.lua": "-- old",
				[`${staged}/BetterChat/Info.json`]: JSON.stringify({
					PackageName: "BetterChat",
					InstallRule: [
						{
							Type: "Lua",
							IsServer: true,
							Targets: [
								"./Scripts",
							],
						},
					],
				}),
				[`${staged}/BetterChat/Scripts/main.lua`]: "-- new",
			},
		});

		const entry = await add(context, staged);

		expect(entry.id).toBe("upload:workshop:BetterChat");
		expect(files.has("Mods/UE4SSMods/BetterChat/Scripts/main.lua")).toBe(false);
		expect(files.get("Mods/Workshop/BetterChat/Scripts/main.lua")).toBe("-- new");
		expect(await records()).toEqual([]);
	});

	it("refuses an archive that carries ue4ss itself, even beside the owner's mod, and installs nothing", async () => {
		const { context, files } = await harness({
			files: {
				[`${staged}/Pal/Binaries/Win64/dwmapi.dll`]: "loader",
				[`${staged}/Pal/Binaries/Win64/ue4ss/UE4SS.dll`]: "ue4ss",
				[`${staged}/Pal/Binaries/Win64/ue4ss/Mods/BetterChat/Scripts/main.lua`]: "--",
			},
		});

		const error = await refusal(add(context, staged));

		expect((error as BridgeUserError).message).toContain("already included");
		expect(files.has("Mods/UE4SSMods/BetterChat/Scripts/main.lua")).toBe(false);
		expect(leftovers(files)).toEqual([]);
	});

	it("refuses a native mod that loads through a proxy dll, such as paldefender, as not supported yet", async () => {
		const { context, files } = await harness({
			files: {
				[`${staged}/Pal/Binaries/Win64/PalDefender.dll`]: "dll",
				[`${staged}/Pal/Binaries/Win64/d3d9.dll`]: "dll",
			},
		});

		const error = await refusal(add(context, staged));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text).toEqual({
			ar: "لا تدعم منصة سيرفرك حتى الآن المودات التي تشتغل بملف DLL خاص بها بجانب ملفات اللعبة، مثل PalDefender. ارفع ملف zip لمود UE4SS أو PalSchema أو pak.",
			en: "Mods that run their own DLL beside the game's files, such as PalDefender, aren't supported on Serverk yet. Upload the zip of a UE4SS, PalSchema or pak mod.",
		});
		expect(leftovers(files)).toEqual([]);
	});

	it("installs a package whose dependency is not installed, and names the dependency in its note", async () => {
		const { context, files } = await harness({
			files: {
				[`${staged}/Info.json`]: JSON.stringify({
					PackageName: "Expedition",
					Dependencies: [
						"UE4SSExperimentalPW",
						"CoreLib",
					],
					InstallRule: [
						{
							Type: "Lua",
							IsServer: true,
							Targets: [
								"./Scripts",
							],
						},
					],
				}),
				[`${staged}/Scripts/main.lua`]: "--",
			},
		});

		const entry = await add(context, staged);

		expect(files.get("Mods/Workshop/BetterChat/Scripts/main.lua")).toBe("--");
		expect(entry.note).toEqual({
			ar: "يتطلب CoreLib، وهو غير مثبّت",
			en: "Needs CoreLib, which isn't installed",
		});
	});

	it("refuses a package named like a mod the pinned ue4ss ships, in any letter case", async () => {
		const trees: Record<string, string>[] = [
			{
				[`${staged}/BPModLoaderMod/Scripts/main.lua`]: "--",
			},
			{
				[`${staged}/keybinds/Scripts/main.lua`]: "--",
			},
			{
				[`${staged}/Info.json`]: JSON.stringify({
					PackageName: "Shared",
					InstallRule: [
						{
							Type: "Lua",
							IsServer: true,
						},
					],
				}),
				[`${staged}/Scripts/main.lua`]: "--",
			},
		];

		for (const tree of trees) {
			const { context, files } = await harness({
				files: tree,
			});

			const error = await refusal(add(context, staged));

			expect((error as BridgeUserError).message).toContain("already included");
			expect(
				[
					...files.keys(),
				].filter((path) => path.startsWith("Mods/")),
			).toEqual([]);
		}
	});

	it("refuses an upload with more files than the server can list, in words the owner can read", async () => {
		const { context, files } = await harness({
			listLimit: 2,
			files: {
				[`${staged}/BetterChat/Scripts/main.lua`]: "--",
				[`${staged}/BetterChat/Scripts/a.lua`]: "--",
				[`${staged}/BetterChat/Scripts/b.lua`]: "--",
			},
		});

		const error = await refusal(add(context, staged));

		expect(error).toBeInstanceOf(BridgeUserError);
		expect((error as BridgeUserError).text).toEqual({
			ar: "يحتوي المود على ملفات أكثر مما نستطيع تثبيته. إذا جمع الملف أكثر من مود، فارفع كل مود في ملف zip مستقل.",
			en: "This mod has more files than we can install. If the file bundles several mods, upload each one in its own zip.",
		});
		expect(leftovers(files)).toEqual([]);
	});

	it("tells the owner there is no mod inside an archive with nothing a server runs", async () => {
		const { context } = await harness({
			files: {
				[`${staged}/readme.txt`]: "hello",
			},
		});

		const error = await refusal(add(context, staged));

		expect((error as BridgeUserError).message).toContain("no mod inside");
	});
});

describe("removing and toggling a mod", () => {
	const installedFiles = {
		[`Mods/Workshop/${ITEM}/Info.json`]: infoOf("RefinedRanches", "1.0.0"),
		"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
	};

	it("removes a catalog install by its item id, its files and its record together", async () => {
		const { context, files, records } = await harness({
			records: [
				catalogRecord,
			],
			files: installedFiles,
		});

		await mods.remove(context, ITEM);

		expect(files.has(`Mods/Workshop/${ITEM}/Info.json`)).toBe(false);
		expect(files.has("Mods/UE4SSMods/FastCraft/Scripts/main.lua")).toBe(true);
		expect(await records()).toEqual([]);
	});

	it("removes an upload by its upload id", async () => {
		const { context, files } = await harness({
			files: installedFiles,
		});

		await mods.remove(context, "upload:ue4ss:FastCraft");

		expect(files.has("Mods/UE4SSMods/FastCraft/Scripts/main.lua")).toBe(false);
		expect(files.has(`Mods/Workshop/${ITEM}/Info.json`)).toBe(true);
	});

	it("succeeds when the mod is already gone", async () => {
		const { context, files } = await harness({
			files: installedFiles,
		});

		await mods.remove(context, "999");

		expect(files.size).toBe(Object.keys(installedFiles).length + 1);
	});

	it("turns a catalog install off and on again, keeping what it recorded", async () => {
		const { context, records } = await harness({
			records: [
				catalogRecord,
			],
			files: installedFiles,
		});

		await toggle(context, ITEM, false);

		expect(await records()).toEqual([
			{
				...catalogRecord,
				enabled: false,
			},
		]);

		await toggle(context, ITEM, true);

		expect(await records()).toEqual([
			catalogRecord,
		]);
	});

	it("turns an upload off by its upload id", async () => {
		const { context, records } = await harness({
			files: installedFiles,
		});

		await toggle(context, "upload:ue4ss:FastCraft", false);

		expect(await records()).toEqual([
			{
				id: "ue4ss:FastCraft",
				enabled: false,
			},
		]);
		expect((await mods.installed(context)).find((entry) => entry.id === "upload:ue4ss:FastCraft")?.enabled).toBe(false);
	});

	it("refuses to toggle a mod the server does not have", async () => {
		const { context } = await harness({
			files: installedFiles,
		});

		expect(await refusal(toggle(context, "999", false))).toBeInstanceOf(BridgeUserError);
	});
});

describe("telling the customer whether each mod loaded", () => {
	const notesOf = async (context: Bridge.Context) => {
		return Object.fromEntries(
			(await mods.installed(context)).map((entry) => [
				entry.id,
				entry.note?.en,
			]),
		);
	};

	const clientOnly = JSON.stringify({
		ModName: "Better Map",
		PackageName: "BetterMap",
		Version: "1.0.0",
		InstallRule: [
			{
				Type: "Paks",
				IsServer: false,
			},
		],
	});

	const loaderOnly = JSON.stringify({
		PackageName: "OtherLoader",
		InstallRule: [
			{
				Type: "UE4SS",
				IsServer: true,
				Targets: [
					".",
				],
			},
		],
	});

	const needsCore = JSON.stringify({
		PackageName: "Expedition",
		Dependencies: [
			"UE4SSExperimentalPW",
			"BetterRates",
			"CoreLib",
		],
		InstallRule: [
			{
				Type: "Lua",
				IsServer: true,
				Targets: [
					"./Scripts",
				],
			},
		],
	});

	const files = {
		[`Mods/Workshop/${ITEM}/Info.json`]: infoOf("RefinedRanches", "1.0.0"),
		"Mods/Workshop/BetterMap/Info.json": clientOnly,
		"Mods/Workshop/BetterMap/Paks/BetterMap_P.pak": PAK,
		"Pal/Content/Paks/~mods/BetterMap/Paks/BetterMap_P.pak": PAK,
		"Mods/Workshop/OtherLoader/Info.json": loaderOnly,
		"Mods/Workshop/RaidBoss/Info.json": JSON.stringify({
			PackageName: "RaidBoss",
			InstallRule: [
				{
					Type: "LogicMods",
					IsServer: true,
					Targets: [
						"./LogicMods/",
					],
				},
			],
		}),
		"Mods/Workshop/RaidBoss/LogicMods/RaidBoss.pak": PAK,
		"Pal/Content/Paks/LogicMods/RaidBoss/RaidBoss.pak": PAK,
		"Mods/Workshop/Expedition/Info.json": needsCore,
		"Mods/Workshop/Expedition/Scripts/main.lua": "--",
		"Mods/PalSchemaMods/BetterRates/raw/rates.json": "{}",
		"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
		"Mods/UE4SSMods/Broken/Scripts/main.lua": "--",
		"Mods/UE4SSMods/QuietNights/Scripts/main.lua": "--",
		"Mods/UE4SSMods/LateArrival/Scripts/main.lua": "--",
		[MOD_DEPLOY_FILE]: JSON.stringify([
			`workshop:${ITEM}`,
			"palschema:BetterRates",
			"ue4ss:FastCraft",
			{
				id: "ue4ss:Broken",
				paths: [
					"Pal/Binaries/Win64/ue4ss/Mods/Broken",
				],
			},
			{
				id: "workshop:BetterMap",
				paths: [
					"Pal/Content/Paks/~mods/BetterMap",
				],
			},
			{
				id: "workshop:RaidBoss",
				paths: [
					"Pal/Content/Paks/LogicMods/RaidBoss",
				],
			},
		]),
		[UE4SS_LOG]: [
			"[2026-10-19 12:03:33.8903143] Mod 'PalSchema' has enabled.txt, starting mod.",
			"[2026-10-19 12:03:39.9012979] [PalSchema] Loading mod: BetterRates",
			"[2026-10-19 12:03:40.3818816] Mod 'FastCraft' has enabled.txt, starting mod.",
		].join("\n"),
	};

	it("reads each mod's state from what the last start left behind: the ue4ss log for lua and palschema, the placed folder for paks", async () => {
		const { context } = await harness({
			records: [
				catalogRecord,
				{
					id: "ue4ss:QuietNights",
					enabled: false,
				},
			],
			files,
		});

		expect(await notesOf(context)).toEqual({
			[ITEM]: "Couldn't start. Check the console",
			"upload:workshop:BetterMap": "Running",
			"upload:workshop:Expedition": "Needs CoreLib, which isn't installed",
			"upload:workshop:OtherLoader": "Doesn't run on servers",
			"upload:workshop:RaidBoss": "Running",
			"upload:palschema:BetterRates": "Running",
			"upload:ue4ss:Broken": "Couldn't start. Check the console",
			"upload:ue4ss:FastCraft": "Running",
			"upload:ue4ss:LateArrival": "Runs after a restart",
			"upload:ue4ss:QuietNights": "Off",
		});
	});

	it("lists a package too large to list, by its Info.json, with a note that it has too many files to place", async () => {
		const { context } = await harness({
			listLimit: 2,
			files: {
				"Mods/Workshop/Huge/Info.json": JSON.stringify({
					ModName: "Huge Pack",
					PackageName: "HugePack",
					InstallRule: [
						{
							Type: "Paks",
							IsServer: true,
						},
					],
				}),
				"Mods/Workshop/Huge/a.pak": PAK,
				"Mods/Workshop/Huge/b.pak": PAK,
			},
		});

		const [entry] = await mods.installed(context);

		expect(entry?.title).toBe("Huge Pack");
		expect(entry?.note?.en).toBe("Too many files to place");
	});

	it("reads the start lines from a ue4ss log larger than the bridge reads whole", async () => {
		const { context } = await harness({
			files: {
				"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
				[MOD_DEPLOY_FILE]: JSON.stringify([
					"ue4ss:FastCraft",
				]),
				[UE4SS_LOG]: [
					"[2026-10-19 12:03:40.3818816] Mod 'FastCraft' has enabled.txt, starting mod.",
					"x".repeat(BRIDGE_READ_LIMIT + 1),
				].join("\n"),
			},
		});

		expect((await mods.installed(context)).map((entry) => entry.note?.en)).toEqual([
			"Running",
		]);
	});

	it("says a mod runs after a restart, and still lists it, when the ue4ss log cannot be read", async () => {
		const { context } = await harness({
			files: {
				"Mods/UE4SSMods/FastCraft/Scripts/main.lua": "--",
				[MOD_DEPLOY_FILE]: JSON.stringify([
					"ue4ss:FastCraft",
				]),
				[UE4SS_LOG]: "Mod 'FastCraft' has enabled.txt, starting mod.",
			},
		});
		const unreadable = {
			...context,
			async exec(command: string[]) {
				if (command[0] === "grep") {
					throw new Error("grep timed out");
				}

				return await context.exec(command);
			},
		} as unknown as Bridge.Context;

		expect((await mods.installed(unreadable)).map((entry) => entry.note?.en)).toEqual([
			"Runs after a restart",
		]);
	});

	it("says every mod runs on windows only while the server is on linux", async () => {
		const { context } = await harness({
			edition: PalworldEdition.Linux,
			files,
		});

		expect(new Set(Object.values(await notesOf(context)))).toEqual(
			new Set([
				"Runs on Windows only",
			]),
		);
	});

	it("says a freshly installed workshop item runs after a restart", async () => {
		const { context } = await harness({
			archives: delivered(),
		});

		expect((await mods.install(context, ITEM)).note).toEqual({
			ar: "يشتغل بعد الريستارت",
			en: "Runs after a restart",
		});
	});
});
