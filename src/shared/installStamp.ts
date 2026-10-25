import type { Bridge } from "@serverkgg/bridge";
import { readStamp, writeStamp } from "@serverkgg/bridge/install";
import { PalworldEdition } from "./palworldEdition";
import { isRecord } from "./palworldModRules";
import { modsOf, type PalworldMod } from "./palworldMods";

export interface PendingBaseline {
	values: Record<string, string>;
	secrets: Record<string, boolean>;
}

export interface InstallStamp {
	buildId: string | null;
	edition: PalworldEdition;
	mods: PalworldMod[];
	adminPasswordNext: string | null;
	settingsPending: Record<string, string> | null;
	settingsBaseline: PendingBaseline | null;
}

const textsOf = (raw: unknown): Record<string, string> => {
	const values: Record<string, string> = {};

	if (!isRecord(raw)) {
		return values;
	}

	for (const [key, value] of Object.entries(raw)) {
		if (typeof value === "string") {
			values[key] = value;
		}
	}

	return values;
};

const flagsOf = (raw: unknown): Record<string, boolean> => {
	const flags: Record<string, boolean> = {};

	if (!isRecord(raw)) {
		return flags;
	}

	for (const [key, value] of Object.entries(raw)) {
		if (typeof value === "boolean") {
			flags[key] = value;
		}
	}

	return flags;
};

const pendingOf = (raw: unknown): Record<string, string> | null => {
	const values = textsOf(raw);

	return Object.keys(values).length === 0 ? null : values;
};

const baselineOf = (raw: unknown): PendingBaseline | null => {
	if (!isRecord(raw)) {
		return null;
	}

	return {
		values: textsOf(raw.values),
		secrets: flagsOf(raw.secrets),
	};
};

export const stampOf = (raw: Record<string, unknown> | null): InstallStamp | null => {
	if (raw === null) {
		return null;
	}

	return {
		buildId: typeof raw.buildId === "string" ? raw.buildId : null,
		edition: raw.edition === PalworldEdition.Windows ? PalworldEdition.Windows : PalworldEdition.Linux,
		mods: modsOf(raw.mods),
		adminPasswordNext:
			typeof raw.adminPasswordNext === "string" && raw.adminPasswordNext.length > 0 ? raw.adminPasswordNext : null,
		settingsPending: pendingOf(raw.settingsPending),
		settingsBaseline: baselineOf(raw.settingsBaseline),
	};
};

export const readInstallStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	return stampOf(await readStamp(context));
};

export const writeInstallStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await writeStamp<InstallStamp>(context, stamp);
};
