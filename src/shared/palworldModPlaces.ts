import type { Bridge } from "@serverkgg/bridge";
import { WINDOWS_BINARY_DIRECTORY } from "./palworldEdition";
import { isRecord, ModRuleType } from "./palworldModRules";
import { isPinnedName, type ModPackage, modNameOf } from "./palworldMods";

export const UE4SS_DIRECTORY = `${WINDOWS_BINARY_DIRECTORY}/ue4ss`;

const UE4SS_MODS = `${UE4SS_DIRECTORY}/Mods`;

export const MOD_DEPLOY_FILE = ".serverk-mods.json";

const MOD_DESTINATIONS: Record<ModRuleType, string | null> = {
	[ModRuleType.Ue4ss]: null,
	[ModRuleType.Lua]: UE4SS_MODS,
	[ModRuleType.PalSchema]: `${UE4SS_MODS}/PalSchema/mods`,
	[ModRuleType.LogicMods]: "Pal/Content/Paks/LogicMods",
	[ModRuleType.Paks]: "Pal/Content/Paks/~mods",
};

export interface ModDestination {
	type: ModRuleType;
	path: string;
}

export interface PlacedMod {
	id: string | null;
	paths: string[];
}

const isOneFolder = (name: string) => {
	return name.length > 0 && name !== "." && name !== ".." && !/[\\/]/.test(name);
};

export const modDestinationsOf = (mod: ModPackage): ModDestination[] => {
	const name = modNameOf(mod);

	if (!isOneFolder(name) || isPinnedName(name)) {
		return [];
	}

	return [
		...new Set(mod.rules.map((rule) => rule.type)),
	].flatMap((type) => {
		const root = MOD_DESTINATIONS[type];

		return root === null
			? []
			: [
					{
						type,
						path: `${root}/${name}`,
					},
				];
	});
};

const isPlacedPath = (path: string) => {
	return Object.values(MOD_DESTINATIONS).some((root) => {
		return root !== null && path.startsWith(`${root}/`) && isOneFolder(path.slice(root.length + 1));
	});
};

export const placedModsOf = (raw: unknown): PlacedMod[] => {
	if (!Array.isArray(raw)) {
		return [];
	}

	return raw.flatMap((entry) => {
		if (typeof entry === "string") {
			return [
				{
					id: entry,
					paths: [],
				},
			];
		}

		if (!isRecord(entry) || (typeof entry.id !== "string" && entry.id !== null)) {
			return [];
		}

		const paths = Array.isArray(entry.paths) ? entry.paths : [];

		return [
			{
				id: entry.id,
				paths: paths.filter((path): path is string => typeof path === "string" && isPlacedPath(path)),
			},
		];
	});
};

export const readPlacedMods = async (context: Bridge.Context) => {
	try {
		return placedModsOf(JSON.parse(await context.files.read(MOD_DEPLOY_FILE)));
	} catch {
		return [];
	}
};

export const writePlacedMods = async (context: Bridge.Context, placed: PlacedMod[]) => {
	await context.files.write(MOD_DEPLOY_FILE, JSON.stringify(placed));
};

export const forgetPlacedMods = async (context: Bridge.Context, ids: string[]) => {
	const placed = await readPlacedMods(context);

	await writePlacedMods(
		context,
		placed.map((entry) => {
			return entry.id !== null && ids.includes(entry.id)
				? {
						id: null,
						paths: entry.paths,
					}
				: entry;
		}),
	);
};
