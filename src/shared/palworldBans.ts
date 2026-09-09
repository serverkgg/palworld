import { type Bridge, BridgeUserError } from "@serverkgg/bridge";

export const BAN_LIST_FILE = "Pal/Saved/SaveGames/banlist.txt";

export const USER_ID_PATTERN = /^[a-z0-9]{1,15}_[A-Za-z0-9]{1,48}$/;

export const STEAM_PREFIX = "steam_";

const LINE_BREAK = /\r?\n/;

const PLATFORM_NAMES: Record<string, string> = {
	gdk: "Xbox",
	steam: "Steam",
};

export interface PalworldBan {
	userId: string;
	playerId: string | null;
}

export const parseBanList = (text: string): PalworldBan[] => {
	const bans: PalworldBan[] = [];
	const seen = new Set<string>();

	for (const raw of text.split(LINE_BREAK)) {
		const line = raw.trim();
		const boundary = line.indexOf(",");
		const userId = (boundary < 0 ? line : line.slice(0, boundary)).trim();
		const playerId = boundary < 0 ? "" : line.slice(boundary + 1).trim();

		if (userId.length === 0 || seen.has(userId)) {
			continue;
		}

		seen.add(userId);
		bans.push({
			userId,
			playerId: playerId.length === 0 ? null : playerId,
		});
	}

	return bans;
};

export const requireUserId = (input: string) => {
	const userId = input.trim();

	if (!USER_ID_PATTERN.test(userId)) {
		throw new BridgeUserError({
			ar: "هذا مو معرّف لاعب. المعرّف يبدأ بـ steam_ ومعه رقم Steam64، أو gdk_ للي على Xbox — مثال: steam_76561198000000001",
			en: "That is not a user id. It starts with steam_ followed by the Steam64 id, or gdk_ on Xbox — like steam_76561198000000001.",
		});
	}

	return userId;
};

export const steamIdOf = (userId: string) => {
	return userId.startsWith(STEAM_PREFIX) ? userId.slice(STEAM_PREFIX.length) : null;
};

export const platformOf = (userId: string): string => {
	const boundary = userId.indexOf("_");
	const prefix = boundary < 0 ? userId : userId.slice(0, boundary);

	return PLATFORM_NAMES[prefix] ?? `${prefix.slice(0, 1).toUpperCase()}${prefix.slice(1)}`;
};

export const readBanList = async (context: Bridge.Context): Promise<PalworldBan[]> => {
	if (!(await context.files.exists(BAN_LIST_FILE))) {
		return [];
	}

	return parseBanList(await context.files.read(BAN_LIST_FILE));
};
