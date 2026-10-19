import type { Bridge } from "@serverkgg/bridge";
import { WINDOWS_BINARY_DIRECTORY } from "./palworldEdition";

export enum PalworldModKind {
	Workshop = "workshop",
	PalSchema = "palschema",
	Ue4ss = "ue4ss",
}

export const MOD_ROOTS: Record<PalworldModKind, string> = {
	[PalworldModKind.Workshop]: "Mods/Workshop",
	[PalworldModKind.PalSchema]: "Mods/PalSchemaMods",
	[PalworldModKind.Ue4ss]: "Mods/UE4SSMods",
};

export const MOD_SETTINGS_FILE = "Mods/PalModSettings.ini";

export const MOD_INFO_FILE = "Info.json";

export const MOD_STAGING = ".serverk-staging/mod-upload";

export const MOD_UPLOAD_EXTENSIONS = [
	"zip",
];

const UE4SS_SOURCE = "/opt/serverk/ue4ss";

export const UE4SS_LOADER = `${WINDOWS_BINARY_DIRECTORY}/dwmapi.dll`;

export const UE4SS_DIRECTORY = `${WINDOWS_BINARY_DIRECTORY}/ue4ss`;

export const UE4SS_MODS = `${UE4SS_DIRECTORY}/Mods`;

export const PALSCHEMA_MODS = `${UE4SS_MODS}/PalSchema/mods`;

export const UE4SS_ENABLED_FILE = "enabled.txt";

export const PALSCHEMA_FOLDERS = [
	"appearance",
	"blueprints",
	"buildings",
	"enums",
	"helpguide",
	"items",
	"pals",
	"raw",
	"skins",
	"spawns",
	"translations",
];

export const UE4SS_MARKERS = [
	"Scripts/main.lua",
	"scripts/main.lua",
	"dlls/main.dll",
];

export const BUNDLED_MODS = [
	"PalSchema",
	"UE4SS",
	"BPModLoaderMod",
	"BPML_GenericFunctions",
	"CheatManagerEnablerMod",
	"ConsoleCommandsMod",
	"ConsoleEnablerMod",
	"Keybinds",
	"LineTraceMod",
	"SplitScreenMod",
	"shared",
];

export const BUNDLED_FILES = [
	"dwmapi.dll",
	"UE4SS.dll",
];

export const WINDOWS_HOME = "Z:\\home\\container";

const MOD_FOLDER = /^[A-Za-z0-9 _.()-]{1,128}$/;

const PACKAGE_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

export interface PalworldMod {
	id: string;
	enabled: boolean;
}

export interface PalworldModInfo {
	packageName: string | null;
	name: string | null;
	version: string | null;
	server: boolean;
}

export interface InstalledMod {
	kind: PalworldModKind;
	folder: string;
	info: PalworldModInfo;
}

const KINDS = Object.values(PalworldModKind);

const isRecord = (raw: unknown): raw is Record<string, unknown> => {
	return typeof raw === "object" && raw !== null && !Array.isArray(raw);
};

const textOf = (raw: unknown) => {
	return typeof raw === "string" && raw.length > 0 ? raw : null;
};

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

export const modsOf = (raw: unknown): PalworldMod[] => {
	if (!Array.isArray(raw)) {
		return [];
	}

	return raw.flatMap((entry) => {
		if (!isRecord(entry) || typeof entry.id !== "string" || parseModId(entry.id) === null) {
			return [];
		}

		return [
			{
				id: entry.id,
				enabled: entry.enabled !== false,
			},
		];
	});
};

export const modInfoOf = (raw: unknown): PalworldModInfo => {
	if (!isRecord(raw)) {
		return {
			packageName: null,
			name: null,
			version: null,
			server: false,
		};
	}

	const packageName = textOf(raw.PackageName);
	const rules = Array.isArray(raw.InstallRule) ? raw.InstallRule : [];

	return {
		packageName: packageName !== null && PACKAGE_NAME.test(packageName) ? packageName : null,
		name: textOf(raw.ModName),
		version: textOf(raw.Version),
		server: rules.some((rule) => isRecord(rule) && rule.IsServer === true),
	};
};

export const windowsPathOf = (path: string) => {
	return `${WINDOWS_HOME}\\${path.split("/").join("\\")}`;
};

export const modSettingsOf = (packages: string[]) => {
	return [
		"[PalModSettings]",
		`bGlobalEnableMod=${packages.length > 0 ? "true" : "false"}`,
		`WorkshopRootDir=${windowsPathOf(MOD_ROOTS[PalworldModKind.Workshop])}`,
		"ConfigVersion=1.0",
		...packages.map((name) => `ActiveModList=${name}`),
		"",
	].join("\n");
};

export const modEnabled = (mods: PalworldMod[], id: string) => {
	return mods.find((mod) => mod.id === id)?.enabled ?? true;
};

export const readModInfo = async (context: Bridge.Context, path: string): Promise<PalworldModInfo> => {
	try {
		return modInfoOf(JSON.parse(await context.files.read(path)));
	} catch {
		return modInfoOf(null);
	}
};

const folderInfo = (folder: string): PalworldModInfo => {
	return {
		packageName: null,
		name: folder,
		version: null,
		server: true,
	};
};

export const foldersOf = (paths: string[], root: string) => {
	const folders = new Set<string>();

	for (const path of paths) {
		const folder = path.startsWith(`${root}/`) ? path.slice(root.length + 1).split("/")[0] : "";

		if (folder && path.length > root.length + folder.length + 1 && isModFolder(folder)) {
			folders.add(folder);
		}
	}

	return [
		...folders,
	].sort();
};

const foldersIn = async (context: Bridge.Context, root: string) => {
	const files = (await context.files.list(`${root}/**`)).filter((entry) => !entry.directory);

	return foldersOf(
		files.map((entry) => entry.path),
		root,
	);
};

export const installedMods = async (context: Bridge.Context): Promise<InstalledMod[]> => {
	const mods: InstalledMod[] = [];
	const workshop = MOD_ROOTS[PalworldModKind.Workshop];

	for (const entry of await context.files.list(`${workshop}/*/${MOD_INFO_FILE}`)) {
		const folder = entry.path.split("/").at(-2) ?? "";

		if (!entry.directory && isModFolder(folder)) {
			mods.push({
				kind: PalworldModKind.Workshop,
				folder,
				info: await readModInfo(context, entry.path),
			});
		}
	}

	for (const kind of [
		PalworldModKind.PalSchema,
		PalworldModKind.Ue4ss,
	]) {
		for (const folder of await foldersIn(context, MOD_ROOTS[kind])) {
			mods.push({
				kind,
				folder,
				info: folderInfo(folder),
			});
		}
	}

	return mods;
};

export const activePackages = (installed: InstalledMod[], mods: PalworldMod[]) => {
	const packages: string[] = [];

	for (const mod of installed) {
		const name = mod.info.packageName;

		if (
			mod.kind === PalworldModKind.Workshop
			&& mod.info.server
			&& name !== null
			&& modEnabled(mods, modIdOf(mod.kind, mod.folder))
			&& !packages.includes(name)
		) {
			packages.push(name);
		}
	}

	return packages;
};

export const classicMods = (installed: InstalledMod[], mods: PalworldMod[]) => {
	return installed.filter(
		(mod) => mod.kind !== PalworldModKind.Workshop && modEnabled(mods, modIdOf(mod.kind, mod.folder)),
	);
};

export const writeModSettings = async (context: Bridge.Context, installed: InstalledMod[], mods: PalworldMod[]) => {
	const packages = activePackages(installed, mods);

	await context.files.ensure(MOD_ROOTS[PalworldModKind.Workshop]);
	await context.files.write(MOD_SETTINGS_FILE, modSettingsOf(packages));

	return packages;
};

const copyTree = async (context: Bridge.Context, from: string, to: string) => {
	const result = await context.exec([
		"cp",
		"-a",
		`${from}/.`,
		to,
	]);

	if (result.code !== 0) {
		throw new Error(`could not copy ${from} into ${to}`);
	}
};

const removeIfPresent = async (context: Bridge.Context, path: string) => {
	if (await context.files.exists(path)) {
		await context.files.remove(path);
	}
};

export const deployUe4ss = async (context: Bridge.Context, enabled: InstalledMod[]) => {
	await removeIfPresent(context, UE4SS_LOADER);
	await removeIfPresent(context, UE4SS_DIRECTORY);

	if (enabled.length === 0) {
		return;
	}

	await copyTree(context, UE4SS_SOURCE, WINDOWS_BINARY_DIRECTORY);

	for (const mod of enabled) {
		const target =
			mod.kind === PalworldModKind.PalSchema ? `${PALSCHEMA_MODS}/${mod.folder}` : `${UE4SS_MODS}/${mod.folder}`;

		await context.files.ensure(target);
		await copyTree(context, `${MOD_ROOTS[mod.kind]}/${mod.folder}`, target);

		if (mod.kind === PalworldModKind.Ue4ss) {
			await context.files.write(`${target}/${UE4SS_ENABLED_FILE}`, "");
		}
	}
};

export const MOD_DEPLOY_FILE = ".serverk-mods.json";

export const UE4SS_LOG = `${UE4SS_DIRECTORY}/UE4SS.log`;

export const MANAGED_MODS = "Mods/ManagedMods";

const PALSCHEMA_LOADED = /\[PalSchema\] Loading mod: (.+?)\s*$/gm;

const UE4SS_STARTED = /Mod '(.+?)' has enabled\.txt, starting mod\./g;

export interface ModLoads {
	log: boolean;
	palschema: Set<string>;
	ue4ss: Set<string>;
}

export const modLoadsOf = (log: string | null): ModLoads => {
	return {
		log: log !== null,
		palschema: new Set(
			[
				...(log ?? "").matchAll(PALSCHEMA_LOADED),
			].map((match) => match[1] ?? ""),
		),
		ue4ss: new Set(
			[
				...(log ?? "").matchAll(UE4SS_STARTED),
			].map((match) => match[1] ?? ""),
		),
	};
};

export const readModLoads = async (context: Bridge.Context) => {
	return modLoadsOf((await context.files.exists(UE4SS_LOG)) ? await context.files.read(UE4SS_LOG) : null);
};

export const readDeployedMods = async (context: Bridge.Context) => {
	try {
		const raw: unknown = JSON.parse(await context.files.read(MOD_DEPLOY_FILE));

		return new Set(Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : []);
	} catch {
		return new Set<string>();
	}
};

export const writeDeployedMods = async (context: Bridge.Context, ids: string[]) => {
	await context.files.write(MOD_DEPLOY_FILE, JSON.stringify(ids));
};

export const workshopDeployed = async (context: Bridge.Context, mod: InstalledMod) => {
	const name = mod.info.packageName;

	return name !== null && (await context.files.exists(`${MANAGED_MODS}/${name}/InstallManifest.json`));
};

export const modLoaded = (mod: InstalledMod, loads: ModLoads) => {
	if (mod.kind === PalworldModKind.PalSchema) {
		return loads.palschema.has(mod.folder);
	}

	return loads.ue4ss.has(mod.folder);
};

export const deployedModIds = (installed: InstalledMod[], mods: PalworldMod[]) => {
	return installed
		.filter((mod) => mod.info.server && modEnabled(mods, modIdOf(mod.kind, mod.folder)))
		.map((mod) => modIdOf(mod.kind, mod.folder));
};
