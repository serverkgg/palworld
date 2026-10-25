import type { Bridge } from "@serverkgg/bridge";
import {
	isPackageName,
	isRecord,
	type ModRule,
	modInfoOf,
	type PalworldModInfo,
	rulesOf,
	textOf,
} from "./palworldModRules";

export enum PalworldModKind {
	Workshop = "workshop",
	PalSchema = "palschema",
	Lua = "ue4ss",
	Paks = "paks",
}

export const MOD_ROOTS: Record<PalworldModKind, string> = {
	[PalworldModKind.Workshop]: "Mods/Workshop",
	[PalworldModKind.PalSchema]: "Mods/PalSchemaMods",
	[PalworldModKind.Lua]: "Mods/UE4SSMods",
	[PalworldModKind.Paks]: "Mods/PakMods",
};

export const MOD_INFO_FILE = "Info.json";

export const MOD_STAGING = ".serverk-staging/mod-upload";

export const WORKSHOP_APP_ID = 1_623_730;

export const WORKSHOP_ITEM_ID = /^\d{1,20}$/;

export const MOD_UPLOAD_EXTENSIONS = [
	"zip",
];

export const BUNDLED_PACKAGES = [
	"UE4SSExperimentalPW",
	"PalSchema",
];

const PINNED_MOD_NAMES = [
	...BUNDLED_PACKAGES,
	"BPModLoaderMod",
	"BPML_GenericFunctions",
	"CheatManagerEnablerMod",
	"ConsoleCommandsMod",
	"ConsoleEnablerMod",
	"Keybinds",
	"LineTraceMod",
	"SplitScreenMod",
	"shared",
	"mods.txt",
];

export const MOD_LISTING_LIMIT = /exceeded its (result|scan) limit/;

const MOD_FOLDER = /^[A-Za-z0-9 _.()-]{1,128}$/;

export interface PalworldMod {
	id: string;
	enabled: boolean;
	itemId?: string;
	packageName?: string;
	version?: string;
}

export interface ModPackage {
	kind: PalworldModKind;
	folder: string;
	path: string;
	info: PalworldModInfo;
	rules: ModRule[];
	files: string[];
	sizeBytes: number;
	oversized: boolean;
}

interface PackageFiles {
	files: string[];
	sizeBytes: number;
}

const KINDS = Object.values(PalworldModKind);

export const isModFolder = (name: string) => {
	return MOD_FOLDER.test(name) && name !== "." && name !== "..";
};

export const modIdOf = (kind: PalworldModKind, folder: string) => {
	return `${kind}:${folder}`;
};

export const parseModId = (
	id: string,
): {
	kind: PalworldModKind;
	folder: string;
} | null => {
	const separator = id.indexOf(":");
	const kind = KINDS.find((entry) => entry === id.slice(0, separator));
	const folder = id.slice(separator + 1);

	if (separator <= 0 || kind === undefined || !isModFolder(folder)) {
		return null;
	}

	return {
		kind,
		folder,
	};
};

export const isPinnedName = (name: string) => {
	const lower = name.toLowerCase();

	return PINNED_MOD_NAMES.some((pinned) => pinned.toLowerCase() === lower);
};

export const modNameOf = (mod: Pick<ModPackage, "folder" | "info">) => {
	return mod.info.packageName ?? mod.folder;
};

export const modEnabled = (records: PalworldMod[], id: string) => {
	return records.find((record) => record.id === id)?.enabled ?? true;
};

export const modsOf = (raw: unknown): PalworldMod[] => {
	if (!Array.isArray(raw)) {
		return [];
	}

	return raw.flatMap((entry) => {
		if (!isRecord(entry) || typeof entry.id !== "string" || parseModId(entry.id) === null) {
			return [];
		}

		const mod: PalworldMod = {
			id: entry.id,
			enabled: entry.enabled !== false,
		};
		const itemId = textOf(entry.itemId);
		const packageName = textOf(entry.packageName);
		const version = textOf(entry.version);

		if (itemId !== null && WORKSHOP_ITEM_ID.test(itemId)) {
			mod.itemId = itemId;
		}

		if (packageName !== null && isPackageName(packageName)) {
			mod.packageName = packageName;
		}

		if (version !== null) {
			mod.version = version;
		}

		return [
			mod,
		];
	});
};

const listedPackageOf = async (context: Bridge.Context, path: string): Promise<PackageFiles | null> => {
	try {
		const entries = (await context.files.list(`${path}/**`)).filter((entry) => !entry.directory);

		return {
			files: entries.map((entry) => entry.path.slice(path.length + 1)),
			sizeBytes: entries.reduce((total, entry) => total + entry.sizeBytes, 0),
		};
	} catch (error) {
		if (error instanceof Error && MOD_LISTING_LIMIT.test(error.message)) {
			return null;
		}

		throw error;
	}
};

const readModInfo = async (context: Bridge.Context, path: string): Promise<PalworldModInfo> => {
	try {
		return modInfoOf(JSON.parse(await context.files.read(path)));
	} catch {
		return modInfoOf(null);
	}
};

export const readModPackage = async (
	context: Bridge.Context,
	kind: PalworldModKind,
	folder: string,
	path: string,
): Promise<ModPackage> => {
	const listed = await listedPackageOf(context, path);
	const info = await readModInfo(context, `${path}/${MOD_INFO_FILE}`);
	const files = listed?.files ?? [];

	return {
		kind,
		folder,
		path,
		info,
		rules: rulesOf(info, files),
		files,
		sizeBytes: listed?.sizeBytes ?? 0,
		oversized: listed === null,
	};
};

const modFoldersOf = async (context: Bridge.Context, root: string) => {
	if (!(await context.files.exists(root))) {
		return [];
	}

	const result = await context.exec([
		"find",
		root,
		"-mindepth",
		"1",
		"-maxdepth",
		"1",
		"-type",
		"d",
		"-printf",
		"%f\\n",
	]);

	if (result.code !== 0) {
		throw new Error(`could not list the mod folders in ${root}`);
	}

	return result.stdout
		.split("\n")
		.filter(isModFolder)
		.sort((left, right) => left.localeCompare(right));
};

export const installedMods = async (context: Bridge.Context): Promise<ModPackage[]> => {
	const mods: ModPackage[] = [];

	for (const kind of KINDS) {
		const root = MOD_ROOTS[kind];

		for (const folder of await modFoldersOf(context, root)) {
			const mod = await readModPackage(context, kind, folder, `${root}/${folder}`);

			if (mod.oversized || mod.files.length > 0) {
				mods.push(mod);
			}
		}
	}

	return mods;
};
