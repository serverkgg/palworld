import type { Bridge } from "@serverkgg/bridge";
import { execDetail } from "@serverkgg/bridge/utils";
import { WINDOWS_BINARY_DIRECTORY, WINDOWS_STEAM_CLIENT, windowsSteamOf } from "./palworldEdition";

export const WINDOWS_STEAM_CLIENT_TARGET = `${WINDOWS_BINARY_DIRECTORY}/${WINDOWS_STEAM_CLIENT}`;

const placeSteamClient = async (context: Bridge.Context) => {
	const result = await context.exec([
		"cp",
		"-f",
		WINDOWS_STEAM_CLIENT,
		WINDOWS_STEAM_CLIENT_TARGET,
	]);

	if (result.code !== 0) {
		throw new Error(`${WINDOWS_STEAM_CLIENT} could not be placed beside the server — ${execDetail(result)}`);
	}
};

export const settleSteamClient = async (context: Bridge.Context) => {
	if (windowsSteamOf(context)) {
		await placeSteamClient(context);

		return;
	}

	if (await context.files.exists(WINDOWS_STEAM_CLIENT_TARGET)) {
		await context.files.remove(WINDOWS_STEAM_CLIENT_TARGET);
	}
};
