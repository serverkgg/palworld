import type { Bridge } from "@serverkgg/bridge";

export const SETTINGS_DIRECTORY = "Pal/Saved/Config/LinuxServer";

export const SETTINGS_FILE = `${SETTINGS_DIRECTORY}/PalWorldSettings.ini`;

const CODEC_OPTIONS = {
	section: "/Script/Pal.PalGameWorldSettings",
	object: "OptionSettings",
};

export const readSettings = async (context: Bridge.Context) => {
	return await context.codec.ueIni.read(SETTINGS_FILE, CODEC_OPTIONS);
};

export const mergeSettings = async (context: Bridge.Context, values: Bridge.Values) => {
	await context.codec.ueIni.merge(SETTINGS_FILE, values, CODEC_OPTIONS);
};
