import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { EDITION_LAYOUTS, PalworldEdition, WINDOWS_BINARY_DIRECTORY, WINDOWS_STEAM_VARIABLE } from "./palworldEdition";
import { settleSteamClient, WINDOWS_STEAM_CLIENT_TARGET } from "./palworldSteamClient";

const contextWith = (steam: boolean, code = 0, placed = false) => {
	const ran: string[][] = [];
	const stored = new Set<string>(
		placed
			? [
					WINDOWS_STEAM_CLIENT_TARGET,
				]
			: [],
	);

	const context = {
		variable(key: string) {
			return key === WINDOWS_STEAM_VARIABLE && steam ? "true" : null;
		},
		files: {
			async exists(path: string) {
				return stored.has(path);
			},
			async remove(path: string) {
				stored.delete(path);
			},
		},
		async exec(argv: string[]) {
			ran.push(argv);

			return {
				code,
				stdout: "",
				stderr: code === 0 ? "" : "cp: cannot stat 'steamclient64.dll'",
			};
		},
	} as unknown as Bridge.Context;

	return {
		context,
		ran,
		stored,
	};
};

describe("the steam client beside the windows server", () => {
	it("copies the sdk's steamclient64.dll from the install root into the binary folder while steam is on", async () => {
		const { context, ran } = contextWith(true);

		await settleSteamClient(context);

		expect(WINDOWS_STEAM_CLIENT_TARGET).toBe(`${WINDOWS_BINARY_DIRECTORY}/steamclient64.dll`);
		expect(ran).toEqual([
			[
				"cp",
				"-f",
				"steamclient64.dll",
				WINDOWS_STEAM_CLIENT_TARGET,
			],
		]);
	});

	it("removes the copy while steam is off, so the server starts exactly as it did without the setting", async () => {
		const { context, ran, stored } = contextWith(false, 0, true);

		await settleSteamClient(context);

		expect(ran).toEqual([]);
		expect(stored.has(WINDOWS_STEAM_CLIENT_TARGET)).toBe(false);
	});

	it("fails the start when the copy fails, rather than starting a server without steam", async () => {
		const { context } = contextWith(true, 1);

		await expect(settleSteamClient(context)).rejects.toThrow("steamclient64.dll could not be placed beside the server");
	});

	it("checks the sdk's steamclient64.dll as a windows root, so steamcmd validates it back when it is missing", () => {
		expect(EDITION_LAYOUTS[PalworldEdition.Windows].roots).toContain("steamclient64.dll");
		expect(EDITION_LAYOUTS[PalworldEdition.Linux].roots).not.toContain("steamclient64.dll");
	});
});
