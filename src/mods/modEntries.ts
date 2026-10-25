import { Bridge } from "@serverkgg/bridge";
import { workshopItemPageUrl } from "@serverkgg/bridge/steam";
import {
	installedMods,
	type ModPackage,
	modIdOf,
	type PalworldMod,
	PalworldModKind,
	parseModId,
	readInstallStamp,
	WORKSHOP_ITEM_ID,
} from "../shared";
import { recordOf } from "./modRecords";
import { noteOf, readModEvidence } from "./modStatus";

const UPLOAD_PREFIX = "upload:";

const WORKSHOP_PROVIDER: string = Bridge.CatalogSourceKind.Workshop;

const uploadIdOf = (mod: ModPackage) => {
	return `${UPLOAD_PREFIX}${modIdOf(mod.kind, mod.folder)}`;
};

export const modIdOfEntry = (id: string, records: PalworldMod[]) => {
	if (WORKSHOP_ITEM_ID.test(id)) {
		return records.find((record) => record.itemId === id)?.id ?? null;
	}

	const modId = id.startsWith(UPLOAD_PREFIX) ? id.slice(UPLOAD_PREFIX.length) : "";

	return parseModId(modId) === null ? null : modId;
};

const entryOf = (mod: ModPackage, record: PalworldMod | null, note: Bridge.Text): Bridge.CatalogEntry => {
	const itemId = mod.kind === PalworldModKind.Workshop ? (record?.itemId ?? null) : null;

	return {
		id: itemId ?? uploadIdOf(mod),
		provider: itemId === null ? null : WORKSHOP_PROVIDER,
		path: mod.path,
		title: mod.info.name ?? record?.packageName ?? mod.folder,
		version: record?.version ?? mod.info.version,
		sizeBytes: mod.sizeBytes,
		enabled: record?.enabled ?? true,
		gameVersion: null,
		stale: false,
		pageUrl: itemId === null ? null : workshopItemPageUrl(itemId),
		icon: null,
		note,
	};
};

const entriesOf = async (context: Bridge.Context) => {
	const records = (await readInstallStamp(context))?.mods ?? [];
	const installed = await installedMods(context);
	const evidence = await readModEvidence(context, installed);
	const entries: [
		string,
		Bridge.CatalogEntry,
	][] = [];

	for (const mod of installed) {
		const id = modIdOf(mod.kind, mod.folder);
		const record = recordOf(records, id);

		entries.push([
			id,
			entryOf(mod, record, await noteOf(context, evidence, mod, record?.enabled ?? true)),
		]);
	}

	return entries;
};

export const readEntries = async (context: Bridge.Context) => {
	return (await entriesOf(context)).map(([, entry]) => entry);
};

export const readEntry = async (context: Bridge.Context, modId: string) => {
	const found = (await entriesOf(context)).find(([id]) => id === modId);

	if (found === undefined) {
		throw new Error(`mod ${modId} is not installed`);
	}

	return found[1];
};
