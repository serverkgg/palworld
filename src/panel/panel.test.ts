import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeControl, BridgeFormTarget, BridgeLayout } from "@serverkgg/bridge";
import { ANNOUNCE_MESSAGE_LENGTH } from "../shared";
import { panel } from "./panel";

const sections = panel.tabs.flatMap((tab) => tab.sections);

const fieldsOf = (section: Bridge.Section): Bridge.Field[] => {
	if (section.layout === BridgeLayout.Form) {
		return section.fields;
	}

	if (section.layout === BridgeLayout.Actions) {
		return section.actions.flatMap((action) => action.fields ?? []);
	}

	return [];
};

const forms = sections.flatMap((section) => {
	return section.layout === BridgeLayout.Form
		? [
				section,
			]
		: [];
});

const fields = sections.flatMap(fieldsOf);

const fieldNamed = (key: string) => {
	return fields.find((field) => field.key === key);
};

const optionsOf = (field: Bridge.Field | undefined): Bridge.Option[] => {
	const options = field?.options;

	return Array.isArray(options) ? options : [];
};

const MAX_PLAYERS = (
	Bun.YAML.parse(await Bun.file(new URL("../../serverk.yml", import.meta.url)).text()) as {
		resources: {
			maxRecommendedPlayers: number;
		};
	}
).resources.maxRecommendedPlayers;

describe("laying out the palworld panel", () => {
	test("gives every tab a unique id", () => {
		const ids = panel.tabs.map((tab) => tab.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	test("gives every section a unique id", () => {
		const ids = sections.map((section) => section.id);

		expect(new Set(ids).size).toBe(ids.length);
	});

	test("titles every tab in both arabic and english", () => {
		for (const tab of panel.tabs) {
			expect(tab.title.ar.length).toBeGreaterThan(0);
			expect(tab.title.en.length).toBeGreaterThan(0);
		}
	});

	test("writes the settings form into PalWorldSettings.ini through the settings module", () => {
		expect(forms.at(0)?.target).toBe(BridgeFormTarget.Settings);
		expect(forms.at(0)?.module).toBe("settings");
	});

	test("tells the player that a settings change needs a restart", () => {
		expect(forms.at(0)?.restartHint).toBe(true);
	});
});

describe("the fields the panel renders for palworld settings", () => {
	test("labels every field in both arabic and english", () => {
		for (const field of fields) {
			expect(field.label.ar.length).toBeGreaterThan(0);
			expect(field.label.en.length).toBeGreaterThan(0);
		}
	});

	test("gives every field a unique key, so one setting cannot shadow another", () => {
		const keys = fields.map((field) => field.key);

		expect(new Set(keys).size).toBe(keys.length);
	});

	test("keeps every range the right way round", () => {
		for (const field of fields) {
			if (field.min !== undefined && field.max !== undefined) {
				expect(field.max).toBeGreaterThan(field.min);
			}
		}
	});

	test("only bounds numeric fields", () => {
		for (const field of fields) {
			if (field.min !== undefined || field.max !== undefined || field.step !== undefined) {
				expect(field.control).toBe(BridgeControl.Number);
			}
		}
	});

	test("keeps every text limit positive", () => {
		for (const field of fields) {
			if (field.maxLength !== undefined) {
				expect(field.maxLength).toBeGreaterThan(0);
			}
		}
	});

	test("stops the player at the slot count the manifest advertises", () => {
		expect(fieldNamed("ServerPlayerMaxNum")?.max).toBe(MAX_PLAYERS);
		expect(fieldNamed("ServerPlayerMaxNum")?.min).toBe(1);
	});

	test("never lets a rate be set to zero, which would freeze progression", () => {
		for (const key of [
			"ExpRate",
			"PalCaptureRate",
		]) {
			expect(fieldNamed(key)?.min).toBeGreaterThan(0);
		}
	});

	test("offers the four death penalties palworld understands, each only once", () => {
		const values = optionsOf(fieldNamed("DeathPenalty")).map((option) => option.value);

		expect(values).toEqual([
			"None",
			"Item",
			"ItemAndEquipment",
			"All",
		]);
		expect(new Set(values).size).toBe(values.length);
	});

	test("labels every choice in both arabic and english", () => {
		for (const field of fields) {
			for (const option of optionsOf(field)) {
				expect(option.label.ar.length).toBeGreaterThan(0);
				expect(option.label.en.length).toBeGreaterThan(0);
			}
		}
	});

	test("only offers choices on a select", () => {
		for (const field of fields) {
			if (optionsOf(field).length > 0) {
				expect(field.control).toBe(BridgeControl.Select);
			}
		}
	});

	test("warns the player before hardcore, where a death is permanent", () => {
		expect(fieldNamed("bHardcore")?.warning?.ar.length).toBeGreaterThan(0);
		expect(fieldNamed("bHardcore")?.warning?.en.length).toBeGreaterThan(0);
	});

	test("advertises the same announce limit the driver enforces", () => {
		expect(fieldNamed("message")?.maxLength).toBe(ANNOUNCE_MESSAGE_LENGTH);
	});
});
