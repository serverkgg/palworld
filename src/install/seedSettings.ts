import { Buffer } from "node:buffer";
import type { Bridge } from "@serverkgg/bridge";
import { mergeSettings, REST_API_PORT, readSettings, SETTINGS_DIRECTORY, SETTINGS_FILE } from "../shared";

const DEFAULT_SETTINGS_FILE = "DefaultPalWorldSettings.ini";

const PASSWORD_BYTES = 18;

const generatePassword = () => {
	const bytes = new Uint8Array(PASSWORD_BYTES);

	crypto.getRandomValues(bytes);

	return Buffer.from(bytes).toString("base64url");
};

export const seedSettings = async (context: Bridge.Context) => {
	if (!(await context.files.exists(SETTINGS_FILE)) && (await context.files.exists(DEFAULT_SETTINGS_FILE))) {
		context.log("seeding PalWorldSettings.ini from the shipped defaults");

		await context.files.ensure(SETTINGS_DIRECTORY);
		await context.files.write(SETTINGS_FILE, await context.files.read(DEFAULT_SETTINGS_FILE));
	}

	const settings = await readSettings(context);

	const patch: Bridge.Values = {
		RESTAPIEnabled: true,
		RESTAPIPort: REST_API_PORT,
	};

	if (String(settings.AdminPassword ?? "").length === 0) {
		context.log("generating an admin password so the panel can control the server");

		patch.AdminPassword = generatePassword();
	}

	await mergeSettings(context, patch);
};
