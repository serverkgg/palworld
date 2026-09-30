import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { createSteamcmd, installedBuildId, missingGameRoots } from "@serverkgg/bridge/steam";
import {
	GAME_ROOTS,
	installedActivity,
	readInstallStamp,
	STEAM_APP_ID,
	updatedActivity,
	writeInstallStamp,
} from "../shared";
import { seedSettings } from "./seedSettings";

const MISSING_FILES: Bridge.Text = {
	ar: "التنزيل خلص بس ملفات اللعبة ناقصة. جرّب التثبيت مرة ثانية.",
	en: "The download finished but the game files are missing. Try the install again.",
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
			throw new BridgeUserError(MISSING_FILES, {
				cause: new Error(`steamcmd finished but ${unrepaired.join(", ")} is missing`),
			});
		}

		await steamcmd.linkSteamClient();
		await seedSettings(context);

		const buildId = await steamcmd.buildId();
		const previous = stamp?.buildId ?? null;

		if (buildId !== null && previous !== null && previous !== buildId) {
			context.log("the server updated to a newer steam build", {
				from: previous,
				to: buildId,
			});

			context.emit(BridgeEventName.ServerUpdated, {
				from: previous,
				to: buildId,
			});
			context.activity.report(updatedActivity(previous, buildId));
		}

		await writeInstallStamp(context, {
			buildId: buildId ?? previous,
			adminPasswordNext: stamp?.adminPasswordNext ?? null,
			settingsPending: stamp?.settingsPending ?? null,
			settingsBaseline: stamp?.settingsBaseline ?? null,
		});

		context.log("install complete", {
			app: STEAM_APP_ID,
			build: buildId,
		});

		if (stamp === null) {
			context.activity.report(installedActivity(buildId));
		}
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
