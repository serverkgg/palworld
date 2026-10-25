import { Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BUNDLED_PACKAGES, WORKSHOP_APP_ID } from "../shared";
import { modIdOfEntry, readEntries } from "./modEntries";
import { removedRecords, requireModStamp, saveModRecords, toggledRecords } from "./modRecords";
import { removeMods } from "./modStaging";
import { addUpload } from "./modUpload";
import { installWorkshopItem } from "./workshopInstall";

const PAGE_SIZE = 20;

const MISSING_MOD: Bridge.Text = {
	ar: "تعذّر العثور على هذا المود في سيرفرك. حدّث القائمة.",
	en: "We couldn't find this mod on your server. Refresh the list.",
};

export const mods: Bridge.SourcedCatalog = {
	kind: BridgeKind.Catalog,
	pageSize: PAGE_SIZE,
	source: {
		kind: Bridge.CatalogSourceKind.Workshop,
		appId: WORKSHOP_APP_ID,
		provided: BUNDLED_PACKAGES,
	},
	async installed(context) {
		return await readEntries(context);
	},
	async install(context, id) {
		return await installWorkshopItem(context, id);
	},
	async add(context, input) {
		return await addUpload(context, input);
	},
	async remove(context, id) {
		const stamp = await requireModStamp(context);
		const modId = modIdOfEntry(id, stamp.mods);

		if (modId === null) {
			return;
		}

		await removeMods(context, [
			modId,
		]);
		await saveModRecords(context, stamp, removedRecords(stamp.mods, modId));
	},
	async toggle(context, id, enabled) {
		const stamp = await requireModStamp(context);
		const modId = modIdOfEntry(id, stamp.mods);

		if (modId === null) {
			throw new BridgeUserError(MISSING_MOD);
		}

		await saveModRecords(context, stamp, toggledRecords(stamp.mods, modId, enabled));
	},
};
