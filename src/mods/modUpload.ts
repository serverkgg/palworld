import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { forgetPlacedMods, installedMods, modIdOf } from "../shared";
import { readEntry } from "./modEntries";
import { requireWindowsStamp, saveModRecords, uploadedRecords } from "./modRecords";
import { placeStaged, removeMods, sortStaged, stagedPathOf, supersededIds } from "./modStaging";

const NOT_FOUND: Bridge.Text = {
	ar: "تعذّر العثور على الملف المرفوع. ارفعه مرة ثانية.",
	en: "We couldn't find the uploaded file. Upload it again.",
};

export const addUpload = async (context: Bridge.Context, input: string) => {
	const staged = stagedPathOf(input);

	if (staged === null || !(await context.files.exists(staged))) {
		throw new BridgeUserError(NOT_FOUND);
	}

	try {
		const stamp = await requireWindowsStamp(context);
		const sorted = await sortStaged(context, staged);
		const ids = sorted.map((mod) => modIdOf(mod.kind, mod.folder));
		const replaced = supersededIds(await installedMods(context), sorted);

		await removeMods(context, replaced);
		await placeStaged(context, sorted);
		await forgetPlacedMods(context, ids);
		await saveModRecords(
			context,
			stamp,
			uploadedRecords(stamp.mods, ids).filter((record) => !replaced.includes(record.id)),
		);

		for (const mod of sorted) {
			context.log("installed an uploaded mod", {
				kind: mod.kind,
				folder: mod.folder,
			});
		}

		const [first] = sorted;

		return await readEntry(context, modIdOf(first.kind, first.folder));
	} finally {
		await context.files.remove(staged);
	}
};
