import { describe, expect, test } from "bun:test";
import {
	parseUe4ssStamp,
	UE4SS_BRANCH,
	UE4SS_COMMIT,
	UE4SS_COMMIT_SHA,
	UE4SS_IMAGE_ROOT,
	UE4SS_LAYOUT,
	UE4SS_LIBRARY,
	UE4SS_MODS,
	UE4SS_MODS_LIST,
	UE4SS_PROJECT_URL,
	UE4SS_SETTINGS,
	UE4SS_VERSION,
	ue4ssEnabled,
} from "./ue4ssRelease";

describe("pinning the ue4ss build the image carries", () => {
	test("reads the build out of the image, not off the network", () => {
		expect(UE4SS_IMAGE_ROOT).toBe("/opt/ue4ss");
		expect(UE4SS_IMAGE_ROOT.startsWith("/")).toBe(true);
	});

	test("pins one commit of the branch the linux port lives on", () => {
		expect(UE4SS_BRANCH).toBe("linux-native");
		expect(UE4SS_COMMIT).toMatch(/^[0-9a-f]{7}$/);
		expect(UE4SS_COMMIT_SHA).toMatch(/^[0-9a-f]{40}$/);
		expect(UE4SS_COMMIT_SHA.startsWith(UE4SS_COMMIT)).toBe(true);
	});

	test("names the version after the commit, so a newer pin reinstalls on the next boot", () => {
		expect(UE4SS_VERSION).toBe(`${UE4SS_BRANCH}@${UE4SS_COMMIT}`);
	});

	test("points the panel at the project the port is published from", () => {
		expect(UE4SS_PROJECT_URL).toBe("https://github.com/BlackBookOfficial/ue4ss-linux-palworld");
	});

	test("names the files the image assembles beside the library", () => {
		expect(UE4SS_LIBRARY).toBe("libUE4SS.so");
		expect(UE4SS_SETTINGS).toBe("UE4SS-settings.ini");
		expect(UE4SS_LAYOUT).toBe("MemberVariableLayout.ini");
	});

	test("keeps the mod list inside the mods folder, which is what ue4ss reads", () => {
		expect(UE4SS_MODS_LIST).toBe(`${UE4SS_MODS}/mods.txt`);
	});
});

describe("reading the switch the owner flips", () => {
	test("treats only the string the platform stores for a boolean as on", () => {
		expect(ue4ssEnabled("true")).toBe(true);
		expect(ue4ssEnabled("false")).toBe(false);
		expect(ue4ssEnabled(null)).toBe(false);
		expect(ue4ssEnabled("")).toBe(false);
	});
});

describe("reading the stamp that records what we installed", () => {
	test("reads the version back", () => {
		expect(parseUe4ssStamp(`{"version":"${UE4SS_VERSION}"}`)).toEqual({
			version: UE4SS_VERSION,
		});
	});

	test("answers null for anything that is not a stamp, so a broken file reinstalls", () => {
		for (const contents of [
			"",
			"not json",
			"[]",
			"null",
			"{}",
			'{"version":""}',
			'{"version":3}',
		]) {
			expect(parseUe4ssStamp(contents)).toBeNull();
		}
	});
});
