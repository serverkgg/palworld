import type { Bridge } from "@serverkgg/bridge";

const STAMP_FILE = ".serverk-install.json";

export interface InstallStamp {
	buildId: string;
}

export const readStamp = async (context: Bridge.Context): Promise<InstallStamp | null> => {
	if (!(await context.files.exists(STAMP_FILE))) {
		return null;
	}

	try {
		const parsed = JSON.parse(await context.files.read(STAMP_FILE)) as InstallStamp;

		return typeof parsed.buildId === "string" ? parsed : null;
	} catch {
		return null;
	}
};

export const writeStamp = async (context: Bridge.Context, stamp: InstallStamp) => {
	await context.files.write(STAMP_FILE, `${JSON.stringify(stamp, null, 2)}\n`);
};
