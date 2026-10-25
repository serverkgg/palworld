import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import {
	editionOf,
	type InstallStamp,
	PalworldEdition,
	type PalworldMod,
	readInstallStamp,
	writeInstallStamp,
} from "../shared";

const LINUX_EDITION: Bridge.Text = {
	ar: "يشغّل بالورلد مودات السيرفر على ويندوز فقط. غيّر نظام التشغيل إلى ويندوز من الأعلى، ثم ثبّت المود.",
	en: "Palworld runs server mods only on Windows. Switch the operating system to Windows above, then install the mod.",
};

const NO_STAMP: Bridge.Text = {
	ar: "لم يكتمل تثبيت سيرفرك بعد. شغّله مرة، ثم ثبّت المود.",
	en: "Your server hasn't finished installing yet. Start it once, then install the mod.",
};

export const requireModStamp = async (context: Bridge.Context) => {
	const stamp = await readInstallStamp(context);

	if (stamp === null) {
		throw new BridgeUserError(NO_STAMP);
	}

	return stamp;
};

export const requireWindowsStamp = async (context: Bridge.Context) => {
	if (editionOf(context) !== PalworldEdition.Windows) {
		throw new BridgeUserError(LINUX_EDITION);
	}

	return await requireModStamp(context);
};

export const saveModRecords = async (context: Bridge.Context, stamp: InstallStamp, mods: PalworldMod[]) => {
	await writeInstallStamp(context, {
		...stamp,
		mods,
	});
};

export const recordOf = (records: PalworldMod[], id: string) => {
	return records.find((record) => record.id === id) ?? null;
};

export const uploadedRecords = (records: PalworldMod[], ids: string[]): PalworldMod[] => {
	return records.map((record) => {
		return ids.includes(record.id)
			? {
					id: record.id,
					enabled: record.enabled,
				}
			: record;
	});
};

export const installedRecords = (records: PalworldMod[], record: PalworldMod, replaced: string[]): PalworldMod[] => {
	return [
		...records.filter((entry) => entry.id !== record.id && !replaced.includes(entry.id)),
		record,
	];
};

export const removedRecords = (records: PalworldMod[], id: string) => {
	return records.filter((record) => record.id !== id);
};

export const toggledRecords = (records: PalworldMod[], id: string, enabled: boolean): PalworldMod[] => {
	const current = recordOf(records, id);

	if (current === null) {
		return [
			...records,
			{
				id,
				enabled,
			},
		];
	}

	return records.map((record) => {
		return record.id === id
			? {
					...record,
					enabled,
				}
			: record;
	});
};
