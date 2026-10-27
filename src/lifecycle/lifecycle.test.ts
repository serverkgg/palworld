import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { PROTON_HEADLESS_ENVIRONMENT } from "@serverkgg/bridge/wine";
import {
	DEFAULT_SETTINGS_FILE,
	EDITION_VARIABLE,
	MOD_DEPLOY_FILE,
	PalworldEdition,
	readPendingSettings,
	WINDOWS_BAN_LIST_URL,
	WINDOWS_BINARY,
	WINDOWS_STEAM_VARIABLE,
	writeInstallStamp,
} from "../shared";
import { lifecycle, START_WRAPPER, WINDOWS_ENVIRONMENT } from "./lifecycle";
import { MOD_SETTINGS, MOD_SETTINGS_FILE } from "./modDeploy";

const GAME_PORT = 8241;

const GLOBAL_BAN_LIST_URL = "https://b.palworldgame.com/api/banlist.txt";

const OWNER_BAN_LIST_URL = "https://bans.example.com/banlist.txt";

interface Harness {
	context: Bridge.Context;
	ini: Bridge.Values;
	stored: Map<string, string>;
	logged: string[];
	reported: Bridge.Activity[];
	ran: string[][];
}

const harness = (
	ini: Bridge.Values = {},
	variables: Record<string, string> = {},
	shipped: Bridge.Values = {},
): Harness => {
	const stored = new Map<string, string>();
	const settings: Bridge.Values = {
		...ini,
	};
	const logged: string[] = [];
	const reported: Bridge.Activity[] = [];
	const ran: string[][] = [];

	const context = {
		variable(key: string) {
			return variables[key] ?? null;
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
			async ensure() {},
			async remove(path: string) {
				stored.delete(path);
			},
			async list() {
				return [];
			},
		},
		codec: {
			ueIni: {
				async read(path: string) {
					return path === DEFAULT_SETTINGS_FILE ? shipped : settings;
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
		async exec(argv: string[]) {
			ran.push(argv);

			return {
				code: 0,
				stdout: "",
				stderr: "",
			};
		},
		log(message: string) {
			logged.push(message);
		},
	} as unknown as Bridge.Context;

	return {
		context,
		ini: settings,
		stored,
		logged,
		reported,
		ran,
	};
};

const pending = async (context: Bridge.Context, settingsPending: Record<string, string> | null) => {
	await writeInstallStamp(context, {
		buildId: "1",
		edition: PalworldEdition.Linux,
		mods: [],
		adminPasswordNext: null,
		settingsPending,
		settingsBaseline: null,
	});
};

describe("the command that starts the game", () => {
	it("starts the shipped script on the port the panel published", async () => {
		const command = await lifecycle.command(harness().context);

		expect(command[0]).toBe("./PalServer.sh");
		expect(command).toContain(`-port=${GAME_PORT}`);
	});

	it("starts the windows edition straight in the proton prefix from its binary folder, so its output reaches the console", async () => {
		const { context, stored } = harness(
			{},
			{
				[EDITION_VARIABLE]: PalworldEdition.Windows,
			},
		);

		const command = await lifecycle.command(context);

		expect(command.slice(0, 2)).toEqual([
			START_WRAPPER,
			"/home/container/Pal/Binaries/Win64",
		]);
		expect(command).toContain("runinprefix");
		expect(command).not.toContain("run");
		expect(command).toContain(`/home/container/${WINDOWS_BINARY}`);
		expect(command).toContain(`-port=${GAME_PORT}`);
		expect(stored.get(MOD_SETTINGS_FILE)).toBe(MOD_SETTINGS);
	});

	it("runs the windows edition headless under proton with dwmapi loaded native first", async () => {
		const { context } = harness(
			{},
			{
				[EDITION_VARIABLE]: PalworldEdition.Windows,
			},
		);

		expect(WINDOWS_ENVIRONMENT).toEqual({
			...PROTON_HEADLESS_ENVIRONMENT,
			WINEDLLOVERRIDES: "dwmapi=n,b",
		});
		expect(await lifecycle.command(context)).toEqual(
			expect.arrayContaining(Object.entries(WINDOWS_ENVIRONMENT).map(([key, value]) => `${key}=${value}`)),
		);
	});

	it("starts the windows edition without steam by default, so existing worlds keep their no-steam characters", async () => {
		const { context } = harness(
			{},
			{
				[EDITION_VARIABLE]: PalworldEdition.Windows,
			},
		);

		expect(await lifecycle.command(context)).toContain("-nosteam");
	});

	it("starts the windows edition with steam once the owner turns it on, so players keep their steam ids", async () => {
		const { context, ran } = harness(
			{},
			{
				[EDITION_VARIABLE]: PalworldEdition.Windows,
				[WINDOWS_STEAM_VARIABLE]: "true",
			},
		);

		const command = await lifecycle.command(context);

		expect(command).not.toContain("-nosteam");
		expect(ran).toContainEqual([
			"cp",
			"-f",
			"steamclient64.dll",
			"Pal/Binaries/Win64/steamclient64.dll",
		]);

		for (const flag of [
			"-useperfthreads",
			"-NoAsyncLoadingThread",
			"-UseMultithreadForDS",
		]) {
			expect(command).not.toContain(flag);
		}
	});

	it("takes back what an earlier windows start placed when the server starts on linux", async () => {
		const { context, stored } = harness();

		stored.set(
			MOD_DEPLOY_FILE,
			JSON.stringify([
				{
					id: "paks:ExpandedBaseRadius",
					paths: [
						"Pal/Content/Paks/~mods/ExpandedBaseRadius",
					],
				},
			]),
		);
		stored.set("Pal/Content/Paks/~mods/ExpandedBaseRadius", "pak");

		await lifecycle.command(context);

		expect(stored.has("Pal/Content/Paks/~mods/ExpandedBaseRadius")).toBe(false);
		expect(stored.get(MOD_DEPLOY_FILE)).toBe("[]");
		expect(stored.has(MOD_SETTINGS_FILE)).toBe(false);
	});

	it("keeps every flag the server needs", async () => {
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

const WINDOWS_WITHOUT_STEAM = {
	[EDITION_VARIABLE]: PalworldEdition.Windows,
};

const WINDOWS_WITH_STEAM = {
	[EDITION_VARIABLE]: PalworldEdition.Windows,
	[WINDOWS_STEAM_VARIABLE]: "true",
};

describe("keeping pocketpair's global ban list off the windows edition without steam", () => {
	it("swaps the ban list address before the windows edition starts, because its steam ids never match a no-steam player", async () => {
		const { context, ini } = harness(
			{
				BanListURL: GLOBAL_BAN_LIST_URL,
			},
			WINDOWS_WITHOUT_STEAM,
		);

		await lifecycle.command(context);

		expect(ini.BanListURL).toBe(WINDOWS_BAN_LIST_URL);
	});

	it("never writes an empty address, which crashes the windows server at boot", () => {
		expect(WINDOWS_BAN_LIST_URL.length).toBeGreaterThan(0);
		expect(WINDOWS_BAN_LIST_URL).not.toBe(GLOBAL_BAN_LIST_URL);
	});

	it("swaps it again on every start, after the game wrote it back on shutdown", async () => {
		const { context, ini } = harness({}, WINDOWS_WITHOUT_STEAM);

		await lifecycle.command(context);

		ini.BanListURL = GLOBAL_BAN_LIST_URL;

		await lifecycle.command(context);

		expect(ini.BanListURL).toBe(WINDOWS_BAN_LIST_URL);
	});

	it("swaps it after the replay, so a replayed address cannot bring the global list back", async () => {
		const { context, ini } = harness({}, WINDOWS_WITHOUT_STEAM);

		await pending(context, {
			BanListURL: GLOBAL_BAN_LIST_URL,
		});

		await lifecycle.command(context);

		expect(ini.BanListURL).toBe(WINDOWS_BAN_LIST_URL);
	});
});

describe("pocketpair's global ban list wherever steam runs", () => {
	const editions = [
		{
			name: "linux",
			variables: {},
		},
		{
			name: "windows with steam",
			variables: WINDOWS_WITH_STEAM,
		},
	];

	for (const { name, variables } of editions) {
		it(`leaves the owner's ban list address alone on ${name}`, async () => {
			const { context, ini } = harness(
				{
					BanListURL: GLOBAL_BAN_LIST_URL,
				},
				variables,
			);

			await lifecycle.command(context);

			expect(ini.BanListURL).toBe(GLOBAL_BAN_LIST_URL);
		});

		it(`puts the shipped ban list back on ${name} over the unreachable windows address`, async () => {
			const { context, ini, logged } = harness(
				{
					BanListURL: WINDOWS_BAN_LIST_URL,
				},
				variables,
				{
					BanListURL: GLOBAL_BAN_LIST_URL,
				},
			);

			await lifecycle.command(context);

			expect(ini.BanListURL).toBe(GLOBAL_BAN_LIST_URL);
			expect(logged).toContain("restored the shipped ban list the windows edition had turned off");
		});

		it(`keeps a ban list the owner set themselves on ${name}, even when the shipped one differs`, async () => {
			const { context, ini } = harness(
				{
					BanListURL: OWNER_BAN_LIST_URL,
				},
				variables,
				{
					BanListURL: GLOBAL_BAN_LIST_URL,
				},
			);

			await lifecycle.command(context);

			expect(ini.BanListURL).toBe(OWNER_BAN_LIST_URL);
		});
	}

	it("puts the shipped ban list back when the windows edition turns steam on", async () => {
		const variables: Record<string, string> = {
			...WINDOWS_WITHOUT_STEAM,
		};
		const { context, ini } = harness(
			{
				BanListURL: GLOBAL_BAN_LIST_URL,
			},
			variables,
			{
				BanListURL: GLOBAL_BAN_LIST_URL,
			},
		);

		await lifecycle.command(context);

		variables[WINDOWS_STEAM_VARIABLE] = "true";

		await lifecycle.command(context);

		expect(ini.BanListURL).toBe(GLOBAL_BAN_LIST_URL);
	});

	it("leaves the unreachable address when the shipped settings name no ban list", async () => {
		const { context, ini } = harness({
			BanListURL: WINDOWS_BAN_LIST_URL,
		});

		await lifecycle.command(context);

		expect(ini.BanListURL).toBe(WINDOWS_BAN_LIST_URL);
	});
});

describe("replaying the settings the game overwrote on its last shutdown", () => {
	it("writes them back into the ini before the game reads it", async () => {
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

	it("clears them, so the next start does not fight a later write", async () => {
		const { context } = harness();

		await pending(context, {
			ExpRate: "3",
		});

		await lifecycle.command(context);

		expect(await readPendingSettings(context)).toEqual({});
	});

	it("says how many settings it replayed", async () => {
		const { context, logged } = harness();

		await pending(context, {
			ExpRate: "3",
			WorkSpeedRate: "2",
		});

		await lifecycle.command(context);

		expect(logged).toContain("replayed the settings the game overwrote on its last shutdown");
	});

	it("tells the owner which settings landed from a pending record with no baseline, by name and never by value", async () => {
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
					ar: "تم تطبيق الإعدادات التي كانت بانتظار التشغيل (3)",
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

	it("reports the replay once, so the next start does not repeat it", async () => {
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

	it("reports nothing when the replay could not be written, and keeps it waiting", async () => {
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

	it("says nothing and touches nothing when no write is waiting", async () => {
		const { context, ini, logged, reported } = harness({
			ExpRate: "1.000000",
		});

		await pending(context, null);

		await lifecycle.command(context);

		expect(ini.ExpRate).toBe("1.000000");
		expect(logged).toEqual([]);
		expect(reported).toEqual([]);
	});

	it("still applies remote access after the replay", async () => {
		const { context, ini } = harness();

		await pending(context, {
			ExpRate: "3",
		});

		await lifecycle.command(context);

		expect(ini.RCONEnabled).toBe("false");
	});
});
