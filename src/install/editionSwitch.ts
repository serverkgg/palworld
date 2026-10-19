import type { Bridge } from "@serverkgg/bridge";
import {
	CONFIG_FILES,
	EDITION_LAYOUTS,
	type InstallStamp,
	PalworldEdition,
	STEAM_APP_MANIFEST,
	writeInstallStamp,
} from "../shared";

export const leaveEdition = async (context: Bridge.Context, from: PalworldEdition, to: PalworldEdition) => {
	context.log("switching the palworld edition, the world stays where it is", {
		from,
		to,
	});

	for (const path of [
		...EDITION_LAYOUTS[from].owned,
		STEAM_APP_MANIFEST,
	]) {
		if (await context.files.exists(path)) {
			await context.files.remove(path);
		}
	}
};

const strayConfigOf = async (context: Bridge.Context, edition: PalworldEdition, file: string) => {
	for (const other of Object.values(PalworldEdition)) {
		const path = `${EDITION_LAYOUTS[other].configDirectory}/${file}`;

		if (other !== edition && (await context.files.exists(path))) {
			return path;
		}
	}

	return null;
};

export const carryConfig = async (context: Bridge.Context, edition: PalworldEdition) => {
	const directory = EDITION_LAYOUTS[edition].configDirectory;

	for (const file of CONFIG_FILES) {
		const target = `${directory}/${file}`;

		if (await context.files.exists(target)) {
			continue;
		}

		const source = await strayConfigOf(context, edition, file);

		if (source === null) {
			continue;
		}

		await context.files.ensure(directory);
		await context.files.move(source, target);

		context.log("carried the server config to the current edition", {
			file,
			edition,
		});
	}
};

export const settleEdition = async (context: Bridge.Context, stamp: InstallStamp | null, edition: PalworldEdition) => {
	const switching = stamp !== null && stamp.edition !== edition;

	if (switching) {
		await leaveEdition(context, stamp.edition, edition);

		await writeInstallStamp(context, {
			...stamp,
			edition,
		});
	}

	await carryConfig(context, edition);

	return switching;
};
