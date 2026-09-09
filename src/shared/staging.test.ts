import { describe, expect, test } from "bun:test";
import { relativeUploadPath, STAGING_ROOT } from "./staging";

describe("the path an upload is allowed to land on", () => {
	test("keeps a path inside the staging folder", () => {
		expect(relativeUploadPath(`${STAGING_ROOT}/ue4ss-mod-upload/pack`)).toBe(`${STAGING_ROOT}/ue4ss-mod-upload/pack`);
	});

	test("trims what the caller sent and drops the noise segments", () => {
		expect(relativeUploadPath("  ./Mods//AdminCommands  ")).toBe("Mods/AdminCommands");
	});

	test("refuses anything that leaves the volume", () => {
		for (const input of [
			"",
			"   ",
			"/etc/passwd",
			"../../etc/passwd",
			"Mods/../../etc",
			".",
		]) {
			expect(relativeUploadPath(input)).toBeNull();
		}
	});
});
