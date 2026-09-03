import { describe, expect, test } from "bun:test";
import { parseStamp } from "./installStamp";

describe("reading the stamp that records which steam build was installed", () => {
	test("reads a stamp the installer wrote", () => {
		expect(parseStamp('{\n  "buildId": "18234567"\n}\n')).toEqual({
			buildId: "18234567",
		});
	});

	test("keeps any extra fields a newer installer added", () => {
		const stamp = parseStamp(
			JSON.stringify({
				buildId: "18234567",
				installedAt: "2026-09-03T12:00:00.000Z",
			}),
		);

		expect(stamp?.buildId).toBe("18234567");
		expect(Object.keys(stamp ?? {})).toEqual([
			"buildId",
			"installedAt",
		]);
	});

	test("treats a truncated stamp as no stamp instead of throwing", () => {
		expect(parseStamp('{"buildId": "182345')).toBeNull();
	});

	test("treats an empty file as no stamp", () => {
		expect(parseStamp("")).toBeNull();
	});

	test("rejects a stamp whose build id is not a string", () => {
		expect(
			parseStamp(
				JSON.stringify({
					buildId: 18_234_567,
				}),
			),
		).toBeNull();
	});

	test("rejects a stamp with no build id at all", () => {
		expect(parseStamp("{}")).toBeNull();
	});

	test("rejects json that is not an object", () => {
		for (const raw of [
			"null",
			"42",
			'"18234567"',
			"[]",
		]) {
			expect(parseStamp(raw)).toBeNull();
		}
	});
});
