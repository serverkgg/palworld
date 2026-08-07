import type { Bridge } from "@serverkgg/bridge";

export const STEAM_APP_ID = "2394010";

export const SERVER_SCRIPT = "PalServer.sh";

export const SERVER_BINARY = "Pal/Binaries/Linux/PalServer-Linux-Shipping";

export const APP_MANIFEST = `steamapps/appmanifest_${STEAM_APP_ID}.acf`;

export const isGameInstalled = async (context: Bridge.Context) => {
	return (await context.files.exists(SERVER_SCRIPT)) && (await context.files.exists(SERVER_BINARY));
};

const BUILD_ID = /"buildid"\s+"(?<buildId>\d+)"/;

export const installedBuildId = async (context: Bridge.Context) => {
	if (!(await context.files.exists(APP_MANIFEST))) {
		return null;
	}

	const manifest = await context.files.read(APP_MANIFEST);

	return manifest.match(BUILD_ID)?.groups?.buildId ?? null;
};
