import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { palworldGet, palworldPost } from "./restApi";

const INFO_PATH = "/v1/api/info";

const SAVE_PATH = "/v1/api/save";

const SHUTDOWN_PATH = "/v1/api/shutdown";

const STOP_PATH = "/v1/api/stop";

export const SHUTDOWN_DELAY_SECONDS = 5;

export const SHUTDOWN_MESSAGE = "The server is shutting down.";

export interface PalworldInfo {
	version?: string;
	servername?: string;
	description?: string;
	worldguid?: string;
}

export const readInfo = async (context: Bridge.Context) => {
	return await palworldGet<PalworldInfo>(context, INFO_PATH);
};

export const sendSave = async (context: Bridge.Context) => {
	await palworldPost(context, SAVE_PATH);

	context.emit(BridgeEventName.WorldSaved, {});
};

export const sendShutdown = async (context: Bridge.Context, seconds: number, message: string) => {
	await palworldPost(context, SHUTDOWN_PATH, {
		waittime: seconds,
		message,
	});
};

export const sendStop = async (context: Bridge.Context) => {
	await palworldPost(context, STOP_PATH);
};
