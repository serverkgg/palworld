import type { Bridge } from "@serverkgg/bridge";

export const CROSSPLAY_KEY = "CrossplayPlatforms";

export const CROSSPLAY_XBOX_KEY = "CrossplayXbox";

export const CROSSPLAY_PS5_KEY = "CrossplayPS5";

export const CROSSPLAY_MAC_KEY = "CrossplayMac";

export const CROSSPLAY_KEYS = [
	CROSSPLAY_XBOX_KEY,
	CROSSPLAY_PS5_KEY,
	CROSSPLAY_MAC_KEY,
];

const SEPARATOR = ",";

export interface PalworldCrossplay {
	xbox: boolean;
	ps5: boolean;
	mac: boolean;
}

const tokensOf = (raw: string) => {
	const trimmed = raw.trim();
	const inner = trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1) : trimmed;

	return inner
		.split(SEPARATOR)
		.map((token) => token.trim().toLowerCase())
		.filter((token) => token.length > 0);
};

export const parseCrossplay = (raw: string | null): PalworldCrossplay => {
	if (raw === null || raw.trim().length === 0) {
		return {
			xbox: true,
			ps5: true,
			mac: true,
		};
	}

	const tokens = tokensOf(raw);

	return {
		xbox: tokens.includes("xbox"),
		ps5: tokens.includes("ps5"),
		mac: tokens.includes("mac"),
	};
};

export const serializeCrossplay = (crossplay: PalworldCrossplay) => {
	const platforms = [
		"Steam",
		...(crossplay.xbox
			? [
					"Xbox",
				]
			: []),
		...(crossplay.ps5
			? [
					"PS5",
				]
			: []),
		...(crossplay.mac
			? [
					"Mac",
				]
			: []),
	];

	return `(${platforms.join(SEPARATOR)})`;
};

export const crossplayRaw = (settings: Bridge.Values) => {
	const raw = settings[CROSSPLAY_KEY];

	return typeof raw === "string" ? raw : null;
};

export const crossplayValues = (settings: Bridge.Values): Bridge.Values => {
	const crossplay = parseCrossplay(crossplayRaw(settings));

	return {
		[CROSSPLAY_XBOX_KEY]: crossplay.xbox,
		[CROSSPLAY_PS5_KEY]: crossplay.ps5,
		[CROSSPLAY_MAC_KEY]: crossplay.mac,
	};
};

export const foldCrossplay = (values: Bridge.Values, raw: string | null): Bridge.Values => {
	const rest: Bridge.Values = {};
	const chosen: Partial<PalworldCrossplay> = {};

	for (const [key, value] of Object.entries(values)) {
		if (key === CROSSPLAY_XBOX_KEY) {
			chosen.xbox = value === true;
		} else if (key === CROSSPLAY_PS5_KEY) {
			chosen.ps5 = value === true;
		} else if (key === CROSSPLAY_MAC_KEY) {
			chosen.mac = value === true;
		} else {
			rest[key] = value;
		}
	}

	if (Object.keys(chosen).length === 0) {
		return rest;
	}

	return {
		...rest,
		[CROSSPLAY_KEY]: serializeCrossplay({
			...parseCrossplay(raw),
			...chosen,
		}),
	};
};
