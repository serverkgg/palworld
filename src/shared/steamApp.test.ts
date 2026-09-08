import { describe, expect, test } from "bun:test";
import { SERVER_READY, STEAM_APP_ID } from "./steamApp";

describe("knowing when the palworld server has finished booting", () => {
	test("matches the minidump line the dedicated server prints once it is up", () => {
		expect(SERVER_READY.test(`[2026.09.03-12.00.00:000][  0]Setting breakpad minidump AppID = ${STEAM_APP_ID}`)).toBe(
			true,
		);
	});

	test("does not match another game's minidump line", () => {
		expect(SERVER_READY.test("Setting breakpad minidump AppID = 730")).toBe(false);
	});

	test("does not match ordinary start-up chatter", () => {
		expect(SERVER_READY.test("[2026.09.03-12.00.00:000][  0]LogInit: Display: Starting Game.")).toBe(false);
	});
});
