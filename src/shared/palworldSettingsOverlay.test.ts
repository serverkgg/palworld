import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { readInstallStamp, writeInstallStamp } from "./installStamp";
import { PalworldEdition } from "./palworldEdition";
import {
	appliedSettingKeys,
	clearPendingSettings,
	forgetPendingSettings,
	readPendingBaseline,
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
		variable() {
			return null;
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
		edition: PalworldEdition.Linux,
		mods: [],
		adminPasswordNext: null,
		settingsPending,
		settingsBaseline: null,
	});

	return context;
};

describe("reading the settings waiting for the next start", () => {
	it("reads nothing from a volume the installer never stamped", async () => {
		expect(await readPendingSettings(contextWith().context)).toEqual({});
	});

	it("reads nothing while no write is waiting", async () => {
		expect(await readPendingSettings(await stamped(null))).toEqual({});
	});

	it("reads back what the panel recorded", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
		});
	});

	it("reads nothing from a stamp whose pending map is corrupt", async () => {
		const { context } = contextWith({
			[INSTALL_STAMP_FILE]: '{"buildId": "1", "settingsPending": "ExpRate=3"}',
		});

		expect(await readPendingSettings(context)).toEqual({});
	});
});

describe("recording a settings write the game will overwrite on shutdown", () => {
	it("stores the values the way the ini codec writes them", async () => {
		const context = await stamped(null);

		await recordPendingSettings(
			context,
			{
				ExpRate: 3,
				bIsPvP: true,
				ServerName: "سيرفر الأصحاب",
				ServerPassword: null,
			},
			{},
		);

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
			bIsPvP: "true",
			ServerName: "سيرفر الأصحاب",
			ServerPassword: "",
		});
	});

	it("merges into what an earlier write left pending", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		await recordPendingSettings(
			context,
			{
				WorkSpeedRate: 2,
			},
			{},
		);

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
			WorkSpeedRate: "2",
		});
	});

	it("takes the newer value for a setting written twice", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		await recordPendingSettings(
			context,
			{
				ExpRate: 5000,
			},
			{},
		);

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "5000",
		});
	});

	it("leaves the build and the rotated password alone", async () => {
		const { context } = contextWith();

		await writeInstallStamp(context, {
			buildId: "4711",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: "rotated",
			settingsPending: null,
			settingsBaseline: null,
		});

		await recordPendingSettings(
			context,
			{
				ExpRate: 3,
			},
			{},
		);

		const stamp = await readInstallStamp(context);

		expect(stamp?.buildId).toBe("4711");
		expect(stamp?.adminPasswordNext).toBe("rotated");
	});

	it("keeps the write on a volume the installer never stamped, instead of losing it", async () => {
		const { context } = contextWith();

		await recordPendingSettings(
			context,
			{
				ExpRate: 3,
			},
			{},
		);

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
		});
	});

	it("writes no stamp for a write that carries nothing", async () => {
		const { context, stored } = contextWith();

		await recordPendingSettings(context, {}, {});

		expect(stored.has(INSTALL_STAMP_FILE)).toBe(false);
	});
});

describe("clearing the pending settings once they were replayed", () => {
	it("leaves nothing waiting for the start after next", async () => {
		const context = await stamped({
			ExpRate: "3",
		});

		await clearPendingSettings(context);

		expect(await readPendingSettings(context)).toEqual({});
	});

	it("keeps the rest of the stamp", async () => {
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

		await clearPendingSettings(context);

		expect(await readInstallStamp(context)).toEqual({
			buildId: "4711",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: "rotated",
			settingsPending: null,
			settingsBaseline: null,
		});
	});

	it("writes no stamp when there was nothing to clear", async () => {
		const { context, stored } = contextWith();

		await clearPendingSettings(context);

		expect(stored.has(INSTALL_STAMP_FILE)).toBe(false);
	});
});

describe("forgetting a pending write the owner has since made while the game was down", () => {
	it("drops only the keys that were written straight into the ini", async () => {
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

	it("empties the overlay entirely once the last key is gone", async () => {
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

		await forgetPendingSettings(context, [
			"ExpRate",
		]);

		expect(await readInstallStamp(context)).toEqual({
			buildId: "4711",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: "rotated",
			settingsPending: null,
			settingsBaseline: null,
		});
	});

	it("writes no stamp when none of the keys was waiting", async () => {
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

	it("writes no stamp at all on a volume the installer never stamped", async () => {
		const { context, stored } = contextWith();

		await forgetPendingSettings(context, [
			"ExpRate",
		]);

		expect(stored.has(INSTALL_STAMP_FILE)).toBe(false);
	});
});

describe("remembering what each pending setting was before the owner changed it", () => {
	it("keeps the first value a setting had across several writes", async () => {
		const context = await stamped(null);

		await recordPendingSettings(
			context,
			{
				ExpRate: 2,
			},
			{
				ExpRate: "1.000000",
			},
		);
		await recordPendingSettings(
			context,
			{
				ExpRate: 3,
			},
			{
				ExpRate: "2",
			},
		);

		expect(await readPendingBaseline(context)).toEqual({
			values: {
				ExpRate: "1.000000",
			},
			secrets: {},
		});
	});

	it("counts a key an older release left pending without a baseline as changed", async () => {
		const context = await stamped({
			ExpRate: "1",
		});

		await recordPendingSettings(
			context,
			{
				WorkSpeedRate: 1,
			},
			{
				ExpRate: "1",
				WorkSpeedRate: "1.000000",
			},
		);

		expect(appliedSettingKeys(await readPendingSettings(context), await readPendingBaseline(context))).toEqual([
			"ExpRate",
		]);
	});

	it("clears the baseline with the pending settings", async () => {
		const context = await stamped(null);

		await recordPendingSettings(
			context,
			{
				ExpRate: 2,
			},
			{
				ExpRate: "1",
			},
		);
		await clearPendingSettings(context);

		expect(await readPendingBaseline(context)).toBeNull();
	});

	it("drops the baseline of a key the owner wrote while the game was down", async () => {
		const context = await stamped(null);

		await recordPendingSettings(
			context,
			{
				ExpRate: 2,
				WorkSpeedRate: 2,
			},
			{
				ExpRate: "1",
				WorkSpeedRate: "1",
			},
		);
		await forgetPendingSettings(context, [
			"ExpRate",
		]);

		expect(await readPendingBaseline(context)).toEqual({
			values: {
				WorkSpeedRate: "1",
			},
			secrets: {},
		});
	});
});
