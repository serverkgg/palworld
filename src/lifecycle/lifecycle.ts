import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	applyAccess,
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
		roster.clear();
	},
	async stop(context) {
		context.emit(BridgeEventName.ServerStopping);

		roster.clear();

		await sendShutdown(context, SHUTDOWN_DELAY_SECONDS, SHUTDOWN_MESSAGE);
	},
};
