import { type Bridge, BridgeControl } from "@serverkgg/bridge";
import { changedSettingKeys, sameSettingValue } from "@serverkgg/bridge/utils";
import { type PendingBaseline, readInstallStamp, writeInstallStamp } from "./installStamp";
import { settingsFieldOf } from "./palworldSettingsFields";

const textOf = (value: Bridge.Value) => {
	return value === null ? "" : String(value);
};

const isSecretSetting = (key: string) => {
	return settingsFieldOf(key)?.control === BridgeControl.Secret;
};

const emptyBaseline = (): PendingBaseline => {
	return {
		values: {},
		secrets: {},
	};
};

const withoutKeys = <Value>(record: Record<string, Value>, keys: string[]): Record<string, Value> => {
	const kept: Record<string, Value> = {
		...record,
	};

	for (const key of keys) {
		delete kept[key];
	}

	return kept;
};

export const readPendingSettings = async (context: Bridge.Context): Promise<Record<string, string>> => {
	return (await readInstallStamp(context))?.settingsPending ?? {};
};

export const readPendingBaseline = async (context: Bridge.Context): Promise<PendingBaseline | null> => {
	return (await readInstallStamp(context))?.settingsBaseline ?? null;
};

export const recordBaseline = (
	previous: PendingBaseline,
	alreadyPending: Record<string, string>,
	before: Bridge.Values,
	values: Bridge.Values,
): PendingBaseline => {
	const baseline: PendingBaseline = {
		values: {
			...previous.values,
		},
		secrets: {
			...previous.secrets,
		},
	};

	for (const [key, value] of Object.entries(values)) {
		const first = !Object.hasOwn(alreadyPending, key);

		if (isSecretSetting(key)) {
			const differs = !sameSettingValue(before[key], value);

			if (first) {
				baseline.secrets[key] = differs;
			} else if (Object.hasOwn(baseline.secrets, key)) {
				baseline.secrets[key] = baseline.secrets[key] === true || differs;
			}

			continue;
		}

		if (first) {
			baseline.values[key] = textOf(before[key] ?? null);
		}
	}

	return baseline;
};

export const appliedSettingKeys = (pending: Record<string, string>, baseline: PendingBaseline | null): string[] => {
	if (baseline === null) {
		return Object.keys(pending);
	}

	const compared: Bridge.Values = {};

	for (const [key, value] of Object.entries(pending)) {
		if (Object.hasOwn(baseline.values, key)) {
			compared[key] = value;
		}
	}

	const differs = new Set(changedSettingKeys(baseline.values, compared));

	return Object.keys(pending).filter((key) => {
		if (Object.hasOwn(baseline.values, key)) {
			return differs.has(key);
		}

		if (Object.hasOwn(baseline.secrets, key)) {
			return baseline.secrets[key] === true;
		}

		return true;
	});
};

export const recordPendingSettings = async (context: Bridge.Context, values: Bridge.Values, before: Bridge.Values) => {
	const stamp = await readInstallStamp(context);
	const alreadyPending: Record<string, string> = {
		...stamp?.settingsPending,
	};
	const pending: Record<string, string> = {
		...alreadyPending,
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
		settingsBaseline: recordBaseline(stamp?.settingsBaseline ?? emptyBaseline(), alreadyPending, before, values),
	});
};

export const forgetPendingSettings = async (context: Bridge.Context, keys: string[]) => {
	const stamp = await readInstallStamp(context);

	if (stamp === null || stamp.settingsPending === null) {
		return;
	}

	const pending = withoutKeys(stamp.settingsPending, keys);
	const left = Object.keys(pending).length;

	if (left === Object.keys(stamp.settingsPending).length) {
		return;
	}

	await writeInstallStamp(context, {
		...stamp,
		settingsPending: left === 0 ? null : pending,
		settingsBaseline:
			left === 0 || stamp.settingsBaseline === null
				? null
				: {
						values: withoutKeys(stamp.settingsBaseline.values, keys),
						secrets: withoutKeys(stamp.settingsBaseline.secrets, keys),
					},
	});
};

export const clearPendingSettings = async (context: Bridge.Context) => {
	const stamp = await readInstallStamp(context);

	if (stamp === null || (stamp.settingsPending === null && stamp.settingsBaseline === null)) {
		return;
	}

	await writeInstallStamp(context, {
		...stamp,
		settingsPending: null,
		settingsBaseline: null,
	});
};
