import { describe, expect, it } from "bun:test";
import { SERVER_READY, STEAM_APP_ID } from "./steamApp";

describe("knowing when the palworld server has finished booting", () => {
	it("matches the minidump line the dedicated server prints once it is up", () => {
		expect(SERVER_READY.test(`[2026.09.03-12.00.00:000][  0]Setting breakpad minidump AppID = ${STEAM_APP_ID}`)).toBe(
			true,
		);
	});

	it("does not match another game's minidump line", () => {
		expect(SERVER_READY.test("Setting breakpad minidump AppID = 730")).toBe(false);
	});

	it("does not match ordinary start-up chatter", () => {
		expect(SERVER_READY.test("[2026.09.03-12.00.00:000][  0]LogInit: Display: Starting Game.")).toBe(false);
	});
});
