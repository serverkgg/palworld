import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { CONTAINER_HOME, PROTON_HEADLESS_ENVIRONMENT, ProtonVerb, protonCommand } from "@serverkgg/bridge/wine";
import {
	appliedSettingKeys,
	applyAccess,
	clearPendingSettings,
	editionOf,
	LINUX_SCRIPT,
	mergeSettings,
	metrics,
	modNameOf,
	PalworldEdition,
	readPendingBaseline,
	readPendingSettings,
	restoreShippedBanList,
	roster,
	SERVER_READY,
	SHUTDOWN_DELAY_SECONDS,
	SHUTDOWN_MESSAGE,
	STEAM_APP_ID,
	sendShutdown,
	settingsAppliedActivity,
	settleSteamClient,
	WINDOWS_BAN_LIST,
	WINDOWS_BINARY,
	WINDOWS_BINARY_DIRECTORY,
	windowsSteamOf,
} from "../shared";
import { deployMods } from "./modDeploy";

const STOP_TIMEOUT_SECONDS = 90;

export const START_WRAPPER = "/opt/serverk/palworld-start";

export const WINDOWS_ENVIRONMENT: Record<string, string> = {
	...PROTON_HEADLESS_ENVIRONMENT,
	WINEDLLOVERRIDES: "dwmapi=n,b",
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

		const steam = editionOf(context) === PalworldEdition.Linux || windowsSteamOf(context);

		if (steam) {
			await restoreShippedBanList(context);
		} else {
			await mergeSettings(context, WINDOWS_BAN_LIST);
		}

		const placed = await deployMods(context);
		const args = startArgs(context.port("game"));

		if (editionOf(context) === PalworldEdition.Linux) {
			return [
				`./${LINUX_SCRIPT}`,
				...args.slice(1),
			];
		}

		await settleSteamClient(context);

		if (placed.length > 0) {
			context.log("loading the mods", {
				mods: placed.map(modNameOf).join(", "),
			});
		}

		return [
			START_WRAPPER,
			`${CONTAINER_HOME}/${WINDOWS_BINARY_DIRECTORY}`,
			...(await protonCommand(context, {
				appId: STEAM_APP_ID,
				exe: `${CONTAINER_HOME}/${WINDOWS_BINARY}`,
				args: steam
					? args.slice(0, 2)
					: [
							...args.slice(0, 2),
							"-nosteam",
						],
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
