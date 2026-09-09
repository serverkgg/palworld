import { describe, expect, test } from "bun:test";
import { BridgeUserError } from "@serverkgg/bridge";
import { parseBanList, platformOf, requireUserId, USER_ID_PATTERN } from "./palworldBans";

const ALICE = "steam_76561198000000001";

const BOB = "steam_76561198000000002";

const PLAYER_ID = "87333EC7000000000000000000000000";

describe("reading the banlist palworld writes itself", () => {
	test("reads the user id and the player id off one line", () => {
		expect(parseBanList(`${ALICE},${PLAYER_ID}\n`)).toEqual([
			{
				userId: ALICE,
				playerId: PLAYER_ID,
			},
		]);
	});

	test("keeps a line the game wrote without a player id", () => {
		expect(parseBanList(`${ALICE}\n${BOB},\n`)).toEqual([
			{
				userId: ALICE,
				playerId: null,
			},
			{
				userId: BOB,
				playerId: null,
			},
		]);
	});

	test("skips the blank lines the game leaves behind", () => {
		expect(parseBanList(`\n${ALICE},${PLAYER_ID}\n\n   \n`)).toEqual([
			{
				userId: ALICE,
				playerId: PLAYER_ID,
			},
		]);
	});

	test("splits on the first comma, so a stray one stays with the player id", () => {
		expect(parseBanList(`${ALICE},${PLAYER_ID},extra\n`).at(0)?.playerId).toBe(`${PLAYER_ID},extra`);
	});

	test("drops a duplicate and keeps the order the file has", () => {
		expect(parseBanList(`${BOB},${PLAYER_ID}\n${ALICE}\n${BOB}\n`).map((ban) => ban.userId)).toEqual([
			BOB,
			ALICE,
		]);
	});

	test("reads a file that carries windows line endings", () => {
		expect(parseBanList(`${ALICE},${PLAYER_ID}\r\n${BOB}\r\n`).map((ban) => ban.userId)).toEqual([
			ALICE,
			BOB,
		]);
	});

	test("reads an empty file as nobody banned", () => {
		expect(parseBanList("")).toEqual([]);
	});
});

describe("accepting a user id from the panel", () => {
	test("takes a steam id and trims it", () => {
		expect(requireUserId(`  ${ALICE} `)).toBe(ALICE);
	});

	test("takes an xbox id, because palworld bans those the same way", () => {
		expect(requireUserId("gdk_2535400000000000")).toBe("gdk_2535400000000000");
	});

	test("refuses a bare steam number, a profile url, a name or nothing at all", () => {
		for (const input of [
			"76561198000000001",
			"https://steamcommunity.com/id/meslzy",
			"Meslzy",
			"steam_",
			"_76561198000000001",
			"",
		]) {
			expect(() => requireUserId(input)).toThrow(BridgeUserError);
		}
	});

	test("refuses an id longer than any platform writes", () => {
		expect(() => requireUserId(`steam_${"7".repeat(64)}`)).toThrow(BridgeUserError);
	});

	test("matches exactly what the console accepts, so both doors agree", () => {
		expect(USER_ID_PATTERN.test(ALICE)).toBe(true);
		expect(USER_ID_PATTERN.test("Meslzy")).toBe(false);
	});
});

describe("naming the platform a banned id came from", () => {
	test("names the two prefixes palworld is known to write", () => {
		expect(platformOf(ALICE)).toBe("Steam");
		expect(platformOf("gdk_2535400000000000")).toBe("Xbox");
	});

	test("shows a store we have never seen as it was typed, capitalised, rather than inventing a name", () => {
		expect(platformOf("psn_0123456789")).toBe("Psn");
		expect(platformOf("epic_0123456789")).toBe("Epic");
	});

	test("leaves a prefix that already reads as a name alone", () => {
		expect(platformOf("Nintendo_0123456789")).toBe("Nintendo");
	});

	test("shows an id with no prefix as itself", () => {
		expect(platformOf("76561198000000001")).toBe("76561198000000001");
	});
});
