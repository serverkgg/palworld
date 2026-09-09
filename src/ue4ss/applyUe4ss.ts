import type { Bridge } from "@serverkgg/bridge";
import { installUe4ss, removeUe4ss, shouldInstall, shouldRemove, ue4ssInstalled, ue4ssPresent } from "./ue4ssInstall";
import { readUe4ssStamp, UE4SS_VARIABLE } from "./ue4ssRelease";

export const applyUe4ss = async (context: Bridge.Context) => {
	const variable = context.variable(UE4SS_VARIABLE);
	const installed = await ue4ssInstalled(context);

	if (shouldInstall(await readUe4ssStamp(context), variable, installed)) {
		await installUe4ss(context);

		return;
	}

	if (shouldRemove(variable, await ue4ssPresent(context))) {
		await removeUe4ss(context);
	}
};
