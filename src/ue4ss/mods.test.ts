import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { modDirectories, modRow, safeModName, ue4ssMods } from "./mods";
import { UE4SS_MODS_LIST } from "./ue4ssRelease";

interface Harness {
	context: Bridge.Context;
	files: Map<string, string>;
	directories: Set<string>;
	logged: string[];
}

const harness = (folders: string[], list: string, found: string[] = []): Harness => {
	const files = new Map<string, string>([
		[
			UE4SS_MODS_LIST,
			list,
		],
	]);

	const directories = new Set<string>(folders.map((name) => `Mods/${name}`));
	const logged: string[] = [];

	const context = {
		files: {
			async exists(path: string) {
				return files.has(path) || directories.has(path) || path === "Mods";
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
				files.delete(path);
				directories.delete(path);
			},
			async move(from: string, to: string) {
				directories.delete(from);
				directories.add(to);
			},
		},
		async exec(command: string[]) {
			if (command.includes("-printf") && command.includes("%h\n")) {
				return {
					stdout: found.join("\n"),
					stderr: "",
					code: 0,
				};
			}

			return {
				stdout: folders.join("\n"),
				stderr: "",
				code: 0,
			};
		},
		log(message: string) {
			logged.push(message);
		},
	} as unknown as Bridge.Context;

	return {
		context,
		files,
		directories,
		logged,
	};
};

describe("naming a mod folder the owner uploaded", () => {
	test("keeps latin letters, digits, dots, dashes and underscores", () => {
		expect(safeModName("Admin_Commands-2.0")).toBe("Admin_Commands-2.0");
	});

	test("strips anything a path should not carry", () => {
		expect(safeModName("../mod name")).toBe("..modname");
		expect(safeModName("مود")).toBe("");
	});
});

describe("finding the mod inside what the owner uploaded", () => {
	test("takes the folder that holds the scripts folder, once each", () => {
		expect(modDirectories(".serverk-staging/ue4ss-mod-upload/pack/AdminCommands\n\n")).toEqual([
			".serverk-staging/ue4ss-mod-upload/pack/AdminCommands",
		]);
	});

	test("names every candidate when the archive holds more than one mod", () => {
		expect(modDirectories("upload/Two\nupload/One\nupload/One\n")).toEqual([
			"upload/One",
			"upload/Two",
		]);
	});

	test("names nothing when the archive holds no mod at all", () => {
		expect(modDirectories("")).toEqual([]);
	});
});

describe("showing the mods the owner has", () => {
	test("marks an enabled mod and leaves a disabled one blank", () => {
		expect(modRow("AdminCommands", true)).toEqual({
			id: "AdminCommands",
			name: "AdminCommands",
			enabled: "✓",
		});
		expect(modRow("AdminCommands", false).enabled).toBe("");
	});

	test("lists every folder except the shared library folder ue4ss keeps beside them", async () => {
		const { context } = harness(
			[
				"AdminCommands",
				"BPModLoaderMod",
				"shared",
			],
			"BPModLoaderMod : 1\nAdminCommands : 0\n",
		);

		const rows = await ue4ssMods.list(context);

		expect(rows.map((row) => row.id)).toEqual([
			"AdminCommands",
			"BPModLoaderMod",
		]);
		expect(rows.map((row) => row.enabled)).toEqual([
			"",
			"✓",
		]);
	});
});

describe("switching a mod on and off from its row", () => {
	test("writes the switch into the list ue4ss reads", async () => {
		const { context, files } = harness(
			[
				"AdminCommands",
			],
			"AdminCommands : 0\n",
		);

		await ue4ssMods.actions?.enable?.(context, modRow("AdminCommands", false), {});

		expect(files.get(UE4SS_MODS_LIST)).toBe("AdminCommands : 1\n");

		await ue4ssMods.actions?.disable?.(context, modRow("AdminCommands", true), {});

		expect(files.get(UE4SS_MODS_LIST)).toBe("AdminCommands : 0\n");
	});
});

describe("taking a mod the owner uploaded", () => {
	test("moves the mod folder in and switches it on", async () => {
		const staged = ".serverk-staging/ue4ss-mod-upload/pack";
		const { context, files, directories } = harness([], "BPModLoaderMod : 1\n", [
			`${staged}/AdminCommands`,
		]);

		directories.add(staged);
		directories.add(`${staged}/AdminCommands`);

		await ue4ssMods.add?.(context, `${staged}/AdminCommands`);

		expect(directories.has("Mods/AdminCommands")).toBe(true);
		expect(files.get(UE4SS_MODS_LIST)).toContain("AdminCommands : 1");
	});

	test("refuses an archive with no mod in it", async () => {
		const staged = ".serverk-staging/ue4ss-mod-upload/pack";
		const { context, directories } = harness([], "", []);

		directories.add(staged);

		await expect(ue4ssMods.add?.(context, staged)).rejects.toThrow();
	});

	test("refuses a path that never landed in the staging folder", async () => {
		const { context } = harness([], "", []);

		await expect(ue4ssMods.add?.(context, "/etc/passwd")).rejects.toThrow();
	});

	test("refuses a name the owner already has, instead of overwriting it", async () => {
		const staged = ".serverk-staging/ue4ss-mod-upload/pack";
		const { context, directories } = harness(
			[
				"AdminCommands",
			],
			"AdminCommands : 1\n",
			[
				`${staged}/AdminCommands`,
			],
		);

		directories.add(staged);
		directories.add(`${staged}/AdminCommands`);

		await expect(ue4ssMods.add?.(context, `${staged}/AdminCommands`)).rejects.toThrow();
	});
});
