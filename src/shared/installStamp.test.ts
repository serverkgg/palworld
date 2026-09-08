import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { readInstallStamp, stampOf, writeInstallStamp } from "./installStamp";

const contextWith = (seed: Record<string, string> = {}) => {
	const stored = new Map(Object.entries(seed));

	const context = {
		files: {
			async exists(path: string) {
				return stored.has(path);
			},
			async read(path: string) {
				return stored.get(path) ?? "";
			},
			async write(path: string, content: string) {
				stored.set(path, content);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		stored,
	};
};

describe("reading the stamp that records which steam build was installed", () => {
	test("reads a stamp the installer wrote", () => {
		expect(
			stampOf({
				buildId: "18234567",
			}),
		).toEqual({
			buildId: "18234567",
			adminPasswordNext: null,
		});
	});

	test("treats a missing stamp file as no stamp", () => {
		expect(stampOf(null)).toBeNull();
	});

	test("reads a stamp written before the build was known, so a rotation still has somewhere to live", () => {
		expect(stampOf({})?.buildId).toBeNull();
	});

	test("reads a build id that is not a string as unknown", () => {
		for (const raw of [
			'{"buildId": 18234567}',
			'{"buildId": null}',
			'{"buildId": ["18234567"]}',
		]) {
			expect(stampOf(JSON.parse(raw) as Record<string, unknown>)?.buildId).toBeNull();
		}
	});

	test("reads the admin password waiting for the next restart", () => {
		expect(
			stampOf({
				buildId: "1",
				adminPasswordNext: "rotated",
			})?.adminPasswordNext,
		).toBe("rotated");
	});

	test("reads an empty or malformed pending password as none", () => {
		for (const raw of [
			{},
			{
				adminPasswordNext: "",
			},
			{
				adminPasswordNext: 1234,
			},
			{
				adminPasswordNext: null,
			},
		]) {
			expect(stampOf(raw)?.adminPasswordNext).toBeNull();
		}
	});
});

describe("round-tripping the stamp through the volume", () => {
	test("reads back exactly what was written", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "4711",
			adminPasswordNext: "rotated",
		});

		expect(await readInstallStamp(context)).toEqual({
			buildId: "4711",
			adminPasswordNext: "rotated",
		});
	});

	test("reads no stamp from an empty volume", async () => {
		expect(await readInstallStamp(contextWith().context)).toBeNull();
	});

	test("writes the file the manifest protects", async () => {
		const { context, stored } = contextWith();

		await writeInstallStamp(context, {
			buildId: "1",
			adminPasswordNext: null,
		});

		expect(stored.has(INSTALL_STAMP_FILE)).toBe(true);
	});
});
