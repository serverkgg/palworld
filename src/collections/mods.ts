import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import {
	BUNDLED_FILES,
	BUNDLED_MODS,
	editionOf,
	installedMods,
	isModFolder,
	MOD_INFO_FILE,
	MOD_ROOTS,
	MOD_STAGING,
	modEnabled,
	modIdOf,
	modLoaded,
	PALSCHEMA_FOLDERS,
	PalworldEdition,
	type PalworldMod,
	PalworldModKind,
	parseModId,
	readDeployedMods,
	readInstallStamp,
	readModLoads,
	UE4SS_MARKERS,
	workshopDeployed,
	writeInstallStamp,
} from "../shared";

const REFRESH_SECONDS = 10;

const NEXUS_SUFFIX = / \d+ \S+ \d{4}-\d{2}-\d{2}T\d{2}-\d{2}(-\d{2})?Z \S+$/;

const NOT_FOUND: Bridge.Text = {
	ar: "تعذّر العثور على الملف المرفوع. ارفعه مرة ثانية.",
	en: "We couldn't find the uploaded file. Upload it again.",
};

const NO_MOD: Bridge.Text = {
	ar: "لا يوجد مود داخل الملف. ارفع ملف zip للمود كما نزّلته، سواء كان من Steam Workshop أو مود PalSchema أو مود UE4SS.",
	en: "There's no mod inside the file. Upload the mod's zip as you downloaded it, whether it's a Steam Workshop, PalSchema or UE4SS mod.",
};

const LINUX_EDITION: Bridge.Text = {
	ar: "يشغّل بالورلد مودات السيرفر على ويندوز فقط. غيّر نظام التشغيل إلى ويندوز من الأعلى، ثم ارفع المود.",
	en: "Palworld runs server mods only on Windows. Switch the operating system to Windows above, then upload the mod.",
};

const ALREADY_INCLUDED: Bridge.Text = {
	ar: "نوفر UE4SS و PalSchema مع سيرفرك، فلا يلزم رفعهما. ارفع ملف zip للمود الذي يتطلبهما.",
	en: "UE4SS and PalSchema are already included with your server, so you don't need to upload them. Upload the zip of the mod that needs them.",
};

const NO_STAMP: Bridge.Text = {
	ar: "لم يكتمل تثبيت سيرفرك بعد. شغّله مرة، ثم ارفع المود.",
	en: "Your server hasn't finished installing yet. Start it once, then upload the mod.",
};

const KIND_LABELS: Record<PalworldModKind, Bridge.Text> = {
	[PalworldModKind.Workshop]: {
		ar: "Steam Workshop",
		en: "Steam Workshop",
	},
	[PalworldModKind.PalSchema]: {
		ar: "PalSchema",
		en: "PalSchema",
	},
	[PalworldModKind.Ue4ss]: {
		ar: "UE4SS",
		en: "UE4SS",
	},
};

const RUNNING: Bridge.Text = {
	ar: "شغّال",
	en: "Running",
};

const WAITING: Bridge.Text = {
	ar: "يشتغل بعد الريستارت",
	en: "Runs after a restart",
};

const FAILED: Bridge.Text = {
	ar: "تعذّر تشغيله، راجع الكونسول",
	en: "Couldn't start. Check the console",
};

const OFF: Bridge.Text = {
	ar: "موقوف",
	en: "Off",
};

const CLIENT_ONLY: Bridge.Text = {
	ar: "لا يشتغل على السيرفرات",
	en: "Doesn't run on servers",
};

const WINDOWS_ONLY: Bridge.Text = {
	ar: "يشتغل على ويندوز فقط",
	en: "Runs on Windows only",
};

export const stagedPathOf = (input: string) => {
	const trimmed = input.trim();
	const segments = trimmed.split("/").filter((segment) => segment.length > 0 && segment !== ".");

	if (trimmed.startsWith("/") || segments.includes("..")) {
		return null;
	}

	const path = segments.join("/");

	return path.startsWith(`${MOD_STAGING}/`) ? path : null;
};

export interface UploadedMod {
	kind: PalworldModKind;
	folder: string;
	root: string;
}

export const uploadNameOf = (staged: string) => {
	return (staged.split("/").at(-1) ?? "").replace(NEXUS_SUFFIX, "");
};

const rootOf = (path: string, staged: string, kind: PalworldModKind): string | null => {
	if (!path.startsWith(`${staged}/`)) {
		return null;
	}

	if (kind === PalworldModKind.Workshop) {
		return path.endsWith(`/${MOD_INFO_FILE}`) ? path.slice(0, -(MOD_INFO_FILE.length + 1)) : null;
	}

	if (kind === PalworldModKind.Ue4ss) {
		const marker = UE4SS_MARKERS.find((entry) => path.endsWith(`/${entry}`));

		return marker ? path.slice(0, -(marker.length + 1)) : null;
	}

	const segments = path.slice(staged.length + 1).split("/");
	const index = segments.findIndex((segment) => PALSCHEMA_FOLDERS.includes(segment));

	return index >= 0 && index < segments.length - 1
		? [
				staged,
				...segments.slice(0, index),
			].join("/")
		: null;
};

export const uploadedModsOf = (paths: string[], staged: string): UploadedMod[] => {
	const found: UploadedMod[] = [];

	for (const kind of [
		PalworldModKind.Workshop,
		PalworldModKind.Ue4ss,
		PalworldModKind.PalSchema,
	]) {
		for (const path of paths) {
			const root = rootOf(path, staged, kind);

			if (root === null || (root !== staged && !root.startsWith(`${staged}/`))) {
				continue;
			}

			if (
				found.some((mod) => root === mod.root || root.startsWith(`${mod.root}/`) || mod.root.startsWith(`${root}/`))
			) {
				continue;
			}

			const folder = root === staged ? uploadNameOf(staged) : (root.split("/").at(-1) ?? "");

			if (isModFolder(folder) && !BUNDLED_MODS.includes(folder)) {
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
		const segments = path.split("/");

		return (
			BUNDLED_FILES.includes(segments.at(-1) ?? "")
			|| segments.slice(0, -1).some((segment) => BUNDLED_MODS.includes(segment))
		);
	});
};

export interface ModStatus {
	enabled: boolean;
	server: boolean;
	deployed: boolean;
	started: boolean;
	loaded: boolean;
}

export const stateOf = (edition: PalworldEdition, status: ModStatus) => {
	if (edition === PalworldEdition.Linux) {
		return WINDOWS_ONLY;
	}

	if (!status.server) {
		return CLIENT_ONLY;
	}

	if (!status.enabled) {
		return OFF;
	}

	if (!status.deployed || !status.started) {
		return WAITING;
	}

	return status.loaded ? RUNNING : FAILED;
};

const requireStamp = async (context: Bridge.Context) => {
	const stamp = await readInstallStamp(context);

	if (stamp === null) {
		throw new BridgeUserError(NO_STAMP);
	}

	return stamp;
};

const saveMods = async (context: Bridge.Context, mods: PalworldMod[]) => {
	const stamp = await requireStamp(context);

	await writeInstallStamp(context, {
		...stamp,
		mods,
	});
};

const install = async (context: Bridge.Context, staged: string) => {
	const paths = (await context.files.list(`${staged}/**`))
		.filter((entry) => !entry.directory)
		.map((entry) => entry.path);
	const uploaded = uploadedModsOf(paths, staged);

	if (uploaded.length === 0) {
		throw new BridgeUserError(bundledUploadOf(paths) ? ALREADY_INCLUDED : NO_MOD);
	}

	for (const mod of uploaded) {
		const target = `${MOD_ROOTS[mod.kind]}/${mod.folder}`;

		await context.files.ensure(MOD_ROOTS[mod.kind]);

		if (await context.files.exists(target)) {
			await context.files.remove(target);
		}

		await context.files.move(mod.root, target);

		context.log("installed an uploaded mod", {
			kind: mod.kind,
			folder: mod.folder,
		});
	}
};

export const mods: Bridge.Collection = {
	kind: BridgeKind.Collection,
	refreshSeconds: REFRESH_SECONDS,
	async list(context) {
		const listed = (await readInstallStamp(context))?.mods ?? [];
		const edition = editionOf(context);
		const deployed = await readDeployedMods(context);
		const loads = await readModLoads(context);
		const rows: Bridge.Row[] = [];

		for (const mod of await installedMods(context)) {
			const id = modIdOf(mod.kind, mod.folder);
			const workshop = mod.kind === PalworldModKind.Workshop;

			rows.push({
				id,
				title: mod.info.name ?? mod.folder,
				type: KIND_LABELS[mod.kind],
				version: mod.info.version ?? "",
				state: stateOf(edition, {
					enabled: modEnabled(listed, id),
					server: mod.info.server,
					deployed: deployed.has(id),
					started: workshop || loads.log,
					loaded: workshop ? await workshopDeployed(context, mod) : modLoaded(mod, loads),
				}),
			});
		}

		return rows;
	},
	async add(context, input) {
		const staged = stagedPathOf(input);

		if (staged === null || !(await context.files.exists(staged))) {
			throw new BridgeUserError(NOT_FOUND);
		}

		try {
			if (editionOf(context) !== PalworldEdition.Windows) {
				throw new BridgeUserError(LINUX_EDITION);
			}

			await requireStamp(context);
			await install(context, staged);
		} finally {
			await context.files.remove(staged);
		}
	},
	actions: {
		async toggle(context, row) {
			const stamp = await requireStamp(context);
			const enabled = modEnabled(stamp.mods, row.id);

			await saveMods(context, [
				...stamp.mods.filter((mod) => mod.id !== row.id),
				{
					id: row.id,
					enabled: !enabled,
				},
			]);
		},

		async remove(context, row) {
			const stamp = await requireStamp(context);
			const parsed = parseModId(row.id);

			if (parsed !== null) {
				await context.files.remove(`${MOD_ROOTS[parsed.kind]}/${parsed.folder}`);
			}

			await saveMods(
				context,
				stamp.mods.filter((mod) => mod.id !== row.id),
			);
		},
	},
};
