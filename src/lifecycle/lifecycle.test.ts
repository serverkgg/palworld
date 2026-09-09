import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { readPendingSettings, writeInstallStamp } from "../shared";
import { lifecycle } from "./lifecycle";

const GAME_PORT = 8241;

interface Harness {
	context: Bridge.Context;
	ini: Bridge.Values;
	logged: string[];
}

const harness = (ini: Bridge.Values = {}): Harness => {
	const stored = new Map<string, string>();
	const settings: Bridge.Values = {
		...ini,
	};
	const logged: string[] = [];

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
		log(message: string) {
			logged.push(message);
		},
	} as unknown as Bridge.Context;

	return {
		context,
		ini: settings,
		logged,
	};
};

const pending = async (context: Bridge.Context, settingsPending: Record<string, string> | null) => {
	await writeInstallStamp(context, {
		buildId: "1",
		adminPasswordNext: null,
		settingsPending,
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

	test("says nothing and touches nothing when no write is waiting", async () => {
		const { context, ini, logged } = harness({
			ExpRate: "1.000000",
		});

		await pending(context, null);

		await lifecycle.command(context);

		expect(ini.ExpRate).toBe("1.000000");
		expect(logged).toEqual([]);
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
