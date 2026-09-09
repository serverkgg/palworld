import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { AVATAR_CACHE_TTL_MS, avatarHashOf, createAvatarCache } from "./palworldAvatars";

const ALICE_HASH = "a".repeat(40);

const BOB_HASH = "b".repeat(40);

const ALICE = "steam_76561198000000001";

const BOB = "steam_76561198000000002";

interface Warning {
	message: string;
	fields: Bridge.Values | undefined;
}

interface Summary {
	steamid: string;
	avatarfull: string;
}

interface FakeSteam {
	context: Bridge.Context;
	calls: string[][];
	warnings: Warning[];
}

const summaryOf = (steamId: string, hash: string): Summary => {
	return {
		steamid: steamId,
		avatarfull: `https://avatars.steamstatic.com/${hash}_full.jpg`,
	};
};

const fakeSteam = (options: { key?: string | null; answer?: (steamIds: string[]) => Summary[] }): FakeSteam => {
	const calls: string[][] = [];
	const warnings: Warning[] = [];

	const context = {
		secret(key: string) {
			return key === "STEAM_WEB_API_KEY" ? (options.key === undefined ? "secret-key" : options.key) : null;
		},
		net: {
			async json(url: string) {
				const steamIds = (new URL(url).searchParams.get("steamids") ?? "").split(",").filter((id) => id.length > 0);

				calls.push(steamIds);

				return {
					response: {
						players: options.answer?.(steamIds) ?? [],
					},
				};
			},
		},
		log: {
			warn(message: string, fields?: Bridge.Values) {
				warnings.push({
					message,
					fields,
				});
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		calls,
		warnings,
	};
};

afterEach(() => {
	setSystemTime();
});

describe("reading the avatar hash out of a steam profile picture", () => {
	test("takes the hash out of the full-size url steam answers with", () => {
		expect(avatarHashOf(`https://avatars.steamstatic.com/${ALICE_HASH}_full.jpg`)).toBe(ALICE_HASH);
	});

	test("takes the hash out of a url that carries no size suffix", () => {
		expect(avatarHashOf(`https://avatars.steamstatic.com/${BOB_HASH}.jpg`)).toBe(BOB_HASH);
	});

	test("reports no hash for a url that is not a steam avatar", () => {
		expect(avatarHashOf("https://example.com/avatar.png")).toBeNull();
		expect(avatarHashOf("")).toBeNull();
	});
});

describe("keeping the steam avatars the palworld roster shows", () => {
	test("asks steam for a hash it has never seen, and answers with it", async () => {
		const steam = fakeSteam({
			answer: () => [
				summaryOf("76561198000000001", ALICE_HASH),
			],
		});
		const cache = createAvatarCache();

		expect(
			await cache.resolve(steam.context, [
				ALICE,
			]),
		).toEqual(
			new Map([
				[
					ALICE,
					ALICE_HASH,
				],
			]),
		);
		expect(steam.calls).toEqual([
			[
				"76561198000000001",
			],
		]);
	});

	test("answers the second time without asking steam again", async () => {
		const steam = fakeSteam({
			answer: () => [
				summaryOf("76561198000000001", ALICE_HASH),
			],
		});
		const cache = createAvatarCache();

		await cache.resolve(steam.context, [
			ALICE,
		]);

		expect(
			(
				await cache.resolve(steam.context, [
					ALICE,
				])
			).get(ALICE),
		).toBe(ALICE_HASH);
		expect(steam.calls.length).toBe(1);
	});

	test("asks only for the ids it is missing, and still answers for the cached one", async () => {
		const steam = fakeSteam({
			answer: (steamIds) => {
				return steamIds.map((steamId) => {
					return summaryOf(steamId, steamId.endsWith("1") ? ALICE_HASH : BOB_HASH);
				});
			},
		});
		const cache = createAvatarCache();

		await cache.resolve(steam.context, [
			ALICE,
		]);

		const hashes = await cache.resolve(steam.context, [
			ALICE,
			BOB,
		]);

		expect(steam.calls.at(1)).toEqual([
			"76561198000000002",
		]);
		expect(hashes.get(ALICE)).toBe(ALICE_HASH);
		expect(hashes.get(BOB)).toBe(BOB_HASH);
	});

	test("asks steam again once the cached hash is six hours old", async () => {
		setSystemTime(new Date(0));

		const steam = fakeSteam({
			answer: () => [
				summaryOf("76561198000000001", ALICE_HASH),
			],
		});
		const cache = createAvatarCache();

		await cache.resolve(steam.context, [
			ALICE,
		]);

		setSystemTime(new Date(AVATAR_CACHE_TTL_MS - 1));

		await cache.resolve(steam.context, [
			ALICE,
		]);

		expect(steam.calls.length).toBe(1);

		setSystemTime(new Date(AVATAR_CACHE_TTL_MS));

		expect(
			(
				await cache.resolve(steam.context, [
					ALICE,
				])
			).get(ALICE),
		).toBe(ALICE_HASH);
		expect(steam.calls.length).toBe(2);
	});

	test("never asks steam about a player who came in from another store", async () => {
		const steam = fakeSteam({});
		const cache = createAvatarCache();

		expect(
			await cache.resolve(steam.context, [
				"gdk_2535000000000001",
			]),
		).toEqual(new Map());
		expect(steam.calls).toEqual([]);
	});

	test("answers with nothing while the platform has no steam key", async () => {
		const steam = fakeSteam({
			key: null,
		});
		const cache = createAvatarCache();

		expect(
			await cache.resolve(steam.context, [
				ALICE,
			]),
		).toEqual(new Map());
		expect(steam.calls).toEqual([]);
		expect(steam.warnings).toEqual([]);
	});

	test("answers with nothing and warns once when steam refuses", async () => {
		const steam = fakeSteam({
			answer: () => {
				throw new Error("429 too many requests");
			},
		});
		const cache = createAvatarCache();

		expect(
			await cache.resolve(steam.context, [
				ALICE,
			]),
		).toEqual(new Map());
		expect(steam.warnings.length).toBe(1);

		await cache.resolve(steam.context, [
			ALICE,
		]);

		expect(steam.warnings.length).toBe(1);
	});

	test("never writes the api key into the warning it logs", async () => {
		const steam = fakeSteam({
			key: "top-secret-key",
			answer: () => {
				throw new Error("steam said no");
			},
		});
		const cache = createAvatarCache();

		await cache.resolve(steam.context, [
			ALICE,
		]);

		expect(JSON.stringify(steam.warnings)).not.toContain("top-secret-key");
	});

	test("keeps the roster moving when steam sends a profile with no usable picture", async () => {
		const steam = fakeSteam({
			answer: () => [
				{
					steamid: "76561198000000001",
					avatarfull: "https://example.com/none.png",
				},
			],
		});
		const cache = createAvatarCache();

		expect(
			await cache.resolve(steam.context, [
				ALICE,
			]),
		).toEqual(new Map());
	});
});
