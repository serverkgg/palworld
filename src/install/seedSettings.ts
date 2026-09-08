import type { Bridge } from "@serverkgg/bridge";
import { RCON_PASSWORD_LENGTH, rconExposed } from "@serverkgg/bridge/rcon";
import { generateToken } from "@serverkgg/bridge/utils";
import { accessPatch, mergeSettings, REST_API_PORT, readSettings, SETTINGS_DIRECTORY, SETTINGS_FILE } from "../shared";

const DEFAULT_SETTINGS_FILE = "DefaultPalWorldSettings.ini";

export const needsAdminPassword = (settings: Bridge.Values) => {
	return String(settings.AdminPassword ?? "").length === 0;
};

export const seedPatch = (publicPort: number, password: string | null, exposed: boolean): Bridge.Values => {
	return {
		PublicPort: publicPort,
		RESTAPIEnabled: true,
		RESTAPIPort: REST_API_PORT,
		...accessPatch(exposed, password),
	};
};

export const seedSettings = async (context: Bridge.Context) => {
	if (!(await context.files.exists(SETTINGS_FILE)) && (await context.files.exists(DEFAULT_SETTINGS_FILE))) {
		context.log("seeding PalWorldSettings.ini from the shipped defaults");

		await context.files.ensure(SETTINGS_DIRECTORY);
		await context.files.write(SETTINGS_FILE, await context.files.read(DEFAULT_SETTINGS_FILE));
	}

	const missing = needsAdminPassword(await readSettings(context));

	if (missing) {
		context.log("generating an admin password so the panel can control the server");
	}

	await mergeSettings(
		context,
		seedPatch(context.port("game"), missing ? generateToken(RCON_PASSWORD_LENGTH) : null, rconExposed(context)),
	);
};
