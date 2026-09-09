import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import {
	installUe4ss,
	missingLibraries,
	modsToCopy,
	removeUe4ss,
	shouldInstall,
	shouldRemove,
	ue4ssInstalled,
	ue4ssPresent,
} from "./ue4ssInstall";
import {
	readUe4ssStamp,
	UE4SS_IMAGE_ROOT,
	UE4SS_LAYOUT,
	UE4SS_LIBRARY,
	UE4SS_MODS,
	UE4SS_MODS_LIST,
	UE4SS_SETTINGS,
	UE4SS_STAGING,
	UE4SS_STAMP,
	UE4SS_VERSION,
} from "./ue4ssRelease";

const LDD = [
	"\tlinux-vdso.so.1 (0x00007ffd6b1f4000)",
	"\tlibX11.so.6 => not found",
	"\tlibstdc++.so.6 => /lib/x86_64-linux-gnu/libstdc++.so.6 (0x00007f2c1c000000)",
	"\tlibm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x00007f2c1bf00000)",
	"\tlibgcc_s.so.1 => not found",
].join("\n");

describe("checking the image really carries what the library needs", () => {
	test("names every library the loader could not find, once each", () => {
		expect(missingLibraries(`${LDD}\n${LDD}`)).toEqual([
			"libX11.so.6",
			"libgcc_s.so.1",
		]);
	});

	test("names nothing when every library resolved", () => {
		expect(missingLibraries("\tlibm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x00007f2c1bf00000)\n")).toEqual([]);
	});

	test("names nothing for an empty answer, so a silent ldd never blocks the install", () => {
		expect(missingLibraries("")).toEqual([]);
	});
});

describe("deciding whether to install ue4ss on this boot", () => {
	const stamp = {
		version: UE4SS_VERSION,
	};

	test("installs when the switch is on and nothing is there", () => {
		expect(shouldInstall(null, "true", false)).toBe(true);
	});

	test("installs when the switch is on and the library went missing under a stamp", () => {
		expect(shouldInstall(stamp, "true", false)).toBe(true);
	});

	test("installs when the switch is on and the stamp names an older release", () => {
		expect(
			shouldInstall(
				{
					version: "linux-native@0000000",
				},
				"true",
				true,
			),
		).toBe(true);
	});

	test("installs when the switch is on and nothing recorded what is installed", () => {
		expect(shouldInstall(null, "true", true)).toBe(true);
	});

	test("does nothing when the pinned release is already the installed one", () => {
		expect(shouldInstall(stamp, "true", true)).toBe(false);
	});

	test("never installs while the switch is off", () => {
		expect(shouldInstall(null, "false", false)).toBe(false);
		expect(shouldInstall(null, null, false)).toBe(false);
		expect(shouldInstall(stamp, "false", true)).toBe(false);
	});
});

describe("deciding whether to take ue4ss back off", () => {
	test("removes it once the switch goes off and anything of it is still on the volume", () => {
		expect(shouldRemove("false", true)).toBe(true);
		expect(shouldRemove(null, true)).toBe(true);
	});

	test("does nothing when the volume carries none of it", () => {
		expect(shouldRemove("false", false)).toBe(false);
	});

	test("never removes it while the switch is on", () => {
		expect(shouldRemove("true", true)).toBe(false);
	});
});

describe("merging the shipped mods folders into the owner's", () => {
	test("copies only the folders the owner does not already have", () => {
		expect(
			modsToCopy(
				[
					"BPModLoaderMod",
					"Keybinds",
					"shared",
				],
				[
					"BPModLoaderMod",
					"AdminCommands",
				],
			),
		).toEqual([
			"Keybinds",
			"shared",
		]);
	});

	test("copies everything into an empty mods folder", () => {
		expect(
			modsToCopy(
				[
					"Keybinds",
				],
				[],
			),
		).toEqual([
			"Keybinds",
		]);
	});

	test("copies nothing when the owner already has every shipped folder", () => {
		expect(
			modsToCopy(
				[
					"Keybinds",
				],
				[
					"Keybinds",
				],
			),
		).toEqual([]);
	});
});

const IMAGE_FILES: Record<string, string> = {
	[UE4SS_LIBRARY]: "elf",
	[UE4SS_SETTINGS]: "[Debug]\nConsoleEnabled = 0\n",
	[UE4SS_LAYOUT]: "[MemberVariableLayout]\n",
	[UE4SS_MODS_LIST]: "BPModLoaderMod : 1\nKeybinds : 1\nSplitScreenMod : 0\n",
};

const IMAGE_MODS = [
	"BPModLoaderMod",
	"Keybinds",
	"shared",
];

const RESOLVED = [
	"\tlinux-vdso.so.1 (0x00007ffd6b1f4000)",
	"\tlibstdc++.so.6 => /lib/x86_64-linux-gnu/libstdc++.so.6 (0x00007f2c1c000000)",
	"\tlibX11.so.6 => /lib/x86_64-linux-gnu/libX11.so.6 (0x00007f2c1bf00000)",
].join("\n");

interface Harness {
	context: Bridge.Context;
	files: Map<string, string>;
	directories: Set<string>;
	commands: string[][];
	merged: Record<string, string>;
}

const harness = (ldd: string = RESOLVED): Harness => {
	const files = new Map<string, string>();
	const directories = new Set<string>();
	const commands: string[][] = [];
	const merged: Record<string, string> = {};

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
		files: {
			async exists(path: string) {
				return files.has(path) || directories.has(path);
			},
			async read(path: string) {
				return files.get(path) ?? "";
			},
			async write(path: string, contents: string) {
				files.set(path, contents);
			},
			async ensure(path: string) {
				directories.add(path);
			},
			async remove(path: string) {
				const inside = under(path);

				for (const name of [
					...files.keys(),
				]) {
					if (inside(name)) {
						files.delete(name);
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
					return {
						ConsoleEnabled: "0",
						GuiConsoleEnabled: "0",
						GuiConsoleVisible: "0",
					};
				},
				async merge(_path: string, values: Record<string, string>) {
					Object.assign(merged, values);
				},
			},
		},
		async exec(command: string[]) {
			commands.push(command);

			const [tool, ...rest] = command;

			if (tool === "cp" && rest[0] === "-a" && rest[1] === `${UE4SS_IMAGE_ROOT}/.`) {
				const target = rest[2] ?? "";

				directories.add(`${target}/${UE4SS_MODS}`);

				for (const [name, contents] of Object.entries(IMAGE_FILES)) {
					files.set(`${target}/${name}`, contents);
				}

				for (const name of IMAGE_MODS) {
					directories.add(`${target}/${UE4SS_MODS}/${name}`);
				}

				return ok("");
			}

			if (tool === "ldd") {
				return ok(ldd);
			}

			if (tool === "find") {
				const path = rest[0] ?? "";
				const prefix = `${path}/`;

				return ok(
					[
						...directories,
					]
						.filter((name) => name.startsWith(prefix) && !name.slice(prefix.length).includes("/"))
						.map((name) => name.slice(prefix.length))
						.join("\n"),
				);
			}

			if (tool === "cp") {
				const [from, to] = rest.filter((argument) => !argument.startsWith("-"));

				if (from !== undefined && to !== undefined) {
					if (directories.has(from)) {
						directories.add(to);
					} else {
						files.set(to, files.get(from) ?? "");
					}
				}

				return ok("");
			}

			if (tool === "mv") {
				const [from, to] = rest;

				if (from !== undefined && to !== undefined) {
					files.set(to, files.get(from) ?? "");
					files.delete(from);
				}

				return ok("");
			}

			return ok("");
		},
		log() {
			return;
		},
	} as unknown as Bridge.Context;

	return {
		context,
		files,
		directories,
		commands,
		merged,
	};
};

describe("installing the ue4ss build out of the image", () => {
	test("copies the whole build out of /opt/ue4ss into the staging folder", async () => {
		const { context, commands } = harness();

		await installUe4ss(context);

		expect(commands.at(0)).toEqual([
			"cp",
			"-a",
			`${UE4SS_IMAGE_ROOT}/.`,
			UE4SS_STAGING,
		]);
	});

	test("never reaches the network, so a boot with no internet still installs", async () => {
		const { context, commands } = harness();

		await installUe4ss(context);

		for (const command of commands) {
			expect(command.at(0)).not.toBe("curl");
			expect(command.at(0)).not.toBe("tar");
		}
	});

	test("runs ldd on the staged library before anything is put in place", async () => {
		const { context, commands } = harness();

		await installUe4ss(context);

		const probe = commands.findIndex((command) => command.at(0) === "ldd");
		const deployed = commands.findIndex((command) => command.at(0) === "mv");

		expect(commands.at(probe)).toEqual([
			"ldd",
			`${UE4SS_STAGING}/${UE4SS_LIBRARY}`,
		]);
		expect(probe).toBeLessThan(deployed);
	});

	test("refuses the install and leaves the library alone when the image lost a dependency", async () => {
		const { context, files } = harness("\tlibX11.so.6 => not found\n");

		await expect(installUe4ss(context)).rejects.toBeInstanceOf(BridgeUserError);

		expect(files.has(UE4SS_LIBRARY)).toBe(false);
		expect(files.has(UE4SS_STAMP)).toBe(false);
	});

	test("puts the library in place through a pending name, so a half-copy is never loaded", async () => {
		const { context, commands, files } = harness();

		await installUe4ss(context);

		expect(commands.filter((command) => command.at(0) === "mv").at(0)).toEqual([
			"mv",
			`${UE4SS_LIBRARY}.new`,
			UE4SS_LIBRARY,
		]);
		expect(files.get(UE4SS_LIBRARY)).toBe("elf");
	});

	test("writes both ini files the loader reads beside the library", async () => {
		const { context, files } = harness();

		await installUe4ss(context);

		expect(files.get(UE4SS_SETTINGS)).toBe(IMAGE_FILES[UE4SS_SETTINGS]);
		expect(files.get(UE4SS_LAYOUT)).toBe(IMAGE_FILES[UE4SS_LAYOUT]);
	});

	test("copies the shipped mod folders in and merges the list the owner already had", async () => {
		const { context, directories, files } = harness();

		await installUe4ss(context);

		for (const name of IMAGE_MODS) {
			expect(directories.has(`${UE4SS_MODS}/${name}`)).toBe(true);
		}

		expect(files.get(UE4SS_MODS_LIST)).toContain("BPModLoaderMod : 1");
	});

	test("leaves the console writing to stdout and both gui windows off", async () => {
		const { context, merged, files } = harness();

		await installUe4ss(context);

		expect(merged).toEqual({
			ConsoleEnabled: "1",
			GuiConsoleEnabled: "0",
			GuiConsoleVisible: "0",
		});
		expect(files.get(UE4SS_MODS_LIST)).toContain("Keybinds : 0");
		expect(files.get(UE4SS_MODS_LIST)).toContain("SplitScreenMod : 0");
	});

	test("stamps the commit the image was built from, and clears the staging folder", async () => {
		const { context, files, directories } = harness();

		await installUe4ss(context);

		expect(JSON.parse(files.get(UE4SS_STAMP) ?? "{}")).toEqual({
			version: UE4SS_VERSION,
		});
		expect(shouldInstall(await readUe4ssStamp(context), "true", true)).toBe(false);
		expect(
			[
				...directories,
			].some((name) => name.startsWith(UE4SS_STAGING)),
		).toBe(false);
	});
});

describe("taking ue4ss back off the volume", () => {
	test("finds nothing to take off on a volume ue4ss never touched", async () => {
		const { context } = harness();

		expect(await ue4ssPresent(context)).toBe(false);
	});

	test("sees the library a reset left behind even though the settings file went with the reset", async () => {
		const { context, files } = harness();

		files.set(UE4SS_LIBRARY, "elf");

		expect(await ue4ssInstalled(context)).toBe(false);
		expect(await ue4ssPresent(context)).toBe(true);
	});

	test("deletes that leftover library, so the switch going off leaves nothing", async () => {
		const { context, files } = harness();

		files.set(UE4SS_LIBRARY, "elf");

		await removeUe4ss(context);

		expect(files.has(UE4SS_LIBRARY)).toBe(false);
		expect(await ue4ssPresent(context)).toBe(false);
	});

	test("keeps the owner's mods folder while it clears everything else", async () => {
		const { context, directories, files } = harness();

		files.set(UE4SS_LIBRARY, "elf");
		files.set(UE4SS_SETTINGS, "[Debug]\n");
		files.set(UE4SS_LAYOUT, "[MemberVariableLayout]\n");
		files.set(UE4SS_STAMP, "{}\n");
		files.set(UE4SS_MODS_LIST, "BPModLoaderMod : 1\n");
		directories.add(UE4SS_MODS);

		await removeUe4ss(context);

		expect(await ue4ssPresent(context)).toBe(false);
		expect(directories.has(UE4SS_MODS)).toBe(true);
		expect(files.get(UE4SS_MODS_LIST)).toBe("BPModLoaderMod : 1\n");
	});
});
