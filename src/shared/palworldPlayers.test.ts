import { describe, expect, test } from "bun:test";
import { rosterOf } from "./palworldPlayers";

describe("turning the palworld player list into panel rows", () => {
	test("keeps a fully described player as-is", () => {
		const [player] = rosterOf({
			players: [
				{
					name: "Meslzy",
					accountName: "meslzy",
					userId: "steam_76561198000000001",
					playerId: "1A2B3C4D",
					level: 42,
					ping: 31,
					building_count: 7,
				},
			],
		});

		expect(player).toEqual({
			id: "steam_76561198000000001",
			name: "Meslzy",
			account: "meslzy",
			platform: "Steam",
			level: 42,
			ping: 31,
			buildings: 7,
			avatarHash: null,
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
				account: null,
				platform: "Steam",
				level: null,
				ping: null,
				buildings: null,
				avatarHash: null,
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

	test("reports a missing level, ping, account or building count as null rather than zero", () => {
		const [player] = rosterOf({
			players: [
				{
					userId: "steam_1",
				},
			],
		});

		expect(player?.level).toBeNull();
		expect(player?.ping).toBeNull();
		expect(player?.account).toBeNull();
		expect(player?.buildings).toBeNull();
	});

	test("rounds the float ping palworld answers with, so the panel never shows 21.866666793823242", () => {
		const [player] = rosterOf({
			players: [
				{
					userId: "steam_1",
					level: 34.0,
					ping: 21.866_666_793_823_242,
				},
			],
		});

		expect(player?.ping).toBe(22);
		expect(player?.level).toBe(34);
	});

	test("cuts a fractional level or building count down to the whole number the game means", () => {
		const [player] = rosterOf({
			players: [
				{
					userId: "steam_1",
					level: 34.9,
					building_count: 7.6,
				},
			],
		});

		expect(player?.level).toBe(34);
		expect(player?.buildings).toBe(7);
	});

	test("reports a number the server could not measure as null rather than passing it on", () => {
		const [player] = rosterOf({
			players: [
				{
					userId: "steam_1",
					level: Number.NaN,
					ping: Number.POSITIVE_INFINITY,
					building_count: Number.NEGATIVE_INFINITY,
				},
			],
		});

		expect(player?.level).toBeNull();
		expect(player?.ping).toBeNull();
		expect(player?.buildings).toBeNull();
	});

	test("keeps a real zero building count instead of nulling it", () => {
		expect(
			rosterOf({
				players: [
					{
						userId: "steam_1",
						building_count: 0,
					},
				],
			}).at(0)?.buildings,
		).toBe(0);
	});

	test("names the store the player came in from, so the owner knows who to look for", () => {
		expect(
			rosterOf({
				players: [
					{
						userId: "steam_1",
					},
					{
						userId: "gdk_1",
					},
					{
						playerId: "1A2B3C4D",
					},
				],
			}).map((player) => player.platform),
		).toEqual([
			"Steam",
			"Xbox",
			"1A2B3C4D",
		]);
	});

	test("leaves the avatar empty until the steam lookup fills it", () => {
		expect(
			rosterOf({
				players: [
					{
						userId: "steam_1",
					},
				],
			}).at(0)?.avatarHash,
		).toBeNull();
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
