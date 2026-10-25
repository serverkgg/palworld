import type { Bridge } from "@serverkgg/bridge";
import { workshopArchivePath } from "@serverkgg/bridge/steam";
import {
	forgetPlacedMods,
	installedMods,
	MOD_STAGING,
	type ModPackage,
	modIdOf,
	type PalworldMod,
	WORKSHOP_APP_ID,
	WORKSHOP_ITEM_ID,
} from "../shared";
import { readEntry } from "./modEntries";
import { installedRecords, requireWindowsStamp, saveModRecords } from "./modRecords";
import { placeStaged, removeMods, stagedPackageOf, supersededIds } from "./modStaging";

export const workshopStagingOf = (itemId: string) => {
	return `${MOD_STAGING}/${itemId}`;
};

const requireItemId = (id: string) => {
	if (!WORKSHOP_ITEM_ID.test(id)) {
		throw new Error("a workshop item id is digits only");
	}

	return id;
};

const recordFor = (mod: ModPackage, itemId: string, previous: PalworldMod | undefined): PalworldMod => {
	const record: PalworldMod = {
		id: modIdOf(mod.kind, mod.folder),
		enabled: previous?.enabled ?? true,
		itemId,
	};

	if (mod.info.packageName !== null) {
		record.packageName = mod.info.packageName;
	}

	if (mod.info.version !== null) {
		record.version = mod.info.version;
	}

	return record;
};

export const installWorkshopItem = async (context: Bridge.Context, id: string) => {
	const itemId = requireItemId(id);
	const archive = workshopArchivePath(WORKSHOP_APP_ID, itemId);
	const staged = workshopStagingOf(itemId);

	try {
		const stamp = await requireWindowsStamp(context);

		await context.files.remove(staged);
		await context.files.extract(archive, staged, {
			tree: true,
		});

		const main = await stagedPackageOf(context, staged, itemId);
		const keep = modIdOf(main.kind, main.folder);
		const replaced = [
			...new Set([
				...stamp.mods.filter((record) => record.itemId === itemId).map((record) => record.id),
				...supersededIds(await installedMods(context), [
					main,
				]),
			]),
		].filter((entry) => entry !== keep);

		await removeMods(context, replaced);
		await placeStaged(context, [
			main,
		]);
		await forgetPlacedMods(context, [
			keep,
		]);

		const record = recordFor(
			main,
			itemId,
			stamp.mods.find((entry) => entry.itemId === itemId),
		);

		await saveModRecords(context, stamp, installedRecords(stamp.mods, record, replaced));

		context.log("installed a workshop mod", {
			item: itemId,
			folder: main.folder,
			version: main.info.version ?? "",
		});

		return await readEntry(context, keep);
	} finally {
		await context.files.remove(archive);
		await context.files.remove(staged);
	}
};
