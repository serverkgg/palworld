import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { readPendingSettings, writeInstallStamp } from "../shared";
import { lifecycle } from "./lifecycle";

const GAME_PORT = 8241;

interface Harness {
	context: Bridge.Context;
	ini: Bridge.Values;
	logged: string[];
	reported: Bridge.Activity[];
}

const harness = (ini: Bridge.Values = {}): Harness => {
	const stored = new Map<string, string>();
	const settings: Bridge.Values = {
		...ini,
	};
	const logged: string[] = [];
	const reported: Bridge.Activity[] = [];

	const context = {
		variable() {
			return null;
		},
		port() {
			return GAME_PORT;
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
					return settings;
				},
				async merge(_path: string, values: Bridge.Values) {
					for (const [key, value] of Object.entries(values)) {
						settings[key] = value === null ? "" : String(value);
					}
				},
			},
		},
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
		log(message: string) {
			logged.push(message);
		},
	} as unknown as Bridge.Context;

	return {
		context,
		ini: settings,
		logged,
		reported,
	};
};

const pending = async (context: Bridge.Context, settingsPending: Record<string, string> | null) => {
	await writeInstallStamp(context, {
		buildId: "1",
		adminPasswordNext: null,
		settingsPending,
		settingsBaseline: null,
	});
};

describe("the command that starts the game", () => {
	test("starts the shipped script on the port the panel published", async () => {
		const command = await lifecycle.command(harness().context);

		expect(command[0]).toBe("./PalServer.sh");
		expect(command).toContain(`-port=${GAME_PORT}`);
	});

	test("keeps every flag the server needs", async () => {
		const command = await lifecycle.command(harness().context);

		for (const flag of [
			"-useperfthreads",
			"-NoAsyncLoadingThread",
			"-UseMultithreadForDS",
		]) {
			expect(command).toContain(flag);
		}
	});
});

describe("replaying the settings the game overwrote on its last shutdown", () => {
	test("writes them back into the ini before the game reads it", async () => {
		const { context, ini } = harness({
			ExpRate: "1.000000",
		});

		await pending(context, {
			ExpRate: "3",
			ServerName: "سيرفر الأصحاب",
		});

		await lifecycle.command(context);

		expect(ini.ExpRate).toBe("3");
		expect(ini.ServerName).toBe("سيرفر الأصحاب");
	});

	test("clears them, so the next start does not fight a later write", async () => {
		const { context } = harness();

		await pending(context, {
			ExpRate: "3",
		});

		await lifecycle.command(context);

		expect(await readPendingSettings(context)).toEqual({});
	});

	test("says how many settings it replayed", async () => {
		const { context, logged } = harness();

		await pending(context, {
			ExpRate: "3",
			WorkSpeedRate: "2",
		});

		await lifecycle.command(context);

		expect(logged).toContain("replayed the settings the game overwrote on its last shutdown");
	});

	test("tells the owner which settings landed from a pending record with no baseline, by name and never by value", async () => {
		const { context, reported } = harness();

		await pending(context, {
			ExpRate: "3",
			ServerPassword: "hunter22",
			AdminPassword: "admin-s3cret",
		});

		await lifecycle.command(context);

		expect(reported).toEqual([
			{
				name: BridgeEventName.SettingsApplied,
				text: {
					ar: "تم تطبيق الإعدادات اللي كانت تنتظر التشغيل (3)",
					en: "Applied the settings that were waiting for the next start (3)",
				},
				details: {
					keys: "ExpRate,ServerPassword,AdminPassword",
					count: 3,
				},
			},
		]);
		expect(JSON.stringify(reported)).not.toContain("hunter22");
		expect(JSON.stringify(reported)).not.toContain("admin-s3cret");
	});

	test("reports the replay once, so the next start does not repeat it", async () => {
		const { context, reported } = harness();

		await pending(context, {
			ExpRate: "3",
		});

		await lifecycle.command(context);
		await lifecycle.command(context);

		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.SettingsApplied,
		]);
	});

	test("reports nothing when the replay could not be written, and keeps it waiting", async () => {
		const { context, reported } = harness();

		await pending(context, {
			ExpRate: "3",
		});

		const failing = {
			...context,
			codec: {
				ueIni: {
					...context.codec.ueIni,
					async merge() {
						throw new Error("disk full");
					},
				},
			},
		} as unknown as Bridge.Context;

		await expect(lifecycle.command(failing)).rejects.toThrow("disk full");

		expect(reported).toEqual([]);
		expect(await readPendingSettings(context)).toEqual({
			ExpRate: "3",
		});
	});

	test("says nothing and touches nothing when no write is waiting", async () => {
		const { context, ini, logged, reported } = harness({
			ExpRate: "1.000000",
		});

		await pending(context, null);

		await lifecycle.command(context);

		expect(ini.ExpRate).toBe("1.000000");
		expect(logged).toEqual([]);
		expect(reported).toEqual([]);
	});

	test("still applies remote access after the replay", async () => {
		const { context, ini } = harness();

		await pending(context, {
			ExpRate: "3",
		});

		await lifecycle.command(context);

		expect(ini.RCONEnabled).toBe("false");
	});
});
