import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { palworldPost, SERVER_READY, SERVER_SCRIPT } from "../shared";

const STOP_TIMEOUT_SECONDS = 90;

const SHUTDOWN_DELAY_SECONDS = 5;

const SHUTDOWN_PATH = "/v1/api/shutdown";

export const lifecycle: Bridge.Lifecycle = {
	kind: BridgeKind.Lifecycle,
	ready: SERVER_READY,
	stopTimeoutSeconds: STOP_TIMEOUT_SECONDS,
	async command(context) {
		return [
			`./${SERVER_SCRIPT}`,
			`-port=${context.port("game")}`,
			"-useperfthreads",
			"-NoAsyncLoadingThread",
			"-UseMultithreadForDS",
		];
	},
	async stop(context) {
		context.emit("ServerStopping");

		await palworldPost(context, SHUTDOWN_PATH, {
			waittime: SHUTDOWN_DELAY_SECONDS,
			message: "The server is shutting down.",
		});
	},
};
