import type { Bridge } from "@serverkgg/bridge";
import {
	BUNDLED_PACKAGES,
	editionOf,
	type ModPackage,
	ModRuleType,
	modDestinationsOf,
	modIdOf,
	modNameOf,
	PalworldEdition,
	readPlacedMods,
	UE4SS_DIRECTORY,
} from "../shared";

export const UE4SS_LOG = `${UE4SS_DIRECTORY}/UE4SS.log`;

const PALSCHEMA_LOADED = /\[PalSchema\] Loading mod: (.+?)\s*$/gm;

const UE4SS_STARTED = /Mod '(.+?)' has enabled\.txt, starting mod\./g;

const UE4SS_LOG_LINES = "has enabled\\.txt, starting mod\\.|\\[PalSchema\\] Loading mod: ";

const LOGGED_RULES = [
	ModRuleType.Lua,
	ModRuleType.PalSchema,
];

const RUNNING: Bridge.Text = {
	ar: "شغّال",
	en: "Running",
};

const WAITING: Bridge.Text = {
	ar: "يشتغل بعد الريستارت",
	en: "Runs after a restart",
};

const FAILED: Bridge.Text = {
	ar: "تعذّر تشغيله، راجع الكونسول",
	en: "Couldn't start. Check the console",
};

const OFF: Bridge.Text = {
	ar: "موقوف",
	en: "Off",
};

const CLIENT_ONLY: Bridge.Text = {
	ar: "لا يشتغل على السيرفرات",
	en: "Doesn't run on servers",
};

const OVERSIZED: Bridge.Text = {
	ar: "تعذّر وضعه على السيرفر لكثرة ملفاته",
	en: "Too many files to place",
};

const WINDOWS_ONLY: Bridge.Text = {
	ar: "يشتغل على ويندوز فقط",
	en: "Runs on Windows only",
};

interface ModLoads {
	log: boolean;
	palschema: Set<string>;
	ue4ss: Set<string>;
}

export interface ModStatus {
	oversized: boolean;
	enabled: boolean;
	server: boolean;
	missing: string[];
	deployed: boolean;
	started: boolean;
	loaded: boolean;
}

interface ModEvidence {
	edition: PalworldEdition;
	placed: Set<string>;
	names: Set<string>;
	loads: ModLoads;
}

export const modLoadsOf = (log: string | null): ModLoads => {
	return {
		log: log !== null,
		palschema: new Set(
			[
				...(log ?? "").matchAll(PALSCHEMA_LOADED),
			].map((match) => match[1] ?? ""),
		),
		ue4ss: new Set(
			[
				...(log ?? "").matchAll(UE4SS_STARTED),
			].map((match) => match[1] ?? ""),
		),
	};
};

export const missingOf = (names: string[]): Bridge.Text => {
	return names.length === 1
		? {
				ar: `يتطلب ${names[0]}، وهو غير مثبّت`,
				en: `Needs ${names[0]}, which isn't installed`,
			}
		: {
				ar: `يتطلب مودات غير مثبّتة: ${names.join("، ")}`,
				en: `Needs mods that aren't installed: ${names.join(", ")}`,
			};
};

export const stateOf = (edition: PalworldEdition, status: ModStatus) => {
	if (edition === PalworldEdition.Linux) {
		return WINDOWS_ONLY;
	}

	if (status.oversized) {
		return OVERSIZED;
	}

	if (!status.server) {
		return CLIENT_ONLY;
	}

	if (!status.enabled) {
		return OFF;
	}

	if (status.missing.length > 0) {
		return missingOf(status.missing);
	}

	if (!status.deployed || !status.started) {
		return WAITING;
	}

	return status.loaded ? RUNNING : FAILED;
};

const missingDependenciesOf = (mod: ModPackage, names: Set<string>) => {
	return mod.info.dependencies.filter((name) => !BUNDLED_PACKAGES.includes(name) && !names.has(name));
};

const loadedOf = async (context: Bridge.Context, mod: ModPackage, loads: ModLoads) => {
	const name = modNameOf(mod);

	for (const destination of modDestinationsOf(mod)) {
		const loaded =
			destination.type === ModRuleType.Lua
				? loads.ue4ss.has(name)
				: destination.type === ModRuleType.PalSchema
					? loads.palschema.has(name)
					: await context.files.exists(destination.path);

		if (!loaded) {
			return false;
		}
	}

	return true;
};

const readLogLines = async (context: Bridge.Context) => {
	try {
		const result = await context.exec([
			"grep",
			"-a",
			"-E",
			UE4SS_LOG_LINES,
			UE4SS_LOG,
		]);

		return result.code === 0 || result.code === 1 ? result.stdout : null;
	} catch {
		return null;
	}
};

export const readModEvidence = async (context: Bridge.Context, installed: ModPackage[]): Promise<ModEvidence> => {
	return {
		edition: editionOf(context),
		placed: new Set(
			(await readPlacedMods(context)).flatMap((placed) =>
				placed.id === null
					? []
					: [
							placed.id,
						],
			),
		),
		names: new Set(installed.map(modNameOf)),
		loads: modLoadsOf(await readLogLines(context)),
	};
};

export const noteOf = async (context: Bridge.Context, evidence: ModEvidence, mod: ModPackage, enabled: boolean) => {
	const types = modDestinationsOf(mod).map((destination) => destination.type);
	const deployed = evidence.placed.has(modIdOf(mod.kind, mod.folder));

	return stateOf(evidence.edition, {
		oversized: mod.oversized,
		enabled,
		server: types.length > 0,
		missing: missingDependenciesOf(mod, evidence.names),
		deployed,
		started: !types.some((type) => LOGGED_RULES.includes(type)) || evidence.loads.log,
		loaded: deployed && (await loadedOf(context, mod, evidence.loads)),
	});
};
