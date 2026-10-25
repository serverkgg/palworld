import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import {
	isModFolder,
	isPakFile,
	isPinnedName,
	LUA_MARKERS,
	MOD_INFO_FILE,
	MOD_LISTING_LIMIT,
	MOD_ROOTS,
	MOD_STAGING,
	type ModPackage,
	ModRuleType,
	modIdOf,
	modNameOf,
	PALSCHEMA_FOLDERS,
	PalworldModKind,
	parseModId,
	readModPackage,
	relativePathOf,
} from "../shared";

const NEXUS_SUFFIX = / \d+ \S+ \d{4}-\d{2}-\d{2}T\d{2}-\d{2}(-\d{2})?Z \S+$/;

const BUNDLED_FILES = [
	"ue4ss.dll",
	"dwmapi.dll",
];

const BUNDLED_PALSCHEMA = "palschema/dlls/main.dll";

const PROXY_DLLS = [
	"d3d9.dll",
	"version.dll",
	"winmm.dll",
	"xinput1_3.dll",
];

const PAK_CONTAINERS = [
	"paks",
	"~mods",
	"logicmods",
];

const NO_MOD: Bridge.Text = {
	ar: "لا يوجد مود داخل الملف. ارفع ملف zip للمود كما نزّلته، سواء كان من Steam Workshop أو مود PalSchema أو مود UE4SS.",
	en: "There's no mod inside the file. Upload the mod's zip as you downloaded it, whether it's a Steam Workshop, PalSchema or UE4SS mod.",
};

const ALREADY_INCLUDED: Bridge.Text = {
	ar: "نوفر UE4SS و PalSchema مع سيرفرك، فلا يلزم رفعهما. ارفع ملف zip للمود الذي يتطلبهما.",
	en: "UE4SS and PalSchema are already included with your server, so you don't need to upload them. Upload the zip of the mod that needs them.",
};

const TOO_MANY_FILES: Bridge.Text = {
	ar: "يحتوي المود على ملفات أكثر مما نستطيع تثبيته. إذا جمع الملف أكثر من مود، فارفع كل مود في ملف zip مستقل.",
	en: "This mod has more files than we can install. If the file bundles several mods, upload each one in its own zip.",
};

const UNSUPPORTED: Bridge.Text = {
	ar: "لا تدعم منصة سيرفرك حتى الآن المودات التي تشتغل بملف DLL خاص بها بجانب ملفات اللعبة، مثل PalDefender. ارفع ملف zip لمود UE4SS أو PalSchema أو pak.",
	en: "Mods that run their own DLL beside the game's files, such as PalDefender, aren't supported on Serverk yet. Upload the zip of a UE4SS, PalSchema or pak mod.",
};

interface UploadedMod {
	kind: PalworldModKind;
	folder: string;
	root: string;
}

type StagedMods = [
	ModPackage,
	...ModPackage[],
];

const parentOf = (path: string) => {
	return path.split("/").slice(0, -1).join("/");
};

const nameOf = (path: string) => {
	return path.split("/").at(-1) ?? "";
};

const infoRootOf = (path: string) => {
	return nameOf(path) === MOD_INFO_FILE ? parentOf(path) : null;
};

const luaRootOf = (path: string) => {
	const lower = path.toLowerCase();
	const marker = LUA_MARKERS.find((entry) => lower === entry || lower.endsWith(`/${entry}`));

	return marker === undefined ? null : path.split("/").slice(0, -marker.split("/").length).join("/");
};

const palSchemaRootOf = (path: string) => {
	const segments = path.split("/");
	const index = segments.findIndex((segment) => PALSCHEMA_FOLDERS.includes(segment.toLowerCase()));

	return index >= 0 && index < segments.length - 1 ? segments.slice(0, index).join("/") : null;
};

const pakRootOf = (path: string) => {
	return isPakFile(path) ? parentOf(path) : null;
};

const FINDERS: [
	PalworldModKind,
	(path: string) => string | null,
][] = [
	[
		PalworldModKind.Workshop,
		infoRootOf,
	],
	[
		PalworldModKind.Lua,
		luaRootOf,
	],
	[
		PalworldModKind.PalSchema,
		palSchemaRootOf,
	],
	[
		PalworldModKind.Paks,
		pakRootOf,
	],
];

const contains = (outer: string, inner: string) => {
	return inner === outer || inner.startsWith(`${outer}/`);
};

export const stagedPathOf = (input: string) => {
	const path = relativePathOf(input);

	return path?.startsWith(`${MOD_STAGING}/`) ? path : null;
};

const uploadNameOf = (staged: string) => {
	return nameOf(staged).replace(NEXUS_SUFFIX, "");
};

const folderOf = (kind: PalworldModKind, relative: string, staged: string) => {
	const name = nameOf(relative);
	const container = kind === PalworldModKind.Paks && PAK_CONTAINERS.includes(name.toLowerCase());

	return relative === "" || container ? uploadNameOf(staged) : name;
};

export const uploadedModsOf = (paths: string[], staged: string): UploadedMod[] => {
	const found: UploadedMod[] = [];

	for (const [kind, rootOf] of FINDERS) {
		const roots = [
			...new Set(paths.map(rootOf).filter((root) => root !== null)),
		].sort((left, right) => left.split("/").length - right.split("/").length || left.localeCompare(right));

		for (const relative of roots) {
			const root = relative === "" ? staged : `${staged}/${relative}`;
			const folder = folderOf(kind, relative, staged);

			if (isModFolder(folder) && !found.some((mod) => contains(mod.root, root))) {
				found.push({
					kind,
					folder,
					root,
				});
			}
		}
	}

	return found;
};

export const bundledUploadOf = (paths: string[]) => {
	return paths.some((path) => {
		const lower = path.toLowerCase();

		return (
			BUNDLED_FILES.includes(nameOf(lower)) || lower === BUNDLED_PALSCHEMA || lower.endsWith(`/${BUNDLED_PALSCHEMA}`)
		);
	});
};

export const proxyUploadOf = (paths: string[]) => {
	const lower = paths.map((path) => path.toLowerCase());
	const ue4ssLayout = paths.some((path) => luaRootOf(path) !== null || palSchemaRootOf(path) !== null);

	return (
		!ue4ssLayout
		&& lower.some((path) => {
			return (
				PROXY_DLLS.includes(nameOf(path))
				&& lower.some((other) => other !== path && other.endsWith(".dll") && parentOf(other) === parentOf(path))
			);
		})
	);
};

const bundledPackageOf = (mod: ModPackage) => {
	return isPinnedName(modNameOf(mod)) || mod.rules.some((rule) => rule.type === ModRuleType.Ue4ss);
};

const stagedPathsOf = async (context: Bridge.Context, staged: string) => {
	let entries: Bridge.FileEntry[];

	try {
		entries = await context.files.list(`${staged}/**`);
	} catch (error) {
		if (error instanceof Error && MOD_LISTING_LIMIT.test(error.message)) {
			throw new BridgeUserError(TOO_MANY_FILES, {
				cause: error,
			});
		}

		throw error;
	}

	const paths = entries
		.filter((entry) => !entry.directory && entry.path.startsWith(`${staged}/`))
		.map((entry) => entry.path.slice(staged.length + 1));

	if (bundledUploadOf(paths)) {
		throw new BridgeUserError(ALREADY_INCLUDED);
	}

	if (proxyUploadOf(paths)) {
		throw new BridgeUserError(UNSUPPORTED);
	}

	return paths;
};

const acceptedOf = (mod: ModPackage) => {
	if (bundledPackageOf(mod)) {
		throw new BridgeUserError(ALREADY_INCLUDED);
	}

	return mod;
};

export const stagedPackageOf = async (context: Bridge.Context, staged: string, folder: string) => {
	if (!(await stagedPathsOf(context, staged)).includes(MOD_INFO_FILE)) {
		throw new Error(`${staged} carries no ${MOD_INFO_FILE} at its root`);
	}

	return acceptedOf(await readModPackage(context, PalworldModKind.Workshop, folder, staged));
};

export const sortStaged = async (context: Bridge.Context, staged: string): Promise<StagedMods> => {
	const paths = await stagedPathsOf(context, staged);
	const sorted: ModPackage[] = [];

	for (const mod of uploadedModsOf(paths, staged)) {
		sorted.push(acceptedOf(await readModPackage(context, mod.kind, mod.folder, mod.root)));
	}

	const [first, ...rest] = sorted;

	if (first === undefined) {
		throw new BridgeUserError(NO_MOD);
	}

	return [
		first,
		...rest,
	];
};

export const supersededIds = (installed: ModPackage[], incoming: ModPackage[]) => {
	const names = new Set(incoming.map(modNameOf));
	const kept = new Set(incoming.map((mod) => modIdOf(mod.kind, mod.folder)));

	return installed
		.map((mod) => [
			modIdOf(mod.kind, mod.folder),
			modNameOf(mod),
		])
		.filter(([id = "", name = ""]) => names.has(name) && !kept.has(id))
		.map(([id = ""]) => id);
};

export const placeStaged = async (context: Bridge.Context, sorted: ModPackage[]) => {
	for (const mod of sorted) {
		const target = `${MOD_ROOTS[mod.kind]}/${mod.folder}`;

		await context.files.ensure(MOD_ROOTS[mod.kind]);
		await context.files.remove(target);
		await context.files.move(mod.path, target);
	}
};

export const removeMods = async (context: Bridge.Context, ids: string[]) => {
	for (const id of ids) {
		const parsed = parseModId(id);

		if (parsed !== null) {
			await context.files.remove(`${MOD_ROOTS[parsed.kind]}/${parsed.folder}`);
		}
	}
};
