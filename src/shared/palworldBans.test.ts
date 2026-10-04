import { describe, expect, it } from "bun:test";
import { BridgeUserError } from "@serverkgg/bridge";
import { parseBanList, platformOf, requireUserId, USER_ID_PATTERN } from "./palworldBans";

const ALICE = "steam_76561198000000001";

const BOB = "steam_76561198000000002";

const PLAYER_ID = "87333EC7000000000000000000000000";

describe("reading the banlist palworld writes itself", () => {
	it("reads the user id and the player id off one line", () => {
		expect(parseBanList(`${ALICE},${PLAYER_ID}\n`)).toEqual([
			{
				userId: ALICE,
				playerId: PLAYER_ID,
			},
		]);
	});

	it("keeps a line the game wrote without a player id", () => {
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

	it("skips the blank lines the game leaves behind", () => {
		expect(parseBanList(`\n${ALICE},${PLAYER_ID}\n\n   \n`)).toEqual([
			{
				userId: ALICE,
				playerId: PLAYER_ID,
			},
		]);
	});

	it("splits on the first comma, so a stray one stays with the player id", () => {
		expect(parseBanList(`${ALICE},${PLAYER_ID},extra\n`).at(0)?.playerId).toBe(`${PLAYER_ID},extra`);
	});

	it("drops a duplicate and keeps the order the file has", () => {
		expect(parseBanList(`${BOB},${PLAYER_ID}\n${ALICE}\n${BOB}\n`).map((ban) => ban.userId)).toEqual([
			BOB,
			ALICE,
		]);
	});

	it("reads a file that carries windows line endings", () => {
		expect(parseBanList(`${ALICE},${PLAYER_ID}\r\n${BOB}\r\n`).map((ban) => ban.userId)).toEqual([
			ALICE,
			BOB,
		]);
	});

	it("reads an empty file as nobody banned", () => {
		expect(parseBanList("")).toEqual([]);
	});
});

describe("accepting a user id from the panel", () => {
	it("takes a steam id and trims it", () => {
		expect(requireUserId(`  ${ALICE} `)).toBe(ALICE);
	});

	it("takes an xbox id, because palworld bans those the same way", () => {
		expect(requireUserId("gdk_2535400000000000")).toBe("gdk_2535400000000000");
	});

	it("refuses a bare steam number, a profile url, a name or nothing at all", () => {
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

	it("refuses an id longer than any platform writes", () => {
		expect(() => requireUserId(`steam_${"7".repeat(64)}`)).toThrow(BridgeUserError);
	});

	it("matches exactly what the console accepts, so both doors agree", () => {
		expect(USER_ID_PATTERN.test(ALICE)).toBe(true);
		expect(USER_ID_PATTERN.test("Meslzy")).toBe(false);
	});
});

describe("naming the platform a banned id came from", () => {
	it("names the two prefixes palworld is known to write", () => {
		expect(platformOf(ALICE)).toBe("Steam");
		expect(platformOf("gdk_2535400000000000")).toBe("Xbox");
	});

	it("shows a store we have never seen as it was typed, capitalised, rather than inventing a name", () => {
		expect(platformOf("psn_0123456789")).toBe("Psn");
		expect(platformOf("epic_0123456789")).toBe("Epic");
	});

	it("leaves a prefix that already reads as a name alone", () => {
		expect(platformOf("Nintendo_0123456789")).toBe("Nintendo");
	});

	it("shows an id with no prefix as itself", () => {
		expect(platformOf("76561198000000001")).toBe("76561198000000001");
	});
});
