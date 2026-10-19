import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { readInstallStamp, stampOf, writeInstallStamp } from "./installStamp";
import { PalworldEdition } from "./palworldEdition";

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
	it("reads a stamp the installer wrote", () => {
		expect(
			stampOf({
				buildId: "18234567",
				edition: PalworldEdition.Linux,
				mods: [],
			}),
		).toEqual({
			buildId: "18234567",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: null,
			settingsPending: null,
			settingsBaseline: null,
		});
	});

	it("treats a missing stamp file as no stamp", () => {
		expect(stampOf(null)).toBeNull();
	});

	it("reads a stamp written before the build was known, so a rotation still has somewhere to live", () => {
		expect(stampOf({})?.buildId).toBeNull();
	});

	it("reads a build id that is not a string as unknown", () => {
		for (const raw of [
			'{"buildId": 18234567}',
			'{"buildId": null}',
			'{"buildId": ["18234567"]}',
		]) {
			expect(stampOf(JSON.parse(raw) as Record<string, unknown>)?.buildId).toBeNull();
		}
	});

	it("reads the admin password waiting for the next restart", () => {
		expect(
			stampOf({
				buildId: "1",
				edition: PalworldEdition.Linux,
				mods: [],
				adminPasswordNext: "rotated",
			})?.adminPasswordNext,
		).toBe("rotated");
	});

	it("reads the settings waiting for the next start", () => {
		expect(
			stampOf({
				buildId: "1",
				edition: PalworldEdition.Linux,
				mods: [],
				settingsPending: {
					ExpRate: "3",
					ServerName: "سيرفر الأصحاب",
				},
				settingsBaseline: null,
			})?.settingsPending,
		).toEqual({
			ExpRate: "3",
			ServerName: "سيرفر الأصحاب",
		});
	});

	it("keeps only the string values a corrupt stamp still carries", () => {
		expect(
			stampOf({
				settingsPending: {
					ExpRate: "3",
					PalCaptureRate: 2,
					ServerName: null,
				},
				settingsBaseline: null,
			})?.settingsPending,
		).toEqual({
			ExpRate: "3",
		});
	});

	it("reads a pending map that is not an object of settings as nothing pending", () => {
		for (const raw of [
			{},
			{
				settingsPending: null,
				settingsBaseline: null,
			},
			{
				settingsPending: {},
				settingsBaseline: null,
			},
			{
				settingsPending: [
					"ExpRate",
				],
			},
			{
				settingsPending: "ExpRate=3",
				settingsBaseline: null,
			},
		]) {
			expect(stampOf(raw)?.settingsPending).toBeNull();
		}
	});

	it("reads an empty or malformed pending password as none", () => {
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
	it("reads back exactly what was written", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "4711",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: "rotated",
			settingsPending: {
				ExpRate: "3",
			},
			settingsBaseline: null,
		});

		expect(await readInstallStamp(context)).toEqual({
			buildId: "4711",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: "rotated",
			settingsPending: {
				ExpRate: "3",
			},
			settingsBaseline: null,
		});
	});

	it("reads no stamp from an empty volume", async () => {
		expect(await readInstallStamp(contextWith().context)).toBeNull();
	});

	it("writes the file the manifest protects", async () => {
		const { context, stored } = contextWith();

		await writeInstallStamp(context, {
			buildId: "1",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: null,
			settingsPending: null,
			settingsBaseline: null,
		});

		expect(stored.has(INSTALL_STAMP_FILE)).toBe(true);
	});
});
