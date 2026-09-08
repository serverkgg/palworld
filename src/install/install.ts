import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { readStamp, writeStamp } from "@serverkgg/bridge/install";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { createSteamcmd, installedBuildId, missingGameRoots } from "@serverkgg/bridge/steam";
import { GAME_ROOTS, STEAM_APP_ID } from "../shared";
import { seedSettings } from "./seedSettings";

export interface InstallStamp {
	buildId: string;
}

export const stampOf = (raw: Partial<InstallStamp> | null): InstallStamp | null => {
	return typeof raw?.buildId === "string"
		? {
				buildId: raw.buildId,
			}
		: null;
};

const readInstallStamp = async (context: Bridge.Context) => {
	return stampOf(await readStamp<Partial<InstallStamp>>(context));
};

const steamcmdOf = (context: Bridge.Context) => {
	return createSteamcmd(context, {
		appId: STEAM_APP_ID,
		label: "palworld",
	});
};

export const install: Bridge.Install = {
	kind: BridgeKind.Install,
	async run(context) {
		const stamp = await readInstallStamp(context);
		const missing = await missingGameRoots(context, GAME_ROOTS);
		const steamcmd = steamcmdOf(context);

		await steamcmd.prepare();

		if (missing.length > 0) {
			context.log("game files are missing, letting steam fetch and verify the install", {
				app: STEAM_APP_ID,
				missing: missing.join(", "),
			});
		} else {
			context.log("checking steam for a newer build", {
				app: STEAM_APP_ID,
			});
		}

		await steamcmd.update({
			validate: missing.length > 0,
		});

		const unrepaired = await missingGameRoots(context, GAME_ROOTS);

		if (unrepaired.length > 0) {
			throw new Error(`steamcmd finished but ${unrepaired.join(", ")} is missing`);
		}

		await steamcmd.linkSteamClient();
		await seedSettings(context);

		const buildId = await steamcmd.buildId();

		if (buildId !== null && stamp !== null && stamp.buildId !== buildId) {
			context.log("the server updated to a newer steam build", {
				from: stamp.buildId,
				to: buildId,
			});

			context.emit(BridgeEventName.ServerUpdated, {
				from: stamp.buildId,
				to: buildId,
			});
		}

		if (buildId !== null) {
			await writeStamp<InstallStamp>(context, {
				buildId,
			});
		}

		context.log("install complete", {
			app: STEAM_APP_ID,
			build: buildId,
		});
	},
	async describe(context) {
		const stamp = await readInstallStamp(context);

		return {
			version: stamp?.buildId ?? (await installedBuildId(context, STEAM_APP_ID)),
			variant: null,
			build: null,
		};
	},
};
