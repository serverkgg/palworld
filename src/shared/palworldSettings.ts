import type { Bridge } from "@serverkgg/bridge";
import { editionLayoutOf, SETTINGS_FILE_NAME } from "./palworldEdition";

export const settingsDirectoryOf = (context: Bridge.Context) => {
	return editionLayoutOf(context).configDirectory;
};

export const settingsFileOf = (context: Bridge.Context) => {
	return `${settingsDirectoryOf(context)}/${SETTINGS_FILE_NAME}`;
};

const CODEC_OPTIONS = {
	section: "/Script/Pal.PalGameWorldSettings",
	object: "OptionSettings",
};

export const readSettings = async (context: Bridge.Context) => {
	return await context.codec.ueIni.read(settingsFileOf(context), CODEC_OPTIONS);
};

export const mergeSettings = async (context: Bridge.Context, values: Bridge.Values) => {
	await context.codec.ueIni.merge(settingsFileOf(context), values, CODEC_OPTIONS);
};
