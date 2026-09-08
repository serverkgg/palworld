import { describe, expect, test } from "bun:test";
import { presenceOf } from "./palworldRoster";

const ENTRY = {
	id: "steam_1",
	level: 42,
	name: "Meslzy",
	ping: 31,
};

describe("sending the player data serverk.yml promises", () => {
	test("carries the name, the stable id and every declared field", () => {
		expect(presenceOf(ENTRY)).toEqual({
			level: "42",
			ping: "31",
			player: "Meslzy",
			userId: "steam_1",
		});
	});

	test("drops a field palworld did not report rather than sending it empty", () => {
		expect(
			presenceOf({
				...ENTRY,
				level: null,
				ping: null,
			}),
		).toEqual({
			player: "Meslzy",
			userId: "steam_1",
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
