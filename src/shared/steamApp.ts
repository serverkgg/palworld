export const STEAM_APP_ID = "2394010";

export const SERVER_SCRIPT = "PalServer.sh";

export const SERVER_BINARY = "Pal/Binaries/Linux/PalServer-Linux-Shipping";

export const GAME_ROOTS = [
	SERVER_SCRIPT,
	SERVER_BINARY,
	"Pal/Content",
	"Engine",
];

export const SERVER_READY = new RegExp(`Setting breakpad minidump AppID = ${STEAM_APP_ID}`);
