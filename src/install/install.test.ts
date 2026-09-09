import { describe, expect, test } from "bun:test";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { STEAM_DIRECTORY, STEAMCMD_DIRECTORY } from "@serverkgg/bridge/steam";
import { compileGlobs, matchesAny } from "@serverkgg/bridge/utils";
import { GAME_ROOTS } from "../shared";
import { UE4SS_LAYOUT, UE4SS_LIBRARY, UE4SS_MODS, UE4SS_SETTINGS, UE4SS_STAMP } from "../ue4ss";

interface Manifest {
	backup: {
		only: string[];
	};
	reset: {
		keep: string[];
	};
	files: {
		protected: string[];
		notable: {
			match: string;
			label: {
				ar: string;
				en: string;
			};
			note?: {
				ar: string;
				en: string;
			};
		}[];
	};
}

const manifest = Bun.YAML.parse(await Bun.file(new URL("../../serverk.yml", import.meta.url)).text()) as Manifest;

const matchedBy = (path: string, globs: string[]) => {
	const patterns = compileGlobs(globs);
	const segments = path.split("/");

	for (let depth = segments.length; depth > 0; depth -= 1) {
		if (matchesAny(segments.slice(0, depth).join("/"), patterns)) {
			return true;
		}
	}

	return false;
};

const survivesReset = (path: string) => {
	return matchedBy(path, manifest.reset.keep) || manifest.reset.keep.some((glob) => glob.startsWith(`${path}/`));
};

const protectedFrom = (path: string) => {
	return matchedBy(path, manifest.files.protected);
};

describe("the manifest guarding the steam install against a reset", () => {
	test("keeps steamcmd across a reset, so a reset never re-downloads twenty gigabytes", () => {
		expect(manifest.reset.keep).toContain(STEAMCMD_DIRECTORY);
	});

	test("keeps the steam client directory the driver links steamclient.so into", () => {
		expect(manifest.reset.keep).toContain(STEAM_DIRECTORY);
	});

	test("keeps the game files a reset has no reason to remove", () => {
		for (const path of [
			"PalServer.sh",
			"Engine",
			"steamapps",
			"Pal/Binaries",
			"Pal/Plugins",
			"Pal/Content/Paks/Pal-*",
		]) {
			expect(manifest.reset.keep).toContain(path);
		}
	});

	test("keeps every root the installer checks, so a reset never re-downloads the game", () => {
		for (const root of GAME_ROOTS) {
			expect(survivesReset(root), `${root} must survive a reset`).toBe(true);
		}
	});

	test("still wipes the world and the mods the customer installed", () => {
		expect(survivesReset("Pal/Saved"), "the world must not survive a reset").toBe(false);
		expect(survivesReset("Pal/Content/Paks/~mods"), "customer mods must not survive a reset").toBe(false);
	});

	test("leaves the mods folder editable while protecting the game payload", () => {
		expect(protectedFrom("Pal/Content/Paks/~mods")).toBe(false);
		expect(protectedFrom("Pal/Content/Paks/Pal-LinuxServer.pak")).toBe(true);
		expect(protectedFrom("Pal/Binaries/Linux/PalServer-Linux-Shipping")).toBe(true);
	});

	test("hides the steam directories from the file manager, so nobody deletes them by hand", () => {
		expect(manifest.files.protected).toContain(STEAMCMD_DIRECTORY);
		expect(manifest.files.protected).toContain(STEAM_DIRECTORY);
	});

	test("protects the install stamp the driver reports the version from", () => {
		expect(manifest.files.protected).toContain(INSTALL_STAMP_FILE);
	});
});

describe("the manifest carrying ue4ss through a backup, a reset and the file manager", () => {
	test("backs up the mods the owner installed, beside the world", () => {
		expect(manifest.backup.only).toContain(`${UE4SS_MODS}/**`);
	});

	test("protects the loader, its two config files and its stamp from a stray delete", () => {
		for (const path of [
			UE4SS_LIBRARY,
			UE4SS_SETTINGS,
			UE4SS_LAYOUT,
			UE4SS_STAMP,
		]) {
			expect(manifest.files.protected).toContain(path);
		}
	});

	test("leaves the mods folder editable, because that is where the owner drops a mod", () => {
		expect(protectedFrom(UE4SS_MODS)).toBe(false);
	});

	test("wipes the loader config on a reset, so the next boot reinstalls it clean", () => {
		expect(survivesReset(UE4SS_SETTINGS)).toBe(false);
		expect(survivesReset(UE4SS_STAMP)).toBe(false);
	});

	test("points the file manager at the mods folder in both languages", () => {
		const notable = manifest.files.notable.find((entry) => entry.match === UE4SS_MODS);

		expect(notable?.label.ar.length).toBeGreaterThan(0);
		expect(notable?.label.en.length).toBeGreaterThan(0);
		expect(notable?.note?.ar).toContain("mods.txt");
		expect(notable?.note?.en).toContain("mods.txt");
	});
});
