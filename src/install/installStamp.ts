import type { Bridge } from "@serverkgg/bridge";

export const STAMP_FILE = ".serverk-install.json";

export interface InstallStamp {
	buildId: string;
}

export const parseStamp = (raw: string): InstallStamp | null => {
	try {
		const parsed = JSON.parse(raw) as InstallStamp;

		return typeof parsed.buildId === "string" ? parsed : null;
	} catch {
		return null;
	}
};

export const readStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	if (!(await context.files.exists(STAMP_FILE))) {
		return null;
	}

	return parseStamp(await context.files.read(STAMP_FILE));
};

export const writeStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await context.files.write(STAMP_FILE, `${JSON.stringify(stamp, null, 2)}\n`);
};
