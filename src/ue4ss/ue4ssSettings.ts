import type { Bridge } from "@serverkgg/bridge";
import { UE4SS_MODS_LIST, UE4SS_SETTINGS } from "./ue4ssRelease";

const COMMENT_MARKER = ";";

const SEPARATOR = " : ";

const MOD_LINE = /^(?<name>[A-Za-z0-9_.-]+)\s*:\s*(?<enabled>[01])$/;

const FIND_TIMEOUT_MS = 15_000;

export const UE4SS_MODS_SHARED = "shared";

export interface Ue4ssHeadlessSection {
	section: string;
	reason: string;
	values: Record<string, string>;
}

export const UE4SS_HEADLESS_SETTINGS: Ue4ssHeadlessSection[] = [
	{
		section: "Debug",
		reason: "sent the ue4ss log to stdout and kept both gui windows off, a dedicated server has no screen",
		values: {
			ConsoleEnabled: "1",
			GuiConsoleEnabled: "0",
			GuiConsoleVisible: "0",
		},
	},
	{
		section: "Hooks",
		reason:
			"asked ue4ss not to hook the game viewport tick, a dedicated server draws no viewport and the port refuses it",
		values: {
			HookGameViewportClientTick: "0",
		},
	},
];

export const UE4SS_HEADLESS_MODS = [
	"Keybinds",
	"SplitScreenMod",
];

export interface Ue4ssMod {
	name: string;
	enabled: boolean;
}

export const parseModLine = (line: string): Ue4ssMod | null => {
	if (line.includes(COMMENT_MARKER)) {
		return null;
	}

	const groups = MOD_LINE.exec(line.trim())?.groups;

	if (groups?.name === undefined || groups.enabled === undefined) {
		return null;
	}

	return {
		name: groups.name,
		enabled: groups.enabled === "1",
	};
};

export const formatModLine = (mod: Ue4ssMod) => {
	return `${mod.name}${SEPARATOR}${mod.enabled ? "1" : "0"}`;
};

export const parseModsList = (contents: string): Ue4ssMod[] => {
	const mods: Ue4ssMod[] = [];

	for (const line of contents.split("\n")) {
		const mod = parseModLine(line);

		if (mod !== null) {
			mods.push(mod);
		}
	}

	return mods;
};

export const enabledMods = (contents: string) => {
	return parseModsList(contents)
		.filter((mod) => mod.enabled)
		.map((mod) => mod.name);
};

export const writeModsList = (contents: string, values: Record<string, boolean>) => {
	const pending = new Map(Object.entries(values));
	const lines = contents.length === 0 ? [] : contents.split("\n");
	const output: string[] = [];

	for (const line of lines) {
		const mod = parseModLine(line);
		const wanted = mod === null ? undefined : pending.get(mod.name);

		if (mod === null || wanted === undefined) {
			output.push(line);

			continue;
		}

		pending.delete(mod.name);

		output.push(
			formatModLine({
				name: mod.name,
				enabled: wanted,
			}),
		);
	}

	while (output.length > 0 && (output.at(-1) ?? "").trim().length === 0) {
		output.pop();
	}

	for (const [name, enabled] of pending) {
		output.push(
			formatModLine({
				name,
				enabled,
			}),
		);
	}

	return `${output.join("\n")}\n`;
};

export const mergeModsList = (shipped: string, existing: string | null) => {
	if (existing === null) {
		return shipped;
	}

	const known = new Set(parseModsList(existing).map((mod) => mod.name));
	const missing: Record<string, boolean> = {};

	for (const mod of parseModsList(shipped)) {
		if (!known.has(mod.name)) {
			missing[mod.name] = mod.enabled;
		}
	}

	return writeModsList(existing, missing);
};

export const headlessOverrides = (present: Bridge.Values, desired: Record<string, string>) => {
	const overrides: Record<string, string> = {};

	for (const [key, value] of Object.entries(desired)) {
		if (Object.hasOwn(present, key)) {
			overrides[key] = value;
		}
	}

	return overrides;
};

export const headlessMods = (contents: string) => {
	const known = new Set(parseModsList(contents).map((mod) => mod.name));
	const disabled: Record<string, boolean> = {};

	for (const name of UE4SS_HEADLESS_MODS) {
		if (known.has(name)) {
			disabled[name] = false;
		}
	}

	return disabled;
};

export const folderNames = (stdout: string) => {
	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.sort();
};

export const modFolders = async (context: Bridge.Context, path: string) => {
	if (!(await context.files.exists(path))) {
		return [];
	}

	const result = await context.exec(
		[
			"find",
			path,
			"-mindepth",
			"1",
			"-maxdepth",
			"1",
			"-type",
			"d",
			"-printf",
			"%f\n",
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);

	return result.code === 0 ? folderNames(result.stdout) : [];
};

export const readModsList = async (context: Bridge.Context) => {
	return (await context.files.exists(UE4SS_MODS_LIST)) ? await context.files.read(UE4SS_MODS_LIST) : "";
};

export const applyUe4ssSettings = async (context: Bridge.Context) => {
	for (const { section, reason, values } of UE4SS_HEADLESS_SETTINGS) {
		const present = await context.codec.ini.read(UE4SS_SETTINGS, {
			section,
		});

		const overrides = headlessOverrides(present, values);

		if (Object.keys(overrides).length === 0) {
			continue;
		}

		await context.codec.ini.merge(UE4SS_SETTINGS, overrides, {
			section,
		});

		context.log(reason, {
			section,
			keys: Object.keys(overrides).join(", "),
		});
	}

	const contents = await readModsList(context);
	const disabled = headlessMods(contents);

	if (Object.keys(disabled).length === 0) {
		return;
	}

	const next = writeModsList(contents, disabled);

	if (next === contents) {
		return;
	}

	await context.files.write(UE4SS_MODS_LIST, next);

	context.log("turned off the ue4ss mods a dedicated server cannot run", {
		mods: Object.keys(disabled).join(", "),
	});
};
