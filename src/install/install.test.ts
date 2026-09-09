import { describe, expect, test } from "bun:test";
import { INSTALL_STAMP_FILE } from "@serverkgg/bridge/install";
import { STEAM_DIRECTORY, STEAMCMD_DIRECTORY } from "@serverkgg/bridge/steam";
import { compileGlobs, matchesAny } from "@serverkgg/bridge/utils";
import { GAME_ROOTS } from "../shared";

interface Manifest {
	reset: {
		keep: string[];
	};
	files: {
		protected: string[];
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
