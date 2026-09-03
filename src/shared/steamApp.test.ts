import { describe, expect, test } from "bun:test";
import { buildIdOf, SERVER_READY, STEAM_APP_ID } from "./steamApp";

const MANIFEST = `"AppState"
{
	"appid"		"${STEAM_APP_ID}"
	"Universe"		"1"
	"name"		"Palworld Dedicated Server"
	"StateFlags"		"4"
	"installdir"		"PalServer"
	"LastUpdated"		"1756800000"
	"buildid"		"18234567"
	"LastOwner"		"0"
}
`;

describe("reading the steam build the server is on", () => {
	test("finds the build id inside a real app manifest", () => {
		expect(buildIdOf(MANIFEST)).toBe("18234567");
	});

	test("does not mistake the app id or the timestamp for the build", () => {
		expect(buildIdOf(MANIFEST)).not.toBe(STEAM_APP_ID);
		expect(buildIdOf(MANIFEST)).not.toBe("1756800000");
	});

	test("reads a manifest that separates the key and value with spaces", () => {
		expect(buildIdOf('  "buildid"   "99"')).toBe("99");
	});

	test("reports no build when the manifest has no buildid line", () => {
		expect(buildIdOf('"AppState"\n{\n\t"appid"\t\t"2394010"\n}\n')).toBeNull();
	});

	test("reports no build for an empty or truncated manifest", () => {
		expect(buildIdOf("")).toBeNull();
		expect(buildIdOf('"buildid"')).toBeNull();
	});

	test("ignores a build id that is not a number", () => {
		expect(buildIdOf('"buildid"		"latest"')).toBeNull();
	});
});

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
