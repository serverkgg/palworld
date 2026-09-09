import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { lifecycle } from "../lifecycle";
import { readPendingSettings, writeInstallStamp } from "../shared";
import { settings } from "./settings";

interface Harness {
	context: Bridge.Context;
	ini: Bridge.Values;
	server: {
		running: boolean;
	};
}

const harness = (options: { running: boolean; ini?: Bridge.Values }): Harness => {
	const stored = new Map<string, string>();
	const ini: Bridge.Values = {
		...options.ini,
	};
	const server = {
		running: options.running,
	};

	const context = {
		server,
		variable() {
			return null;
		},
		port() {
			return 8211;
		},
		log() {},
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
	};
};

const stamped = async (context: Bridge.Context) => {
	await writeInstallStamp(context, {
		buildId: "1",
		adminPasswordNext: null,
		settingsPending: null,
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
