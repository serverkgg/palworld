import type { Bridge } from "@serverkgg/bridge";
import { readStamp, writeStamp } from "@serverkgg/bridge/install";

export interface InstallStamp {
	buildId: string | null;
	adminPasswordNext: string | null;
}

export const stampOf = (raw: Record<string, unknown> | null): InstallStamp | null => {
	if (raw === null) {
		return null;
	}

	return {
		buildId: typeof raw.buildId === "string" ? raw.buildId : null,
		adminPasswordNext:
			typeof raw.adminPasswordNext === "string" && raw.adminPasswordNext.length > 0 ? raw.adminPasswordNext : null,
	};
};

export const readInstallStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	return stampOf(await readStamp(context));
};

export const writeInstallStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await writeStamp<InstallStamp>(context, stamp);
};
