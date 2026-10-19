import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { ProtonVerb, protonCommand } from "@serverkgg/bridge/wine";
import {
	appliedSettingKeys,
	applyAccess,
	classicMods,
	clearPendingSettings,
	deployedModIds,
	deployUe4ss,
	editionOf,
	installedMods,
	LINUX_SCRIPT,
	mergeSettings,
	metrics,
	PalworldEdition,
	readInstallStamp,
	readPendingBaseline,
	readPendingSettings,
	roster,
	SERVER_READY,
	SHUTDOWN_DELAY_SECONDS,
	SHUTDOWN_MESSAGE,
	STEAM_APP_ID,
	sendShutdown,
	settingsAppliedActivity,
	WINDOWS_BINARY,
	writeDeployedMods,
	writeModSettings,
} from "../shared";

const STOP_TIMEOUT_SECONDS = 90;

export const START_WRAPPER = "/opt/serverk/palworld-start";

const WINDOWS_ENVIRONMENT: Record<string, string> = {
	PROTON_USE_XALIA: "0",
	WINEDLLOVERRIDES: "dwmapi=n,b",
	SDL_AUDIODRIVER: "dummy",
	SDL_VIDEODRIVER: "dummy",
	XDG_SESSION_TYPE: "headless",
	XDG_RUNTIME_DIR: "/tmp/serverk-xdg",
};

export const startArgs = (port: number) => {
	return [
		"Pal",
		`-port=${port}`,
		"-useperfthreads",
		"-NoAsyncLoadingThread",
		"-UseMultithreadForDS",
	];
};

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

		const args = startArgs(context.port("game"));

		if (editionOf(context) === PalworldEdition.Linux) {
			return [
				`./${LINUX_SCRIPT}`,
				...args.slice(1),
			];
		}

		const listed = (await readInstallStamp(context))?.mods ?? [];
		const installed = await installedMods(context);
		const packages = await writeModSettings(context, installed, listed);
		const classic = classicMods(installed, listed);

		await deployUe4ss(context, classic);
		await writeDeployedMods(context, deployedModIds(installed, listed));

		if (packages.length > 0 || classic.length > 0) {
			context.log("loading the mods", {
				workshop: packages.join(", "),
				ue4ss: classic.map((mod) => mod.folder).join(", "),
			});
		}

		return [
			START_WRAPPER,
			...(await protonCommand(context, {
				appId: STEAM_APP_ID,
				exe: WINDOWS_BINARY,
				args,
				environment: WINDOWS_ENVIRONMENT,
				verb: ProtonVerb.RunInPrefix,
			})),
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
