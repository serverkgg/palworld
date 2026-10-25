import type { Bridge } from "@serverkgg/bridge";
import {
	editionOf,
	filesUnder,
	installedMods,
	isPackageExtra,
	type ModDestination,
	type ModPackage,
	ModRuleType,
	modDestinationsOf,
	modEnabled,
	modIdOf,
	PalworldEdition,
	type PlacedMod,
	readInstallStamp,
	readPlacedMods,
	UE4SS_DIRECTORY,
	WHOLE_PACKAGE,
	WINDOWS_BINARY_DIRECTORY,
	writePlacedMods,
} from "../shared";

const UE4SS_SOURCE = "/opt/serverk/ue4ss";

const UE4SS_LOADER = `${WINDOWS_BINARY_DIRECTORY}/dwmapi.dll`;

const UE4SS_ENABLED_FILE = "enabled.txt";

export const MOD_SETTINGS_FILE = "Mods/PalModSettings.ini";

export const MOD_SETTINGS = [
	"[PalModSettings]",
	"bGlobalEnableMod=False",
	"ConfigVersion=1.0",
	"",
].join("\n");

const UE4SS_RULES = [
	ModRuleType.Lua,
	ModRuleType.PalSchema,
	ModRuleType.LogicMods,
];

const copy = async (context: Bridge.Context, args: string[]) => {
	const result = await context.exec([
		"cp",
		"-a",
		...args,
	]);

	if (result.code !== 0) {
		throw new Error(`could not copy ${args.join(" ")}`);
	}
};

export const placementsOf = (mod: Pick<ModPackage, "files">, type: ModRuleType, target: string) => {
	const placements = new Map<string, string>();

	for (const file of filesUnder(mod.files, target)) {
		if (isPackageExtra(file)) {
			continue;
		}

		const contents = file.length === target.length ? (file.split("/").at(-1) ?? file) : file.slice(target.length + 1);

		placements.set(type === ModRuleType.Lua || target === WHOLE_PACKAGE ? file : contents, file);
	}

	return placements;
};

const placementsFor = (context: Bridge.Context, mod: ModPackage, destination: ModDestination) => {
	const placements = new Map<string, string>();

	for (const rule of mod.rules.filter((entry) => entry.type === destination.type)) {
		for (const target of rule.targets) {
			const found = placementsOf(mod, destination.type, target);

			if (found.size === 0) {
				context.log("skipped a mod target the package does not carry", {
					mod: mod.folder,
					target,
				});
			}

			for (const [placed, file] of found) {
				placements.set(placed, file);
			}
		}
	}

	return placements;
};

const placeMod = async (context: Bridge.Context, mod: ModPackage): Promise<PlacedMod> => {
	const destinations = modDestinationsOf(mod);

	for (const destination of destinations) {
		const directories = new Map<string, string[]>();

		for (const [placed, file] of placementsFor(context, mod, destination)) {
			const directory = [
				destination.path,
				...placed.split("/").slice(0, -1),
			].join("/");

			directories.set(directory, [
				...(directories.get(directory) ?? []),
				`${mod.path}/${file}`,
			]);
		}

		await context.files.remove(destination.path);
		await context.files.ensure(destination.path);

		for (const [directory, files] of directories) {
			await context.files.ensure(directory);
			await copy(context, [
				"-t",
				directory,
				...files,
			]);
		}

		if (destination.type === ModRuleType.Lua) {
			await context.files.write(`${destination.path}/${UE4SS_ENABLED_FILE}`, "");
		}
	}

	return {
		id: modIdOf(mod.kind, mod.folder),
		paths: destinations.map((destination) => destination.path),
	};
};

const needsUe4ss = (mod: ModPackage) => {
	return mod.rules.some((rule) => UE4SS_RULES.includes(rule.type));
};

export const deployMods = async (context: Bridge.Context): Promise<ModPackage[]> => {
	const windows = editionOf(context) === PalworldEdition.Windows;
	const records = (await readInstallStamp(context))?.mods ?? [];
	const installed = await installedMods(context);
	const wanted = installed.filter((mod) => {
		const placeable = mod.oversized || modDestinationsOf(mod).length > 0;

		return windows && placeable && modEnabled(records, modIdOf(mod.kind, mod.folder));
	});
	const enabled = wanted.filter((mod) => !mod.oversized);
	const stale = new Set([
		...(await readPlacedMods(context)).flatMap((placed) => placed.paths),
		...installed.flatMap((mod) => modDestinationsOf(mod).map((destination) => destination.path)),
	]);

	await context.files.remove(UE4SS_LOADER);
	await context.files.remove(UE4SS_DIRECTORY);

	for (const path of stale) {
		await context.files.remove(path);
	}

	if (enabled.some(needsUe4ss)) {
		await copy(context, [
			"-T",
			UE4SS_SOURCE,
			WINDOWS_BINARY_DIRECTORY,
		]);
	}

	for (const mod of wanted.filter((entry) => entry.oversized)) {
		context.log("skipped a mod with too many files to place", {
			mod: mod.folder,
		});
	}

	const placed: PlacedMod[] = [];

	for (const mod of enabled) {
		placed.push(await placeMod(context, mod));
	}

	await writePlacedMods(context, placed);

	if (windows) {
		await context.files.write(MOD_SETTINGS_FILE, MOD_SETTINGS);
	}

	return enabled;
};
