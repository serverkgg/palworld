import type { Bridge } from "@serverkgg/bridge";
import { readInstallStamp, writeInstallStamp } from "./installStamp";

const textOf = (value: Bridge.Value) => {
	return value === null ? "" : String(value);
};

export const readPendingSettings = async (context: Bridge.Context): Promise<Record<string, string>> => {
	return (await readInstallStamp(context))?.settingsPending ?? {};
};

export const recordPendingSettings = async (context: Bridge.Context, values: Bridge.Values) => {
	const stamp = await readInstallStamp(context);
	const pending: Record<string, string> = {
		...stamp?.settingsPending,
	};

	for (const [key, value] of Object.entries(values)) {
		pending[key] = textOf(value);
	}

	if (Object.keys(pending).length === 0) {
		return;
	}

	await writeInstallStamp(context, {
		buildId: stamp?.buildId ?? null,
		adminPasswordNext: stamp?.adminPasswordNext ?? null,
		settingsPending: pending,
	});
};

export const forgetPendingSettings = async (context: Bridge.Context, keys: string[]) => {
	const stamp = await readInstallStamp(context);

	if (stamp === null || stamp.settingsPending === null) {
		return;
	}

	const pending: Record<string, string> = {
		...stamp.settingsPending,
	};

	for (const key of keys) {
		delete pending[key];
	}

	const left = Object.keys(pending).length;

	if (left === Object.keys(stamp.settingsPending).length) {
		return;
	}

	await writeInstallStamp(context, {
		...stamp,
		settingsPending: left === 0 ? null : pending,
	});
};

export const clearPendingSettings = async (context: Bridge.Context) => {
	const stamp = await readInstallStamp(context);

	if (stamp === null || stamp.settingsPending === null) {
		return;
	}

	await writeInstallStamp(context, {
		...stamp,
		settingsPending: null,
	});
};
