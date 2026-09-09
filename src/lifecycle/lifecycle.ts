import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	applyAccess,
	clearPendingSettings,
	mergeSettings,
	metrics,
	readPendingSettings,
	roster,
	SERVER_READY,
	SERVER_SCRIPT,
	SHUTDOWN_DELAY_SECONDS,
	SHUTDOWN_MESSAGE,
	sendShutdown,
} from "../shared";

const STOP_TIMEOUT_SECONDS = 90;

export const lifecycle: Bridge.Lifecycle = {
	kind: BridgeKind.Lifecycle,
	ready: SERVER_READY,
	stopTimeoutSeconds: STOP_TIMEOUT_SECONDS,
	async command(context) {
		const pending = await readPendingSettings(context);
		const replayed = Object.keys(pending).length;

		if (replayed > 0) {
			await mergeSettings(context, pending);
			await clearPendingSettings(context);

			context.log("replayed the settings the game overwrote on its last shutdown", {
				keys: replayed,
			});
		}

		await applyAccess(context);

		return [
			`./${SERVER_SCRIPT}`,
			`-port=${context.port("game")}`,
			"-useperfthreads",
			"-NoAsyncLoadingThread",
			"-UseMultithreadForDS",
		];
	},
	async onReady() {
		metrics.clear();
		roster.clear();
	},
	async stop(context) {
		context.emit(BridgeEventName.ServerStopping);

		metrics.clear();
		roster.clear();

		await sendShutdown(context, SHUTDOWN_DELAY_SECONDS, SHUTDOWN_MESSAGE);
	},
};
