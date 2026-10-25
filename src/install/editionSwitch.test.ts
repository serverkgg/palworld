import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { type InstallStamp, PalworldEdition, readInstallStamp, STEAM_APP_MANIFEST } from "../shared";
import { leaveEdition, settleEdition } from "./editionSwitch";

const contextWith = (paths: string[]) => {
	const stored = new Map(
		paths.map((path) => [
			path,
			path,
		]),
	);

	const exists = (path: string) => {
		return [
			...stored.keys(),
		].some((key) => key === path || key.startsWith(`${path}/`));
	};

	const context = {
		files: {
			async exists(path: string) {
				return exists(path);
			},
			async read(path: string) {
				return stored.get(path) ?? "";
			},
			async write(path: string, content: string) {
				stored.set(path, content);
			},
			async remove(path: string) {
				for (const key of [
					...stored.keys(),
				]) {
					if (key === path || key.startsWith(`${path}/`)) {
						stored.delete(key);
					}
				}
			},
			async move(from: string, to: string) {
				if (exists(to)) {
					throw new Error(`${to} already exists`);
				}

				stored.set(to, stored.get(from) ?? "");
				stored.delete(from);
			},
			async ensure() {},
		},
		log() {},
	} as unknown as Bridge.Context;

	return {
		context,
		stored,
	};
};

const stampWith = (edition: PalworldEdition): InstallStamp => {
	return {
		buildId: "1",
		edition,
		mods: [],
		adminPasswordNext: null,
		settingsPending: null,
		settingsBaseline: null,
	};
};

const filesOf = (stored: Map<string, string>) => {
	return [
		...stored.keys(),
	]
		.filter((path) => path !== INSTALL_STAMP_FILE)
		.sort();
};

const WORLD = "Pal/Saved/SaveGames/0/ABC123/Level.sav";

const LINUX_CONFIG = "Pal/Saved/Config/LinuxServer";

const WINDOWS_CONFIG = "Pal/Saved/Config/WindowsServer";

describe("leaveEdition", () => {
	it("removes the linux binaries and keeps the world when moving to windows", async () => {
		const { context, stored } = contextWith([
			"PalServer.sh",
			"Pal/Binaries/Linux/PalServer-Linux-Shipping",
			"Pal/Content/Paks/Pal-LinuxServer.pak",
			STEAM_APP_MANIFEST,
			WORLD,
			"Pal/Content/Paks/~mods/a.pak",
		]);

		await leaveEdition(context, PalworldEdition.Linux, PalworldEdition.Windows);

		expect(filesOf(stored)).toEqual([
			"Pal/Content/Paks/~mods/a.pak",
			WORLD,
		]);
	});

	it("removes the windows binaries and the windows steam sdk, and keeps the uploaded mods when moving back to linux", async () => {
		const { context, stored } = contextWith([
			"PalServer.exe",
			"steamclient64.dll",
			"tier0_s64.dll",
			"Pal/Binaries/Win64/PalServer-Win64-Shipping-Cmd.exe",
			"Pal/Binaries/Win64/steamclient64.dll",
			"Mods/Workshop/123/Info.json",
			WORLD,
		]);

		await leaveEdition(context, PalworldEdition.Windows, PalworldEdition.Linux);

		expect(filesOf(stored)).toEqual([
			"Mods/Workshop/123/Info.json",
			WORLD,
		]);
	});
});

describe("settleEdition", () => {
	it("carries the settings and the world pointer into the windows config folder, and stamps the new edition first", async () => {
		const { context, stored } = contextWith([
			`${LINUX_CONFIG}/PalWorldSettings.ini`,
			`${LINUX_CONFIG}/GameUserSettings.ini`,
			`${LINUX_CONFIG}/Engine.ini`,
			`${LINUX_CONFIG}/Game.ini`,
		]);

		const switching = await settleEdition(context, stampWith(PalworldEdition.Linux), PalworldEdition.Windows);

		expect(switching).toEqual(true);
		expect((await readInstallStamp(context))?.edition).toEqual(PalworldEdition.Windows);
		expect(filesOf(stored)).toEqual([
			`${LINUX_CONFIG}/Game.ini`,
			`${WINDOWS_CONFIG}/Engine.ini`,
			`${WINDOWS_CONFIG}/GameUserSettings.ini`,
			`${WINDOWS_CONFIG}/PalWorldSettings.ini`,
		]);
	});

	it("brings the config back to linux when a failed switch to windows is reverted", async () => {
		const { context, stored } = contextWith([
			`${WINDOWS_CONFIG}/PalWorldSettings.ini`,
			`${WINDOWS_CONFIG}/GameUserSettings.ini`,
			WORLD,
		]);

		const switching = await settleEdition(context, stampWith(PalworldEdition.Windows), PalworldEdition.Linux);

		expect(switching).toEqual(true);
		expect((await readInstallStamp(context))?.edition).toEqual(PalworldEdition.Linux);
		expect(filesOf(stored)).toEqual([
			`${LINUX_CONFIG}/GameUserSettings.ini`,
			`${LINUX_CONFIG}/PalWorldSettings.ini`,
			WORLD,
		]);
	});

	it("keeps the current edition's config when both folders hold the file", async () => {
		const { context, stored } = contextWith([
			`${LINUX_CONFIG}/GameUserSettings.ini`,
			`${WINDOWS_CONFIG}/GameUserSettings.ini`,
		]);

		stored.set(`${LINUX_CONFIG}/GameUserSettings.ini`, "linux world");
		stored.set(`${WINDOWS_CONFIG}/GameUserSettings.ini`, "windows world");

		await settleEdition(context, stampWith(PalworldEdition.Windows), PalworldEdition.Linux);

		expect(stored.get(`${LINUX_CONFIG}/GameUserSettings.ini`)).toEqual("linux world");
		expect(stored.get(`${WINDOWS_CONFIG}/GameUserSettings.ini`)).toEqual("windows world");
	});

	it("leaves an ordinary install alone, so a retry after a failed download keeps the steam manifest", async () => {
		const paths = [
			STEAM_APP_MANIFEST,
			"Pal/Binaries/Win64/PalServer-Win64-Shipping-Cmd.exe",
			`${WINDOWS_CONFIG}/PalWorldSettings.ini`,
			WORLD,
		];
		const { context, stored } = contextWith(paths);

		const switching = await settleEdition(context, stampWith(PalworldEdition.Windows), PalworldEdition.Windows);

		expect(switching).toEqual(false);
		expect(stored.has(INSTALL_STAMP_FILE)).toEqual(false);
		expect(filesOf(stored)).toEqual(paths.sort());
	});
});
