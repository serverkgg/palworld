import type { Bridge } from "@serverkgg/bridge";
import { readStamp, writeStamp } from "@serverkgg/bridge/install";

export interface InstallStamp {
	buildId: string | null;
	adminPasswordNext: string | null;
	settingsPending: Record<string, string> | null;
}

const pendingOf = (raw: unknown): Record<string, string> | null => {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return null;
	}

	const values: Record<string, string> = {};

	for (const [key, value] of Object.entries(raw)) {
		if (typeof value === "string") {
			values[key] = value;
		}
	}

	return Object.keys(values).length === 0 ? null : values;
};

export const stampOf = (raw: Record<string, unknown> | null): InstallStamp | null => {
	if (raw === null) {
		return null;
	}

	return {
		buildId: typeof raw.buildId === "string" ? raw.buildId : null,
		adminPasswordNext:
			typeof raw.adminPasswordNext === "string" && raw.adminPasswordNext.length > 0 ? raw.adminPasswordNext : null,
		settingsPending: pendingOf(raw.settingsPending),
	};
};

export const readInstallStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	return stampOf(await readStamp(context));
};

export const writeInstallStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await writeStamp<InstallStamp>(context, stamp);
};
