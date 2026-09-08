import { describe, expect, test } from "bun:test";
import { RCON_PORT, REST_API_PORT } from "../shared";
import { needsAdminPassword, seedPatch } from "./seedSettings";

describe("deciding whether an install has to generate an admin password", () => {
	test("generates one when the settings carry no admin password", () => {
		expect(needsAdminPassword({})).toBe(true);
	});

	test("generates one when the shipped defaults left it empty", () => {
		expect(
			needsAdminPassword({
				AdminPassword: "",
			}),
		).toBe(true);
	});

	test("generates one when the codec read it back as null", () => {
		expect(
			needsAdminPassword({
				AdminPassword: null,
			}),
		).toBe(true);
	});

	test("keeps the password a player already set, so reinstalling never locks them out", () => {
		expect(
			needsAdminPassword({
				AdminPassword: "chosen-by-the-player",
			}),
		).toBe(false);
	});

	test("keeps a password made only of whitespace, because palworld accepts it as set", () => {
		expect(
			needsAdminPassword({
				AdminPassword: " ",
			}),
		).toBe(false);
	});

	test("keeps a numeric password the codec read back unquoted", () => {
		expect(
			needsAdminPassword({
				AdminPassword: 1234,
			}),
		).toBe(false);
	});
});

const GAME_PORT = 8241;

describe("building the settings patch an install writes", () => {
	test("always turns the rest api on and pins it to the port the driver talks to", () => {
		expect(seedPatch(GAME_PORT, null, false)).toEqual({
			PublicPort: GAME_PORT,
			RESTAPIEnabled: true,
			RESTAPIPort: REST_API_PORT,
			RCONEnabled: false,
			RCONPort: RCON_PORT,
		});
	});

	test("never overwrites an existing admin password", () => {
		expect(Object.keys(seedPatch(GAME_PORT, null, false))).not.toContain("AdminPassword");
	});

	test("writes the generated password alongside the rest api settings", () => {
		expect(seedPatch(GAME_PORT, "generated", false)).toEqual({
			PublicPort: GAME_PORT,
			RESTAPIEnabled: true,
			RESTAPIPort: REST_API_PORT,
			RCONEnabled: false,
			RCONPort: RCON_PORT,
			AdminPassword: "generated",
		});
	});

	test("still enables the rest api when it generates a password", () => {
		expect(seedPatch(GAME_PORT, "generated", false).RESTAPIEnabled).toBe(true);
	});

	test("advertises the host port the container mirrors, not the container port", () => {
		expect(seedPatch(GAME_PORT, null, false).PublicPort).toBe(GAME_PORT);
	});

	test("re-asserts the public port on every boot, so a migration to another host port follows", () => {
		expect(seedPatch(8300, null, false).PublicPort).toBe(8300);
	});

	test("keeps the public port apart from the rest api port the panel talks to", () => {
		expect(seedPatch(GAME_PORT, null, false).RESTAPIPort).toBe(REST_API_PORT);
	});

	test("opens rcon only while the panel exposes remote access, on its own port", () => {
		expect(seedPatch(GAME_PORT, null, true).RCONEnabled).toBe(true);
		expect(seedPatch(GAME_PORT, null, false).RCONEnabled).toBe(false);
		expect(seedPatch(GAME_PORT, null, true).RCONPort).toBe(RCON_PORT);
	});

	test("keeps the rcon port apart from the rest api and the game", () => {
		expect(RCON_PORT).not.toBe(REST_API_PORT);
		expect(RCON_PORT).not.toBe(GAME_PORT);
	});
});
