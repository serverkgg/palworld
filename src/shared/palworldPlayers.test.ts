import { describe, expect, test } from "bun:test";
import { rosterOf } from "./palworldPlayers";

describe("turning the palworld player list into panel rows", () => {
	test("keeps a fully described player as-is", () => {
		const [player] = rosterOf({
			players: [
				{
					name: "Meslzy",
					userId: "steam_76561198000000001",
					playerId: "1A2B3C4D",
					level: 42,
					ping: 31,
				},
			],
		});

		expect(player).toEqual({
			id: "steam_76561198000000001",
			name: "Meslzy",
			level: 42,
			ping: 31,
		});
	});

	test("prefers the steam user id over the per-world player id", () => {
		expect(
			rosterOf({
				players: [
					{
						name: "Meslzy",
						userId: "steam_76561198000000001",
						playerId: "1A2B3C4D",
					},
				],
			}).at(0)?.id,
		).toBe("steam_76561198000000001");
	});

	test("falls back to the player id when the server sends no user id", () => {
		expect(
			rosterOf({
				players: [
					{
						name: "Meslzy",
						playerId: "1A2B3C4D",
					},
				],
			}).at(0)?.id,
		).toBe("1A2B3C4D");
	});

	test("drops a player the server could not identify, so kick and ban never target the wrong row", () => {
		expect(
			rosterOf({
				players: [
					{
						name: "Ghost",
					},
					{
						name: "Empty",
						userId: "",
						playerId: "",
					},
					{
						name: "Real",
						userId: "steam_1",
					},
				],
			}),
		).toEqual([
			{
				id: "steam_1",
				name: "Real",
				level: null,
				ping: null,
			},
		]);
	});

	test("shows the id as the name when the player has none", () => {
		expect(
			rosterOf({
				players: [
					{
						userId: "steam_1",
					},
				],
			}).at(0)?.name,
		).toBe("steam_1");
	});

	test("reports a missing level or ping as null rather than zero", () => {
		const [player] = rosterOf({
			players: [
				{
					userId: "steam_1",
				},
			],
		});

		expect(player?.level).toBeNull();
		expect(player?.ping).toBeNull();
	});

	test("keeps a real zero ping instead of nulling it", () => {
		expect(
			rosterOf({
				players: [
					{
						userId: "steam_1",
						level: 0,
						ping: 0,
					},
				],
			}).at(0),
		).toMatchObject({
			level: 0,
			ping: 0,
		});
	});

	test("returns an empty roster when nobody is online", () => {
		expect(
			rosterOf({
				players: [],
			}),
		).toEqual([]);
	});

	test("returns an empty roster when the server omits the players field entirely", () => {
		expect(rosterOf({})).toEqual([]);
	});

	test("keeps every identified player in the order the server sent them", () => {
		expect(
			rosterOf({
				players: [
					{
						userId: "steam_1",
					},
					{
						userId: "steam_2",
					},
					{
						userId: "steam_3",
					},
				],
			}).map((player) => player.id),
		).toEqual([
			"steam_1",
			"steam_2",
			"steam_3",
		]);
	});
});
