import type { Bridge } from "@serverkgg/bridge";
import { playerSummaries, steamWebApiReady } from "@serverkgg/bridge/steam";
import { steamIdOf } from "./palworldBans";

export const AVATAR_CACHE_TTL_MS = 21_600_000;

const STEAM_AVATAR = /\/([0-9a-f]{40})(?:_[a-z]+)?\.jpg/;

export const avatarHashOf = (url: string) => {
	return url.match(STEAM_AVATAR)?.at(1) ?? null;
};

export interface PalworldAvatarCache {
	resolve(context: Bridge.Context, userIds: string[]): Promise<Map<string, string>>;
}

interface CachedAvatar {
	hash: string;
	storedAt: number;
}

export const createAvatarCache = (): PalworldAvatarCache => {
	const cached = new Map<string, CachedAvatar>();

	let warned = false;

	const hashOf = (steamId: string, now: number) => {
		const entry = cached.get(steamId);

		if (!entry) {
			return null;
		}

		if (now - entry.storedAt >= AVATAR_CACHE_TTL_MS) {
			cached.delete(steamId);

			return null;
		}

		return entry.hash;
	};

	const known = (userIds: string[], now: number) => {
		const hashes = new Map<string, string>();

		for (const userId of userIds) {
			const steamId = steamIdOf(userId);
			const hash = steamId === null ? null : hashOf(steamId, now);

			if (hash !== null) {
				hashes.set(userId, hash);
			}
		}

		return hashes;
	};

	return {
		async resolve(context, userIds) {
			const now = Date.now();
			const missing = new Set(
				userIds.flatMap((userId) => {
					const steamId = steamIdOf(userId);

					return steamId === null || hashOf(steamId, now) !== null
						? []
						: [
								steamId,
							];
				}),
			);

			if (missing.size === 0 || !steamWebApiReady(context)) {
				return known(userIds, now);
			}

			try {
				for (const summary of await playerSummaries(context, [
					...missing,
				])) {
					const hash = avatarHashOf(summary.avatarfull);

					if (hash !== null) {
						cached.set(summary.steamid, {
							hash,
							storedAt: now,
						});
					}
				}
			} catch (error) {
				if (!warned) {
					warned = true;

					context.log.warn("the steam web api did not answer for the palworld roster", {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			return known(userIds, now);
		},
	};
};

export const avatars = createAvatarCache();
