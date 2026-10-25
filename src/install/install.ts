import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { createSteamcmd, installedBuildId, missingGameRoots } from "@serverkgg/bridge/steam";
import { prepareWinePrefix } from "@serverkgg/bridge/wine";
import {
	EDITION_LAYOUTS,
	editionOf,
	installedActivity,
	MOD_ROOTS,
	PalworldEdition,
	PalworldModKind,
	readInstallStamp,
	STEAM_APP_ID,
	updatedActivity,
	writeInstallStamp,
} from "../shared";
import { settleEdition } from "./editionSwitch";
import { seedSettings } from "./seedSettings";

const MISSING_FILES: Bridge.Text = {
	ar: "اكتمل التنزيل لكن ملفات اللعبة ناقصة. جرب التثبيت مرة ثانية.",
	en: "The download finished but the game files are missing. Try the install again.",
};

const steamcmdOf = (context: Bridge.Context, edition: PalworldEdition) => {
	return createSteamcmd(context, {
		appId: STEAM_APP_ID,
		label: "palworld",
		platform: EDITION_LAYOUTS[edition].platform,
	});
};

export const install: Bridge.Install = {
	kind: BridgeKind.Install,
	async run(context) {
		const stamp = await readInstallStamp(context);
		const edition = editionOf(context);
		const roots = EDITION_LAYOUTS[edition].roots;

		const switching = await settleEdition(context, stamp, edition);

		const missing = await missingGameRoots(context, roots);
		const steamcmd = steamcmdOf(context, edition);

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
			validate: switching || missing.length > 0,
		});

		const unrepaired = await missingGameRoots(context, roots);

		if (unrepaired.length > 0) {
			throw new BridgeUserError(MISSING_FILES, {
				cause: new Error(`steamcmd finished but ${unrepaired.join(", ")} is missing`),
			});
		}

		await steamcmd.linkSteamClient();

		if (edition === PalworldEdition.Windows) {
			await prepareWinePrefix(context, {
				appId: STEAM_APP_ID,
				proton: true,
			});

			await context.files.ensure(MOD_ROOTS[PalworldModKind.Workshop]);
		}

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

		const fresh = await readInstallStamp(context);

		await writeInstallStamp(context, {
			buildId: buildId ?? previous,
			edition,
			mods: fresh?.mods ?? [],
			adminPasswordNext: fresh?.adminPasswordNext ?? null,
			settingsPending: fresh?.settingsPending ?? null,
			settingsBaseline: fresh?.settingsBaseline ?? null,
		});

		context.log("install complete", {
			app: STEAM_APP_ID,
			build: buildId,
			edition,
		});

		if (stamp === null) {
			context.activity.report(installedActivity(buildId));
		}
	},
	async describe(context) {
		const stamp = await readInstallStamp(context);

		return {
			version: stamp?.buildId ?? (await installedBuildId(context, STEAM_APP_ID)),
			variant: stamp?.edition === PalworldEdition.Windows ? PalworldEdition.Windows : null,
			build: null,
		};
	},
};
