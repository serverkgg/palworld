import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { palworldPost, SERVER_SCRIPT } from "../shared";

const STOP_TIMEOUT_SECONDS = 90;

const SHUTDOWN_DELAY_SECONDS = 5;

export const lifecycle: Bridge.Lifecycle = {
	kind: BridgeKind.Lifecycle,
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
		await palworldPost(context, "/v1/api/shutdown", {
			waittime: SHUTDOWN_DELAY_SECONDS,
			message: "The server is shutting down.",
		});
	},
};
