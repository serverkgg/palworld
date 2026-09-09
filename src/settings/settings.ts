import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import {
	crossplayRaw,
	crossplayValues,
	foldCrossplay,
	forgetPendingSettings,
	mergeSettings,
	readPendingSettings,
	readSettings,
	recordPendingSettings,
	validateSettingsWrite,
} from "../shared";

const currentSettings = async (context: Bridge.Context): Promise<Bridge.Values> => {
	return {
		...(await readSettings(context)),
		...(await readPendingSettings(context)),
	};
};

export const settings: Bridge.Settings = {
	kind: BridgeKind.Settings,
	async read(context) {
		const current = await currentSettings(context);

		return {
			...current,
			...crossplayValues(current),
		};
	},
	async write(context, values) {
		const checked = validateSettingsWrite(values);
		const patch = foldCrossplay(checked, crossplayRaw(await currentSettings(context)));

		await mergeSettings(context, patch);

		if (context.server.running) {
			await recordPendingSettings(context, patch);

			return;
		}

		await forgetPendingSettings(context, Object.keys(patch));
	},
};
