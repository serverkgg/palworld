import { describe, expect, test } from "bun:test";
import { rosterOf } from "./palworldPlayers";
import { presenceOf } from "./palworldRoster";

const ENTRY = {
	id: "steam_1",
	name: "Meslzy",
	account: "meslzy",
	platform: "Steam",
	level: 42,
	ping: 31,
	buildings: 7,
	avatarHash: null,
};

describe("sending the player data serverk.yml promises", () => {
	test("carries the name, the stable id and every declared field", () => {
		expect(presenceOf(ENTRY)).toEqual({
			player: "Meslzy",
			userId: "steam_1",
			account: "meslzy",
			platform: "Steam",
			level: "42",
			ping: "31",
		});
	});

	test("carries the store account for a player who will never have a steam avatar", () => {
		expect(
			presenceOf({
				...ENTRY,
				id: "gdk_1",
				name: "Nasser",
				account: "NasserGT",
				platform: "Xbox",
			}),
		).toMatchObject({
			account: "NasserGT",
			platform: "Xbox",
		});
	});

	test("carries the avatar hash once the steam lookup has filled it", () => {
		expect(
			presenceOf({
				...ENTRY,
				avatarHash: "a".repeat(40),
			}).avatarHash,
		).toBe("a".repeat(40));
	});

	test("drops a field palworld did not report rather than sending it empty", () => {
		expect(
			presenceOf({
				...ENTRY,
				account: null,
				level: null,
				ping: null,
			}),
		).toEqual({
			player: "Meslzy",
			userId: "steam_1",
			platform: "Steam",
		});
	});

	test("drops an account palworld answered with as an empty string", () => {
		expect(
			presenceOf({
				...ENTRY,
				account: "",
			}),
		).not.toContainKey("account");
	});

	test("sends the whole-number ping the roster rounded, never the float palworld answered with", () => {
		const [player] = rosterOf({
			players: [
				{
					name: "Meslzy",
					userId: "steam_1",
					level: 34.0,
					ping: 21.866_666_793_823_242,
				},
			],
		});

		expect(player && presenceOf(player)).toMatchObject({
			level: "34",
			ping: "22",
		});
	});

	test("names the player by the id when palworld reports no name", () => {
		expect(
			presenceOf({
				...ENTRY,
				name: ENTRY.id,
			}).player,
		).toBe("steam_1");
	});
});
