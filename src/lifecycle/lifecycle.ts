import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
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
	serverRoot,
} from "../shared";
import { applyUe4ss, UE4SS_LIBRARY, UE4SS_VARIABLE, ue4ssEnabled, ue4ssInstalled } from "../ue4ss";

const STOP_TIMEOUT_SECONDS = 90;

const NOT_APPLIED: Bridge.Text = {
	ar: "UE4SS مفعّل بس مو مركّب. شغّل السيرفر مرة ثانية عشان نركّبه، أو طفّي الخيار من تبويب المودات.",
	en: "UE4SS is on but not installed. Start the server again so we can install it, or turn the switch off on the mods tab.",
};

const ue4ssPrefix = async (context: Bridge.Context) => {
	if (!ue4ssEnabled(context.variable(UE4SS_VARIABLE))) {
		return [];
	}

	if (!(await ue4ssInstalled(context))) {
		throw new BridgeUserError(NOT_APPLIED);
	}

	return [
		"env",
		`LD_PRELOAD=${await serverRoot(context)}/${UE4SS_LIBRARY}`,
	];
};

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
		await applyUe4ss(context);

		return [
			...(await ue4ssPrefix(context)),
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
