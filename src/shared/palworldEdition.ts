import type { Bridge } from "@serverkgg/bridge";
import { SteamcmdPlatform } from "@serverkgg/bridge/steam";
import { STEAM_APP_ID } from "./steamApp";

export const EDITION_VARIABLE = "EDITION";

export const WINDOWS_STEAM_VARIABLE = "WINDOWS_STEAM";

export enum PalworldEdition {
	Linux = "linux",
	Windows = "windows",
}

export interface EditionLayout {
	platform: SteamcmdPlatform;
	configDirectory: string;
	roots: string[];
	owned: string[];
}

export const LINUX_SCRIPT = "PalServer.sh";

const LINUX_BINARY = "Pal/Binaries/Linux/PalServer-Linux-Shipping";

export const WINDOWS_BINARY_DIRECTORY = "Pal/Binaries/Win64";

export const WINDOWS_BINARY = `${WINDOWS_BINARY_DIRECTORY}/PalServer-Win64-Shipping-Cmd.exe`;

export const STEAM_APP_MANIFEST = `steamapps/appmanifest_${STEAM_APP_ID}.acf`;

export const WINDOWS_STEAM_CLIENT = "steamclient64.dll";

export const WINDOWS_STEAM_SDK = [
	WINDOWS_STEAM_CLIENT,
	"steamclient.dll",
	"tier0_s64.dll",
	"tier0_s.dll",
	"vstdlib_s64.dll",
	"vstdlib_s.dll",
	"steamwebrtc64.dll",
	"steamwebrtc.dll",
];

export const EDITION_LAYOUTS: Record<PalworldEdition, EditionLayout> = {
	[PalworldEdition.Linux]: {
		platform: SteamcmdPlatform.Linux,
		configDirectory: "Pal/Saved/Config/LinuxServer",
		roots: [
			LINUX_SCRIPT,
			LINUX_BINARY,
			"Pal/Content",
			"Engine",
		],
		owned: [
			LINUX_SCRIPT,
			"Pal/Binaries/Linux",
			"Pal/Content/Paks/Pal-LinuxServer.pak",
			"Engine/Binaries/Linux",
			"linux64",
			"steamclient.so",
			"libsteamwebrtc.so",
		],
	},
	[PalworldEdition.Windows]: {
		platform: SteamcmdPlatform.Windows,
		configDirectory: "Pal/Saved/Config/WindowsServer",
		roots: [
			WINDOWS_BINARY,
			WINDOWS_STEAM_CLIENT,
			"Pal/Content",
			"Engine",
		],
		owned: [
			"PalServer.exe",
			...WINDOWS_STEAM_SDK,
			WINDOWS_BINARY_DIRECTORY,
			"Pal/Content/Paks/Pal-WindowsServer.pak",
			"Engine/Binaries/Win64",
			"Engine/Binaries/ThirdParty",
		],
	},
};

export const SETTINGS_FILE_NAME = "PalWorldSettings.ini";

export const CONFIG_FILES = [
	SETTINGS_FILE_NAME,
	"GameUserSettings.ini",
	"Engine.ini",
];

export const editionOf = (context: Bridge.Context) => {
	return context.variable(EDITION_VARIABLE) === PalworldEdition.Windows
		? PalworldEdition.Windows
		: PalworldEdition.Linux;
};

export const windowsSteamOf = (context: Bridge.Context) => {
	return context.variable(WINDOWS_STEAM_VARIABLE) === "true";
};

export const editionLayoutOf = (context: Bridge.Context) => {
	return EDITION_LAYOUTS[editionOf(context)];
};
