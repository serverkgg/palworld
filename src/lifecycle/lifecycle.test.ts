import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { readPendingSettings, writeInstallStamp } from "../shared";
import {
	UE4SS_IMAGE_ROOT,
	UE4SS_LAYOUT,
	UE4SS_LIBRARY,
	UE4SS_MODS_LIST,
	UE4SS_SETTINGS,
	UE4SS_STAMP,
	UE4SS_VARIABLE,
	UE4SS_VERSION,
	writeUe4ssStamp,
} from "../ue4ss";
import { lifecycle } from "./lifecycle";

const GAME_PORT = 8241;

const SERVER_ROOT = "/home/container";

const IMAGE_FILES: Record<string, string> = {
	[UE4SS_LIBRARY]: "elf",
	[UE4SS_SETTINGS]: "[Debug]\nConsoleEnabled = 0\n",
	[UE4SS_LAYOUT]: "[MemberVariableLayout]\n",
	[UE4SS_MODS_LIST]: "BPModLoaderMod : 1\n",
};

const LDD_RESOLVED = "\tlibstdc++.so.6 => /lib/x86_64-linux-gnu/libstdc++.so.6 (0x00007f2c1c000000)";

interface Harness {
	context: Bridge.Context;
	ini: Bridge.Values;
	logged: string[];
	files: Map<string, string>;
	commands: string[][];
}

const harness = (ini: Bridge.Values = {}, variables: Record<string, string> = {}, copies = true): Harness => {
	const stored = new Map<string, string>();
	const directories = new Set<string>();
	const commands: string[][] = [];
	const settings: Bridge.Values = {
		...ini,
	};
	const logged: string[] = [];

	const under = (path: string) => {
		return (candidate: string) => candidate === path || candidate.startsWith(`${path}/`);
	};

	const ok = (stdout: string) => {
		return {
			stdout,
			stderr: "",
			code: 0,
		};
	};

	const context = {
		variable(key: string) {
			return variables[key] ?? null;
		},
		async exec(command: string[]) {
			commands.push(command);

			const [tool, ...rest] = command;

			if (tool === "cp" && rest.at(1) === `${UE4SS_IMAGE_ROOT}/.`) {
				const target = rest.at(2) ?? "";

				for (const [name, contents] of Object.entries(IMAGE_FILES)) {
					stored.set(`${target}/${name}`, contents);
				}

				return ok("");
			}

			if (tool === "ldd") {
				return ok(LDD_RESOLVED);
			}

			if (tool === "find") {
				return ok("");
			}

			if (tool === "cp" || tool === "mv") {
				const [from, to] = rest.filter((argument) => !argument.startsWith("-"));

				if (copies && from !== undefined && to !== undefined) {
					stored.set(to, stored.get(from) ?? "");

					if (tool === "mv") {
						stored.delete(from);
					}
				}

				return ok("");
			}

			return ok(`${SERVER_ROOT}\n`);
		},
		port() {
			return GAME_PORT;
		},
		files: {
			async exists(path: string) {
				return stored.has(path) || directories.has(path);
			},
			async read(path: string) {
				return stored.get(path) ?? "";
			},
			async write(path: string, content: string) {
				stored.set(path, content);
			},
			async ensure(path: string) {
				directories.add(path);
			},
			async remove(path: string) {
				const inside = under(path);

				for (const name of [
					...stored.keys(),
				]) {
					if (inside(name)) {
						stored.delete(name);
					}
				}

				for (const name of [
					...directories,
				]) {
					if (inside(name)) {
						directories.delete(name);
					}
				}
			},
		},
		codec: {
			ini: {
				async read() {
					return {};
				},
				async merge() {
					return;
				},
			},
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
		files: stored,
		commands,
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

const ue4ssHarness = async (variable: string, installed: boolean, copies = true) => {
	const { context, files, commands } = harness(
		{},
		{
			[UE4SS_VARIABLE]: variable,
		},
		copies,
	);

	if (installed) {
		for (const path of [
			UE4SS_LIBRARY,
			UE4SS_SETTINGS,
			UE4SS_LAYOUT,
		]) {
			await context.files.write(path, "");
		}

		await writeUe4ssStamp(context, {
			version: UE4SS_VERSION,
		});
	}

	return {
		context,
		files,
		commands,
	};
};

describe("starting the game with ue4ss preloaded", () => {
	test("leaves the command alone while the switch is off", async () => {
		expect((await lifecycle.command(harness().context)).at(0)).toBe("./PalServer.sh");
	});

	test("preloads the library from the absolute path the container really runs in", async () => {
		const { context } = await ue4ssHarness("true", true);
		const command = await lifecycle.command(context);

		expect(command.slice(0, 2)).toEqual([
			"env",
			`LD_PRELOAD=${SERVER_ROOT}/${UE4SS_LIBRARY}`,
		]);
		expect(command.at(2)).toBe("./PalServer.sh");
	});

	test("keeps every flag the server already started with", async () => {
		const { context } = await ue4ssHarness("true", true);
		const command = await lifecycle.command(context);

		for (const flag of [
			`-port=${GAME_PORT}`,
			"-useperfthreads",
			"-NoAsyncLoadingThread",
			"-UseMultithreadForDS",
		]) {
			expect(command).toContain(flag);
		}
	});

	test("copies nothing on a start where the pinned release is already installed", async () => {
		const { context, commands } = await ue4ssHarness("true", true);

		await lifecycle.command(context);

		expect(commands.some((command) => command.at(0) === "cp")).toBe(false);
	});
});

describe("applying the ue4ss switch on the start that follows the flip", () => {
	test("installs the loader when the switch is on and nothing is there, then preloads it", async () => {
		const { context, files } = await ue4ssHarness("true", false);

		const command = await lifecycle.command(context);

		expect(files.get(UE4SS_LIBRARY)).toBe(IMAGE_FILES[UE4SS_LIBRARY]);
		expect(files.get(UE4SS_STAMP)).toContain(UE4SS_VERSION);
		expect(command.slice(0, 2)).toEqual([
			"env",
			`LD_PRELOAD=${SERVER_ROOT}/${UE4SS_LIBRARY}`,
		]);
	});

	test("takes the loader off the volume when the switch is off, and preloads nothing", async () => {
		const { context, files } = await ue4ssHarness("false", true);

		const command = await lifecycle.command(context);

		for (const path of [
			UE4SS_LIBRARY,
			UE4SS_SETTINGS,
			UE4SS_LAYOUT,
			UE4SS_STAMP,
		]) {
			expect(files.has(path), `${path} must be gone once the switch is off`).toBe(false);
		}

		expect(command.at(0)).toBe("./PalServer.sh");
	});

	test("tells the owner in their own language when the install left no library behind", async () => {
		const { context } = await ue4ssHarness("true", false, false);

		await expect(lifecycle.command(context)).rejects.toBeInstanceOf(BridgeUserError);
	});
});
