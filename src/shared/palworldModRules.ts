export enum ModRuleType {
	Ue4ss = "UE4SS",
	Lua = "Lua",
	PalSchema = "PalSchema",
	LogicMods = "LogicMods",
	Paks = "Paks",
}

export interface ModRule {
	type: ModRuleType;
	targets: string[];
}

export interface PalworldModInfo {
	packageName: string | null;
	name: string | null;
	version: string | null;
	rules: ModRule[];
	dependencies: string[];
}

export const WHOLE_PACKAGE = "";

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

export const LUA_MARKERS = [
	"scripts/main.lua",
	"dlls/main.dll",
];

const PAK_EXTENSIONS = [
	".pak",
	".utoc",
	".ucas",
];

const PACKAGE_EXTRA =
	/^(info\.json|\.workshop\.json|thumbnail\..+|workshopdescription\.txt|changelog\.txt|license.*|.+\.example)$/i;

const PACKAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

const WINDOWS_DRIVE = /^[A-Za-z]:/;

const RULE_TYPES = Object.values(ModRuleType);

interface ParsedRule extends ModRule {
	server: boolean;
}

export const isRecord = (raw: unknown): raw is Record<string, unknown> => {
	return typeof raw === "object" && raw !== null && !Array.isArray(raw);
};

export const textOf = (raw: unknown) => {
	return typeof raw === "string" && raw.length > 0 ? raw : null;
};

export const isPackageName = (name: string) => {
	return PACKAGE_NAME.test(name);
};

export const isPackageExtra = (path: string) => {
	return !path.includes("/") && PACKAGE_EXTRA.test(path);
};

export const isPakFile = (path: string) => {
	const lower = path.toLowerCase();

	return PAK_EXTENSIONS.some((extension) => lower.endsWith(extension));
};

export const relativePathOf = (raw: unknown): string | null => {
	if (typeof raw !== "string") {
		return null;
	}

	const path = raw.trim().replaceAll("\\", "/");
	const segments = path.split("/").filter((segment) => segment.length > 0 && segment !== ".");

	if (path.startsWith("/") || WINDOWS_DRIVE.test(path) || segments.includes("..")) {
		return null;
	}

	return segments.join("/");
};

export const filesUnder = (files: string[], target: string) => {
	const lower = target.toLowerCase();

	return target === WHOLE_PACKAGE
		? files
		: files.filter((file) => {
				const name = file.toLowerCase();

				return name === lower || name.startsWith(`${lower}/`);
			});
};

const ruleOf = (raw: unknown): ParsedRule[] => {
	if (!isRecord(raw)) {
		return [];
	}

	const type = RULE_TYPES.find((entry) => {
		return typeof raw.Type === "string" && entry.toLowerCase() === raw.Type.trim().toLowerCase();
	});
	const listed = Array.isArray(raw.Targets) ? raw.Targets : [];

	if (type === undefined) {
		return [];
	}

	return [
		{
			type,
			targets:
				listed.length === 0
					? [
							WHOLE_PACKAGE,
						]
					: listed.map(relativePathOf).filter((target) => target !== null),
			server: raw.IsServer === true,
		},
	];
};

export const installRulesOf = (raw: unknown): ModRule[] => {
	const rules = (Array.isArray(raw) ? raw : []).flatMap(ruleOf);
	const server = rules.filter((rule) => rule.server);

	return (server.length > 0 ? server : rules).map((rule) => {
		return {
			type: rule.type,
			targets: rule.targets,
		};
	});
};

export const modInfoOf = (raw: unknown): PalworldModInfo => {
	if (!isRecord(raw)) {
		return {
			packageName: null,
			name: null,
			version: null,
			rules: [],
			dependencies: [],
		};
	}

	const packageName = textOf(raw.PackageName);
	const dependencies = Array.isArray(raw.Dependencies) ? raw.Dependencies : [];

	return {
		packageName: packageName !== null && isPackageName(packageName) ? packageName : null,
		name: textOf(raw.ModName),
		version: textOf(raw.Version),
		rules: installRulesOf(raw.InstallRule),
		dependencies: dependencies.filter((name): name is string => typeof name === "string" && isPackageName(name)),
	};
};

const layoutTypeOf = (files: string[]) => {
	const lower = files.map((file) => file.toLowerCase());

	if (lower.some((file) => LUA_MARKERS.includes(file))) {
		return ModRuleType.Lua;
	}

	if (lower.some((file) => file.includes("/") && PALSCHEMA_FOLDERS.includes(file.split("/")[0] ?? ""))) {
		return ModRuleType.PalSchema;
	}

	return files.some(isPakFile) ? ModRuleType.Paks : null;
};

export const layoutRuleOf = (files: string[]): ModRule | null => {
	const type = layoutTypeOf(files);

	return type === null
		? null
		: {
				type,
				targets: [
					WHOLE_PACKAGE,
				],
			};
};

export const rulesOf = (info: PalworldModInfo, files: string[]): ModRule[] => {
	if (info.rules.length > 0) {
		return info.rules;
	}

	const rule = layoutRuleOf(files);

	return rule === null
		? []
		: [
				rule,
			];
};
