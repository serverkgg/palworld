import type { Bridge } from "@serverkgg/bridge";
import { STAGING_ROOT } from "../shared";

export const UE4SS_VARIABLE = "UE4SS_ENABLED";

export const UE4SS_BRANCH = "linux-native";

export const UE4SS_COMMIT = "2397c7b";

export const UE4SS_COMMIT_SHA = "2397c7b1ce2841fd6526b8d8110cd008c90a6316";

export const UE4SS_VERSION = `${UE4SS_BRANCH}@${UE4SS_COMMIT}`;

export const UE4SS_PROJECT_URL = "https://github.com/BlackBookOfficial/ue4ss-linux-palworld";

export const UE4SS_IMAGE_ROOT = "/opt/ue4ss";

export const UE4SS_LIBRARY = "libUE4SS.so";

export const UE4SS_SETTINGS = "UE4SS-settings.ini";

export const UE4SS_LAYOUT = "MemberVariableLayout.ini";

export const UE4SS_MODS = "Mods";

export const UE4SS_MODS_LIST = `${UE4SS_MODS}/mods.txt`;

export const UE4SS_LOG = "UE4SS.log";

export const UE4SS_STAMP = ".serverk-ue4ss.json";

export const UE4SS_STAGING = `${STAGING_ROOT}/ue4ss`;

export const UE4SS_MOD_STAGING = `${STAGING_ROOT}/ue4ss-mod-upload`;

export interface Ue4ssStamp {
	version: string;
}

export const ue4ssEnabled = (variable: string | null) => {
	return variable === "true";
};

export const parseUe4ssStamp = (contents: string): Ue4ssStamp | null => {
	try {
		const parsed: unknown = JSON.parse(contents);

		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			return null;
		}

		const stamp = parsed as Partial<Ue4ssStamp>;

		return typeof stamp.version === "string" && stamp.version.length > 0
			? {
					version: stamp.version,
				}
			: null;
	} catch {
		return null;
	}
};

export const readUe4ssStamp = async (context: Bridge.Context): Promise<Ue4ssStamp | null> => {
	if (!(await context.files.exists(UE4SS_STAMP))) {
		return null;
	}

	return parseUe4ssStamp(await context.files.read(UE4SS_STAMP));
};

export const writeUe4ssStamp = async (context: Bridge.Context, stamp: Ue4ssStamp) => {
	await context.files.write(UE4SS_STAMP, `${JSON.stringify(stamp, null, 2)}\n`);
};
