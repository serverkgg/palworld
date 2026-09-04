import type { Bridge } from "@serverkgg/bridge";

export const STEAM_APP_ID = "2394010";

export const SERVER_SCRIPT = "PalServer.sh";

export const SERVER_BINARY = "Pal/Binaries/Linux/PalServer-Linux-Shipping";

export const GAME_ROOTS = [
	SERVER_SCRIPT,
	SERVER_BINARY,
	"Pal/Content",
	"Engine",
];

export const APP_MANIFEST = `steamapps/appmanifest_${STEAM_APP_ID}.acf`;

export const SERVER_READY = new RegExp(`Setting breakpad minidump AppID = ${STEAM_APP_ID}`);

export const missingGameRoots = async (context: Bridge.Context) => {
	const missing: string[] = [];

	for (const path of GAME_ROOTS) {
		if (!(await context.files.exists(path))) {
			missing.push(path);
		}
	}

	return missing;
};

const BUILD_ID = /"buildid"\s+"(?<buildId>\d+)"/;

export const buildIdOf = (manifest: string) => {
	return manifest.match(BUILD_ID)?.groups?.buildId ?? null;
};

export const installedBuildId = async (context: Bridge.Context) => {
	if (!(await context.files.exists(APP_MANIFEST))) {
		return null;
	}

	return buildIdOf(await context.files.read(APP_MANIFEST));
};
