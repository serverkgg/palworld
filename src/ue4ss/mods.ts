import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { relativeUploadPath } from "../shared";
import { UE4SS_MODS, UE4SS_MODS_LIST } from "./ue4ssRelease";
import { enabledMods, modFolders, readModsList, UE4SS_MODS_SHARED, writeModsList } from "./ue4ssSettings";

const ENABLED_MARK = "✓";

const UNSAFE_NAME = /[^A-Za-z0-9_.-]/g;

const FIND_TIMEOUT_MS = 30_000;

const MISSING_UPLOAD: Bridge.Text = {
	ar: "ما لقينا الملفات اللي رفعتها.",
	en: "The uploaded files were not found.",
};

const NOT_A_MOD: Bridge.Text = {
	ar: "الملف المضغوط ما فيه مود UE4SS. المود مجلد فيه مجلد scripts ومعاه main.lua.",
	en: "The archive holds no UE4SS mod. A mod is a folder holding a scripts folder with main.lua in it.",
};

const TOO_MANY_MODS: Bridge.Text = {
	ar: "الملف فيه أكثر من مود، ارفع كل مود لحاله.",
	en: "The archive holds more than one mod, upload them one at a time.",
};

const BAD_NAME: Bridge.Text = {
	ar: "سمّ مجلد المود بأحرف إنجليزية وأرقام وارفعه مرة ثانية.",
	en: "Name the mod folder with latin letters and digits and upload it again.",
};

export const safeModName = (name: string) => {
	return name.replace(UNSAFE_NAME, "");
};

export const modDirectories = (stdout: string) => {
	const paths: string[] = [];

	for (const line of stdout.split("\n")) {
		const path = line.trim();

		if (path.length > 0 && !paths.includes(path)) {
			paths.push(path);
		}
	}

	return paths.sort();
};

export const modRow = (name: string, enabled: boolean): Bridge.Row => {
	return {
		id: name,
		name,
		enabled: enabled ? ENABLED_MARK : "",
	};
};

const uploadedMod = async (context: Bridge.Context, source: string) => {
	const result = await context.exec(
		[
			"find",
			source,
			"-mindepth",
			"1",
			"-maxdepth",
			"3",
			"-type",
			"d",
			"(",
			"-iname",
			"scripts",
			"-o",
			"-iname",
			"libs",
			")",
			"-printf",
			"%h\n",
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);

	const found = modDirectories(result.stdout);
	const directory = found.at(0);

	if (directory === undefined) {
		throw new BridgeUserError(NOT_A_MOD);
	}

	if (found.length > 1) {
		throw new BridgeUserError(TOO_MANY_MODS);
	}

	return directory;
};

const toggleMod = async (context: Bridge.Context, name: string, enabled: boolean) => {
	const contents = await readModsList(context);

	await context.files.write(
		UE4SS_MODS_LIST,
		writeModsList(contents, {
			[name]: enabled,
		}),
	);

	context.log(enabled ? "turned a ue4ss mod on" : "turned a ue4ss mod off", {
		mod: name,
	});
};

export const ue4ssMods: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: false,

	async list(context) {
		const folders = await modFolders(context, UE4SS_MODS);
		const enabled = new Set(enabledMods(await readModsList(context)));

		return folders.filter((name) => name !== UE4SS_MODS_SHARED).map((name) => modRow(name, enabled.has(name)));
	},

	async add(context, input) {
		const source = relativeUploadPath(input);

		if (source === null || !(await context.files.exists(source))) {
			throw new BridgeUserError(MISSING_UPLOAD);
		}

		const directory = await uploadedMod(context, source);
		const name = safeModName(directory.split("/").at(-1) ?? "");

		if (name.length === 0) {
			throw new BridgeUserError(BAD_NAME);
		}

		const target = `${UE4SS_MODS}/${name}`;

		if (await context.files.exists(target)) {
			throw new BridgeUserError({
				ar: `عندك مود اسمه "${name}"، غيّر اسم المجلد وارفعه.`,
				en: `A mod named "${name}" is already here, rename the folder and upload it again.`,
			});
		}

		await context.files.ensure(UE4SS_MODS);
		await context.files.move(directory, target);

		if (directory !== source) {
			await context.files.remove(source);
		}

		await toggleMod(context, name, true);

		context.log("added a ue4ss mod", {
			mod: name,
		});
	},

	actions: {
		async enable(context, row) {
			await toggleMod(context, row.id, true);
		},

		async disable(context, row) {
			await toggleMod(context, row.id, false);
		},
	},
};
