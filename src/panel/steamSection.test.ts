import { describe, expect, it } from "bun:test";
import { BridgeControl, BridgeFormTarget, BridgeLayout } from "@serverkgg/bridge";
import { EDITION_VARIABLE, PalworldEdition, WINDOWS_STEAM_VARIABLE } from "../shared";
import { panel } from "./panel";
import { STEAM_SECTION, steamSection } from "./steamSection";

describe("the steam switch on the windows edition", () => {
	it("is a boolean variable the owner sets, on by default, which restarts the server without a reinstall", () => {
		expect(steamSection.layout).toBe(BridgeLayout.Form);

		if (steamSection.layout !== BridgeLayout.Form) {
			return;
		}

		expect(steamSection.target).toBe(BridgeFormTarget.Variables);
		expect(steamSection.reinstall).toBe(false);
		expect(
			steamSection.fields.map((field) => [
				field.key,
				field.control,
				field.default,
			]),
		).toEqual([
			[
				WINDOWS_STEAM_VARIABLE,
				BridgeControl.Boolean,
				"true",
			],
		]);
	});

	it("shows only on the windows edition, since linux always runs with steam", () => {
		expect(steamSection.visibleWhen).toEqual({
			variable: EDITION_VARIABLE,
			values: [
				PalworldEdition.Windows,
			],
		});
	});

	it("closes the settings tab, and stays out of the mods tab", () => {
		const idsOf = (tabId: string) => {
			return panel.tabs.find((tab) => tab.id === tabId)?.sections.map((section) => section.id) ?? [];
		};

		expect(idsOf("settings").at(-1)).toBe(STEAM_SECTION);
		expect(idsOf("mods")).not.toContain(STEAM_SECTION);
	});
});
