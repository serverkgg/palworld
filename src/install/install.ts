import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { installedBuildId, isGameInstalled, SERVER_BINARY, STEAM_APP_ID } from "../shared";
import { readStamp, writeStamp } from "./installStamp";
import { seedSettings } from "./seedSettings";
import { linkSteamClient, prepareSteamcmd, updateGame } from "./steamcmd";

export const install: Bridge.Install = {
	kind: BridgeKind.Install,
	async run(context) {
		const stamp = await readStamp(context);
		const fresh = !(await isGameInstalled(context));

		await prepareSteamcmd(context);

		context.log(fresh ? "downloading the palworld dedicated server" : "checking steam for a newer build", {
			app: STEAM_APP_ID,
		});

		await updateGame(context, fresh);

		if (!(await isGameInstalled(context))) {
			throw new Error(`steamcmd finished but ${SERVER_BINARY} is missing`);
		}

		await linkSteamClient(context);
		await seedSettings(context);

		const buildId = await installedBuildId(context);

		if (buildId !== null && stamp !== null && stamp.buildId !== buildId) {
			context.log("the server updated to a newer steam build", {
				from: stamp.buildId,
				to: buildId,
			});
		}

		if (buildId !== null) {
			await writeStamp(context, {
				buildId,
			});
		}

		context.log("install complete", {
			app: STEAM_APP_ID,
			build: buildId,
		});
	},
	async describe(context) {
		const stamp = await readStamp(context);

		return {
			version: stamp?.buildId ?? (await installedBuildId(context)),
			variant: null,
			build: null,
		};
	},
};
