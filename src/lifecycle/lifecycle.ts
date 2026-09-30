import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	appliedSettingKeys,
	applyAccess,
	clearPendingSettings,
	mergeSettings,
	metrics,
	readPendingBaseline,
	readPendingSettings,
	roster,
	SERVER_READY,
	SERVER_SCRIPT,
	SHUTDOWN_DELAY_SECONDS,
	SHUTDOWN_MESSAGE,
	sendShutdown,
	settingsAppliedActivity,
} from "../shared";

const STOP_TIMEOUT_SECONDS = 90;

export const lifecycle: Bridge.Lifecycle = {
	kind: BridgeKind.Lifecycle,
	ready: SERVER_READY,
	stopTimeoutSeconds: STOP_TIMEOUT_SECONDS,
	async command(context) {
		const pending = await readPendingSettings(context);
		const replayed = Object.keys(pending);

		if (replayed.length > 0) {
			const changed = appliedSettingKeys(pending, await readPendingBaseline(context));

			await mergeSettings(context, pending);
			await clearPendingSettings(context);

			context.log("replayed the settings the game overwrote on its last shutdown", {
				keys: replayed.length,
			});

			if (changed.length > 0) {
				context.activity.report(settingsAppliedActivity(changed));
			}
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
