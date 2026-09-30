import { describe, expect, test } from "bun:test";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { installedActivity, settingsAppliedActivity, updatedActivity } from "./palworldActivity";

describe("the entries the install reports on its own", () => {
	test("names the steam builds an update moved between", () => {
		expect(updatedActivity("18000001", "18000002")).toEqual({
			name: BridgeEventName.ServerUpdated,
			text: {
				ar: "تم تحديث بالورلد من البيلد 18000001 إلى 18000002",
				en: "Updated Palworld from build 18000001 to 18000002",
			},
			details: {
				from: "18000001",
				to: "18000002",
			},
		});
	});

	test("names the build a first install landed on", () => {
		expect(installedActivity("18000002")).toEqual({
			name: BridgeEventName.GameInstalled,
			text: {
				ar: "تم تثبيت بالورلد (البيلد 18000002)",
				en: "Installed Palworld (build 18000002)",
			},
			details: {
				build: "18000002",
			},
		});
	});

	test("still reports a first install steam gave no build for", () => {
		expect(installedActivity(null)).toEqual({
			name: BridgeEventName.GameInstalled,
			text: {
				ar: "تم تثبيت بالورلد",
				en: "Installed Palworld",
			},
		});
	});

	test("lists the settings that landed by key, and counts them", () => {
		expect(
			settingsAppliedActivity([
				"ExpRate",
				"ServerName",
			]).details,
		).toEqual({
			keys: "ExpRate,ServerName",
			count: 2,
		});
	});
});
