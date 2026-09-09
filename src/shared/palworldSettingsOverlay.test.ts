import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { readInstallStamp, writeInstallStamp } from "./installStamp";
import {
	clearPendingSettings,
	forgetPendingSettings,
	readPendingSettings,
	recordPendingSettings,
} from "./palworldSettingsOverlay";

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

const stamped = async (settingsPending: Record<string, string> | null) => {
	const { context } = contextWith();

	await writeInstallStamp(context, {
		buildId: "1",
		adminPasswordNext: null,
		settingsPending,
	});

	return context;
};

describe("reading the settings waiting for the next start", () => {
	test("reads nothing from a volume the installer never stamped", async () => {
		expect(await readPendingSettings(contextWith().context)).toEqual({});
	});

	test("reads nothing while no write is waiting", async () => {
		expect(await readPendingSettings(await stamped(null))).toEqual({});
	});

	test("reads back what the panel recorded", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
		});
	});

	test("reads nothing from a stamp whose pending map is corrupt", async () => {
		const { context } = contextWith({
			[INSTALL_STAMP_FILE]: '{"buildId": "1", "settingsPending": "ExpRate=3"}',
		});

		expect(await readPendingSettings(context)).toEqual({});
	});
});

describe("recording a settings write the game will overwrite on shutdown", () => {
	test("stores the values the way the ini codec writes them", async () => {
		const context = await stamped(null);

		await recordPendingSettings(context, {
			ExpRate: 3,
			bIsPvP: true,
			ServerName: "سيرفر الأصحاب",
			ServerPassword: null,
		});

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
			bIsPvP: "true",
			ServerName: "سيرفر الأصحاب",
			ServerPassword: "",
		});
	});

	test("merges into what an earlier write left pending", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		await recordPendingSettings(context, {
			WorkSpeedRate: 2,
		});

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
			WorkSpeedRate: "2",
		});
	});

	test("takes the newer value for a setting written twice", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		await recordPendingSettings(context, {
			ExpRate: 5000,
		});

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "5000",
		});
	});

	test("leaves the build and the rotated password alone", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "4711",
			adminPasswordNext: "rotated",
			settingsPending: null,
		});

		await recordPendingSettings(context, {
			ExpRate: 3,
		});

		const stamp = await readInstallStamp(context);

		expect(stamp?.buildId).toBe("4711");
		expect(stamp?.adminPasswordNext).toBe("rotated");
	});

	test("keeps the write on a volume the installer never stamped, instead of losing it", async () => {
		const { context } = contextWith();

		await recordPendingSettings(context, {
			ExpRate: 3,
		});

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
		});
	});

	test("writes no stamp for a write that carries nothing", async () => {
		const { context, stored } = contextWith();

		await recordPendingSettings(context, {});

		expect(stored.has(INSTALL_STAMP_FILE)).toBe(false);
	});
});

describe("clearing the pending settings once they were replayed", () => {
	test("leaves nothing waiting for the start after next", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		await clearPendingSettings(context);

		expect(await readPendingSettings(context)).toEqual({});
	});

	test("keeps the rest of the stamp", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "4711",
			adminPasswordNext: "rotated",
			settingsPending: {
				ExpRate: "3",
			},
		});

		await clearPendingSettings(context);

		expect(await readInstallStamp(context)).toEqual({
			buildId: "4711",
			adminPasswordNext: "rotated",
			settingsPending: null,
		});
	});

	test("writes no stamp when there was nothing to clear", async () => {
		const { context, stored } = contextWith();

		await clearPendingSettings(context);

		expect(stored.has(INSTALL_STAMP_FILE)).toBe(false);
	});
});

describe("forgetting a pending write the owner has since made while the game was down", () => {
	test("drops only the keys that were written straight into the ini", async () => {
		const context = await stamped({
			ExpRate: "3",
			WorkSpeedRate: "2",
		});

		await forgetPendingSettings(context, [
			"ExpRate",
		]);

		expect(await readPendingSettings(context)).toEqual({
			WorkSpeedRate: "2",
		});
	});

	test("empties the overlay entirely once the last key is gone", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "4711",
			adminPasswordNext: "rotated",
			settingsPending: {
				ExpRate: "3",
			},
		});

		await forgetPendingSettings(context, [
			"ExpRate",
		]);

		expect(await readInstallStamp(context)).toEqual({
			buildId: "4711",
			adminPasswordNext: "rotated",
			settingsPending: null,
		});
	});

	test("writes no stamp when none of the keys was waiting", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		await forgetPendingSettings(context, [
			"WorkSpeedRate",
		]);

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
		});
	});

	test("writes no stamp at all on a volume the installer never stamped", async () => {
		const { context, stored } = contextWith();

		await forgetPendingSettings(context, [
			"ExpRate",
		]);

		expect(stored.has(INSTALL_STAMP_FILE)).toBe(false);
	});
});
