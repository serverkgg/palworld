import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { execDetail } from "@serverkgg/bridge/utils";
import {
	UE4SS_IMAGE_ROOT,
	UE4SS_LAYOUT,
	UE4SS_LIBRARY,
	UE4SS_LOG,
	UE4SS_MODS,
	UE4SS_MODS_LIST,
	UE4SS_SETTINGS,
	UE4SS_STAGING,
	UE4SS_STAMP,
	UE4SS_VERSION,
	type Ue4ssStamp,
	ue4ssEnabled,
	writeUe4ssStamp,
} from "./ue4ssRelease";
import { applyUe4ssSettings, mergeModsList, modFolders } from "./ue4ssSettings";

const EXEC_TIMEOUT_MS = 120_000;

const MISSING_LIBRARY = /^\s*(?<library>\S+)\s*=>\s*not found/;

const STAGED_LIBRARY = `${UE4SS_STAGING}/${UE4SS_LIBRARY}`;

const STAGED_MODS = `${UE4SS_STAGING}/${UE4SS_MODS}`;

const PENDING_LIBRARY = `${UE4SS_LIBRARY}.new`;

const INSTALLED_ENTRIES = [
	UE4SS_LIBRARY,
	UE4SS_SETTINGS,
	UE4SS_LAYOUT,
	UE4SS_STAMP,
	UE4SS_LOG,
];

const REQUIRED_ENTRIES = [
	UE4SS_LIBRARY,
	UE4SS_SETTINGS,
	UE4SS_LAYOUT,
	UE4SS_MODS_LIST,
];

export const missingLibraries = (output: string) => {
	const names: string[] = [];

	for (const line of output.split("\n")) {
		const library = MISSING_LIBRARY.exec(line)?.groups?.library;

		if (library !== undefined && !names.includes(library)) {
			names.push(library);
		}
	}

	return names;
};

export const modsToCopy = (shipped: string[], existing: string[]) => {
	return shipped.filter((name) => !existing.includes(name));
};

export const ue4ssInstalled = async (context: Bridge.Context) => {
	return (await context.files.exists(UE4SS_LIBRARY)) && (await context.files.exists(UE4SS_SETTINGS));
};

export const ue4ssPresent = async (context: Bridge.Context) => {
	for (const path of INSTALLED_ENTRIES) {
		if (await context.files.exists(path)) {
			return true;
		}
	}

	return false;
};

export const shouldInstall = (stamp: Ue4ssStamp | null, variable: string | null, installed: boolean) => {
	return ue4ssEnabled(variable) && (!installed || stamp?.version !== UE4SS_VERSION);
};

export const shouldRemove = (variable: string | null, present: boolean) => {
	return !ue4ssEnabled(variable) && present;
};

const run = async (context: Bridge.Context, command: string[], failure: string) => {
	const result = await context.exec(command, {
		timeoutMs: EXEC_TIMEOUT_MS,
	});

	if (result.code !== 0) {
		throw new Error(`${failure} — ${execDetail(result)}`);
	}

	return result;
};

const requireLibraries = async (context: Bridge.Context) => {
	const probe = await context.exec(
		[
			"ldd",
			STAGED_LIBRARY,
		],
		{
			timeoutMs: EXEC_TIMEOUT_MS,
		},
	);

	const output = `${probe.stdout}\n${probe.stderr}`;

	context.log("checked what the ue4ss library needs from the image", {
		ldd: output.trim(),
	});

	const missing = missingLibraries(output);

	if (missing.length === 0) {
		return;
	}

	throw new BridgeUserError({
		ar: `UE4SS ما يشتغل على نسخة سيرفرك الحالية، ناقصها مكتبات: ${missing.join("، ")}. كلّمنا وبنضيفها.`,
		en: `UE4SS cannot load on this server image, it is missing: ${missing.join(", ")}. Contact us and we will add them.`,
	});
};

const mergeMods = async (context: Bridge.Context) => {
	await context.files.ensure(UE4SS_MODS);

	const shipped = await modFolders(context, STAGED_MODS);
	const existing = await modFolders(context, UE4SS_MODS);
	const added = modsToCopy(shipped, existing);

	for (const name of added) {
		await run(
			context,
			[
				"cp",
				"-a",
				`${STAGED_MODS}/${name}`,
				`${UE4SS_MODS}/${name}`,
			],
			`the ue4ss mod "${name}" could not be unpacked`,
		);
	}

	const shippedList = await context.files.read(`${UE4SS_STAGING}/${UE4SS_MODS_LIST}`);
	const existingList = (await context.files.exists(UE4SS_MODS_LIST)) ? await context.files.read(UE4SS_MODS_LIST) : null;

	await context.files.write(UE4SS_MODS_LIST, mergeModsList(shippedList, existingList));

	return added;
};

export const installUe4ss = async (context: Bridge.Context) => {
	context.log("installing the ue4ss build the image carries", {
		version: UE4SS_VERSION,
	});

	await context.files.remove(UE4SS_STAGING);
	await context.files.ensure(UE4SS_STAGING);

	await run(
		context,
		[
			"cp",
			"-a",
			`${UE4SS_IMAGE_ROOT}/.`,
			UE4SS_STAGING,
		],
		"the ue4ss build could not be copied out of the image",
	);

	for (const entry of REQUIRED_ENTRIES) {
		if (!(await context.files.exists(`${UE4SS_STAGING}/${entry}`))) {
			throw new Error(`the ue4ss build in the image carries no ${entry}`);
		}
	}

	await requireLibraries(context);

	await run(
		context,
		[
			"cp",
			STAGED_LIBRARY,
			PENDING_LIBRARY,
		],
		"the ue4ss library could not be staged",
	);

	await run(
		context,
		[
			"mv",
			PENDING_LIBRARY,
			UE4SS_LIBRARY,
		],
		"the ue4ss library could not be put in place",
	);

	for (const entry of [
		UE4SS_SETTINGS,
		UE4SS_LAYOUT,
	]) {
		await run(
			context,
			[
				"cp",
				"-f",
				`${UE4SS_STAGING}/${entry}`,
				entry,
			],
			`${entry} could not be written`,
		);
	}

	const added = await mergeMods(context);

	await applyUe4ssSettings(context);
	await writeUe4ssStamp(context, {
		version: UE4SS_VERSION,
	});

	await context.files.remove(UE4SS_STAGING);

	context.log("ue4ss is installed", {
		version: UE4SS_VERSION,
		mods: added.join(", "),
	});
};

export const removeUe4ss = async (context: Bridge.Context) => {
	for (const path of INSTALLED_ENTRIES) {
		if (await context.files.exists(path)) {
			await context.files.remove(path);
		}
	}

	context.log("ue4ss removed, the mods folder is kept");
};
