import type { Bridge } from "@serverkgg/bridge";
import { UE4SS_LOG } from "./ue4ssRelease";

const READ_LIMIT_BYTES = 4 * 1024 * 1024;

const TAIL_LINES = 200;

const TAIL_TIMEOUT_MS = 15_000;

const BANNER = /UE4SS - v(?<version>[^\s]+)/;

const SWEEP = /Palworld vtable sweep:/;

const REFUSED = /Palworld hook validation REFUSED (?<detail>.+?)\s*$/;

const NOTE = /Palworld hook validation NOTE (?<detail>.+?)\s*$/;

const MOD_STARTED = /Starting (?:Lua|C\+\+) mod '(?<mod>[^']+)'/;

const MOD_DETECTED = /New (?:Lua|C\+\+) mod detected: '(?<mod>[^']+)'/;

const REFUSED_HOOK = /^(?<hook>[^\s]+)/;

export const UE4SS_HEADLESS_REFUSALS = [
	"UGameViewportClient::Tick",
];

export interface Ue4ssStatus {
	loaded: boolean;
	version: string | null;
	refused: string[];
	notes: string[];
	sweeps: number;
	modsLoaded: string[];
}

export const headlessRefusal = (detail: string) => {
	const hook = REFUSED_HOOK.exec(detail)?.groups?.hook;

	return hook !== undefined && UE4SS_HEADLESS_REFUSALS.includes(hook);
};

const push = (into: string[], value: string | undefined) => {
	if (value !== undefined && value.length > 0 && !into.includes(value)) {
		into.push(value);
	}
};

export const ue4ssStatusOf = (lines: string[]): Ue4ssStatus => {
	const refused: string[] = [];
	const notes: string[] = [];
	const modsLoaded: string[] = [];

	let loaded = false;
	let version: string | null = null;
	let sweeps = 0;

	for (const line of lines) {
		const banner = BANNER.exec(line);

		if (banner !== null) {
			loaded = true;
			version = banner.groups?.version ?? version;
		}

		if (SWEEP.test(line)) {
			sweeps += 1;
		}

		const refusal = REFUSED.exec(line)?.groups?.detail;

		push(refusal !== undefined && headlessRefusal(refusal) ? notes : refused, refusal);
		push(notes, NOTE.exec(line)?.groups?.detail);
		push(modsLoaded, MOD_STARTED.exec(line)?.groups?.mod);
		push(modsLoaded, MOD_DETECTED.exec(line)?.groups?.mod);
	}

	return {
		loaded,
		version,
		refused,
		notes,
		sweeps,
		modsLoaded,
	};
};

export const logLines = (contents: string) => {
	return contents.split("\n").filter((line) => line.trim().length > 0);
};

export const readUe4ssLog = async (context: Bridge.Context): Promise<Ue4ssStatus | null> => {
	if (!(await context.files.exists(UE4SS_LOG))) {
		return null;
	}

	if ((await context.files.size(UE4SS_LOG)) > READ_LIMIT_BYTES) {
		const tailed = await context.exec(
			[
				"tail",
				"-n",
				String(TAIL_LINES),
				UE4SS_LOG,
			],
			{
				timeoutMs: TAIL_TIMEOUT_MS,
			},
		);

		return tailed.code === 0 ? ue4ssStatusOf(logLines(tailed.stdout)) : null;
	}

	return ue4ssStatusOf(logLines(await context.files.read(UE4SS_LOG)));
};
