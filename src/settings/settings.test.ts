import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { lifecycle } from "../lifecycle";
import { readPendingSettings, writeInstallStamp } from "../shared";
import { settings } from "./settings";

interface Harness {
	context: Bridge.Context;
	ini: Bridge.Values;
	server: {
		running: boolean;
	};
	stored: Map<string, string>;
	reported: Bridge.Activity[];
}

const harness = (options: { running: boolean; ini?: Bridge.Values }): Harness => {
	const stored = new Map<string, string>();
	const ini: Bridge.Values = {
		...options.ini,
	};
	const server = {
		running: options.running,
	};
	const reported: Bridge.Activity[] = [];

	const context = {
		server,
		variable() {
			return null;
		},
		port() {
			return 8211;
		},
		log() {},
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
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
		codec: {
			ueIni: {
				async read() {
					return ini;
				},
				async merge(_path: string, values: Bridge.Values) {
					for (const [key, value] of Object.entries(values)) {
						ini[key] = value === null ? "" : String(value);
					}
				},
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		ini,
		server,
		stored,
		reported,
	};
};

const stamped = async (context: Bridge.Context) => {
	await writeInstallStamp(context, {
		buildId: "1",
		adminPasswordNext: null,
		settingsPending: null,
		settingsBaseline: null,
	});
};

describe("writing a setting while the game is running", () => {
	test("writes it into the ini the game reads at its next start", async () => {
		const { context, ini } = harness({
			running: true,
		});

		await stamped(context);
		await settings.write?.(context, {
			ExpRate: 3,
		});

		expect(ini.ExpRate).toBe("3");
	});

	test("keeps it pending too, because the game rewrites the ini when it shuts down", async () => {
		const { context } = harness({
			running: true,
		});

		await stamped(context);
		await settings.write?.(context, {
			ExpRate: 3,
		});

		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
		});
	});

	test("keeps the folded crossplay key pending, not the three toggles the panel shows", async () => {
		const { context } = harness({
			running: true,
			ini: {
				CrossplayPlatforms: "(Steam,Xbox,PS5,Mac)",
			},
		});

		await stamped(context);
		await settings.write?.(context, {
			CrossplayPS5: false,
		});

		expect(await readPendingSettings(context)).toEqual({
			CrossplayPlatforms: "(Steam,Xbox,Mac)",
		});
	});

	test("refuses a value outside the field before anything is recorded", async () => {
		const { context, ini } = harness({
			running: true,
		});

		await stamped(context);
		await expect(
			settings.write?.(context, {
				ServerPlayerMaxNum: 64,
			}),
		).rejects.toThrow();

		expect(ini.ServerPlayerMaxNum).toBeUndefined();
		expect(await readPendingSettings(context)).toEqual({});
	});
});

describe("writing a setting while the game is stopped", () => {
	test("writes it into the ini, which nothing is going to overwrite", async () => {
		const { context, ini } = harness({
			running: false,
		});

		await stamped(context);
		await settings.write?.(context, {
			ExpRate: 3,
		});

		expect(ini.ExpRate).toBe("3");
	});

	test("records nothing, because the ini is the truth while the game is down", async () => {
		const { context } = harness({
			running: false,
		});

		await stamped(context);
		await settings.write?.(context, {
			ExpRate: 3,
		});

		expect(await readPendingSettings(context)).toEqual({});
	});

	test("drops the older running write, so the next start does not replay it over this one", async () => {
		const { context, ini, server } = harness({
			running: true,
			ini: {
				ExpRate: "1.000000",
			},
		});

		await stamped(context);
		await settings.write?.(context, {
			ExpRate: 3,
		});

		server.running = false;

		await settings.write?.(context, {
			ExpRate: 5,
		});
		await lifecycle.command(context);

		expect(ini.ExpRate).toBe("5");
		expect(await readPendingSettings(context)).toEqual({});
	});

	test("leaves the other keys pending, because only the written ones are now in the ini", async () => {
		const { context, server } = harness({
			running: true,
		});

		await stamped(context);
		await settings.write?.(context, {
			ExpRate: 3,
			WorkSpeedRate: 2,
		});

		server.running = false;

		await settings.write?.(context, {
			ExpRate: 5,
		});

		expect(await readPendingSettings(context)).toEqual({
			WorkSpeedRate: "2",
		});
	});
});

describe("changing crossplay twice across the game's own shutdown rewrite", () => {
	test("folds the second toggle onto the pending tuple, never onto the ini the game rewrote", async () => {
		const { context, ini } = harness({
			running: true,
			ini: {
				CrossplayPlatforms: "(Steam,Xbox,PS5,Mac)",
			},
		});

		await stamped(context);
		await settings.write?.(context, {
			CrossplayPS5: false,
		});

		ini.CrossplayPlatforms = "(Steam,Xbox,PS5,Mac)";

		await settings.write?.(context, {
			CrossplayMac: false,
		});

		expect(await readPendingSettings(context)).toEqual({
			CrossplayPlatforms: "(Steam,Xbox)",
		});
		expect(await settings.read(context)).toMatchObject({
			CrossplayXbox: true,
			CrossplayPS5: false,
			CrossplayMac: false,
		});
	});
});

describe("reading the settings the panel shows", () => {
	test("shows what the ini says while nothing is pending", async () => {
		const { context } = harness({
			running: false,
			ini: {
				ExpRate: "1.000000",
			},
		});

		expect((await settings.read(context)).ExpRate).toBe("1.000000");
	});

	test("shows the owner his own value after the game rewrote the ini on shutdown", async () => {
		const { context, ini } = harness({
			running: true,
			ini: {
				ExpRate: "1.000000",
			},
		});

		await stamped(context);
		await settings.write?.(context, {
			ExpRate: 3,
		});

		ini.ExpRate = "1.000000";

		expect((await settings.read(context)).ExpRate).toBe("3");
	});

	test("splits the pending crossplay platforms back into the three toggles", async () => {
		const { context, ini } = harness({
			running: true,
			ini: {
				CrossplayPlatforms: "(Steam,Xbox,PS5,Mac)",
			},
		});

		await stamped(context);
		await settings.write?.(context, {
			CrossplayPS5: false,
		});

		ini.CrossplayPlatforms = "(Steam,Xbox,PS5,Mac)";

		expect(await settings.read(context)).toMatchObject({
			CrossplayXbox: true,
			CrossplayPS5: false,
			CrossplayMac: true,
		});
	});
});

const DEV_INI: Bridge.Values = {
	ServerName: "old name",
	ExpRate: "1.000000",
	PalCaptureRate: "1.000000",
	bIsPvP: "False",
	ServerPlayerMaxNum: "32",
};

const shutdown = (harnessed: Harness, ini: Bridge.Values) => {
	Object.assign(harnessed.ini, ini);
	harnessed.server.running = false;
};

const appliedKeys = (reported: Bridge.Activity[]) => {
	return reported.filter((entry) => entry.name === BridgeEventName.SettingsApplied).map((entry) => entry.details?.keys);
};

describe("telling the owner which settings a restart applied", () => {
	test("reports the keys a running write changed once the restart applies them", async () => {
		const harnessed = harness({
			running: true,
			ini: DEV_INI,
		});

		await stamped(harnessed.context);
		await settings.write?.(harnessed.context, {
			ServerName: "new name",
			ExpRate: 1,
			PalCaptureRate: 2,
			bIsPvP: false,
			ServerPlayerMaxNum: 32,
		});

		shutdown(harnessed, DEV_INI);

		await lifecycle.command(harnessed.context);

		expect(harnessed.ini.ServerName).toBe("new name");
		expect(harnessed.ini.PalCaptureRate).toBe("2");
		expect(harnessed.reported).toEqual([
			{
				name: BridgeEventName.SettingsApplied,
				text: expect.any(Object),
				details: {
					keys: "ServerName,PalCaptureRate",
					count: 2,
				},
			},
		]);
	});

	test("reports nothing when the running write changed no value", async () => {
		const harnessed = harness({
			running: true,
			ini: DEV_INI,
		});

		await stamped(harnessed.context);
		await settings.write?.(harnessed.context, {
			ExpRate: 1,
			bIsPvP: false,
		});

		shutdown(harnessed, DEV_INI);

		await lifecycle.command(harnessed.context);

		expect(await readPendingSettings(harnessed.context)).toEqual({});
		expect(harnessed.reported).toEqual([]);
	});

	test("reports nothing for a value changed and changed back before the restart", async () => {
		const harnessed = harness({
			running: true,
			ini: DEV_INI,
		});

		await stamped(harnessed.context);
		await settings.write?.(harnessed.context, {
			ServerName: "new name",
		});
		await settings.write?.(harnessed.context, {
			ServerName: "old name",
		});

		shutdown(harnessed, DEV_INI);

		await lifecycle.command(harnessed.context);

		expect(harnessed.reported).toEqual([]);
	});

	test("compares two saves before one restart against the value the game started with", async () => {
		const harnessed = harness({
			running: true,
			ini: DEV_INI,
		});

		await stamped(harnessed.context);
		await settings.write?.(harnessed.context, {
			PalCaptureRate: 2,
		});
		await settings.write?.(harnessed.context, {
			PalCaptureRate: 3,
			ServerName: "old name",
		});

		shutdown(harnessed, DEV_INI);

		await lifecycle.command(harnessed.context);

		expect(appliedKeys(harnessed.reported)).toEqual([
			"PalCaptureRate",
		]);
	});

	test("reports every pending key from a stamp an older release wrote without a baseline", async () => {
		const harnessed = harness({
			running: false,
			ini: DEV_INI,
		});

		harnessed.stored.set(
			INSTALL_STAMP_FILE,
			JSON.stringify({
				buildId: "1",
				adminPasswordNext: null,
				settingsPending: {
					ExpRate: "1",
					ServerName: "new name",
				},
			}),
		);

		await lifecycle.command(harnessed.context);

		expect(harnessed.ini.ServerName).toBe("new name");
		expect(appliedKeys(harnessed.reported)).toEqual([
			"ExpRate,ServerName",
		]);
		expect(await readPendingSettings(harnessed.context)).toEqual({});
	});

	test("starts even when the stored baseline is corrupt, and treats every key as changed", async () => {
		const harnessed = harness({
			running: false,
			ini: DEV_INI,
		});

		harnessed.stored.set(
			INSTALL_STAMP_FILE,
			JSON.stringify({
				buildId: "1",
				settingsPending: {
					ExpRate: "2",
				},
				settingsBaseline: "not a baseline",
			}),
		);

		expect((await lifecycle.command(harnessed.context))[0]).toBe("./PalServer.sh");
		expect(appliedKeys(harnessed.reported)).toEqual([
			"ExpRate",
		]);
	});

	test("reports nothing when nothing is pending", async () => {
		const harnessed = harness({
			running: false,
			ini: DEV_INI,
		});

		await stamped(harnessed.context);
		await lifecycle.command(harnessed.context);

		expect(harnessed.reported).toEqual([]);
	});

	test("keeps a password's value out of the stored baseline and out of the report", async () => {
		const harnessed = harness({
			running: true,
			ini: {
				...DEV_INI,
				ServerPassword: "first-s3cret",
				AdminPassword: "admin-s3cret",
			},
		});

		await stamped(harnessed.context);
		await settings.write?.(harnessed.context, {
			ServerPassword: "second-s3cret",
			AdminPassword: "admin-s3cret",
		});

		const stamp = JSON.parse(harnessed.stored.get(INSTALL_STAMP_FILE) ?? "{}");

		expect(stamp.settingsBaseline).toEqual({
			values: {},
			secrets: {
				ServerPassword: true,
				AdminPassword: false,
			},
		});

		shutdown(harnessed, {
			ServerPassword: "first-s3cret",
		});

		await lifecycle.command(harnessed.context);

		expect(appliedKeys(harnessed.reported)).toEqual([
			"ServerPassword",
		]);
		expect(JSON.stringify(harnessed.reported)).not.toContain("s3cret");
	});
});
