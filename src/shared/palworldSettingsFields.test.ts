import { describe, expect, it } from "bun:test";
import { BridgeControl, BridgeUserError } from "@serverkgg/bridge";
import { CROSSPLAY_MAC_KEY, CROSSPLAY_PS5_KEY, CROSSPLAY_XBOX_KEY } from "./palworldCrossplay";
import { SETTINGS_FIELDS, settingsFieldOf, validateSettingsWrite } from "./palworldSettingsFields";

const messageOf = (write: () => void) => {
	try {
		write();
	} catch (error) {
		return error instanceof BridgeUserError ? error.text : null;
	}

	return null;
};

describe("the one table the panel and the write share", () => {
	it("names every setting once", () => {
		const keys = SETTINGS_FIELDS.map((field) => field.key);

		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every number a floor, so nothing accepts a value the game reads as broken", () => {
		for (const field of SETTINGS_FIELDS) {
			if (field.control === BridgeControl.Number) {
				expect(typeof field.min).toBe("number");
			}
		}
	});

	it("puts a ceiling only where the server itself has one, and above the floor", () => {
		for (const field of SETTINGS_FIELDS) {
			if (field.control === BridgeControl.Number && field.max !== undefined) {
				expect(field.min).toBeLessThan(field.max);
			}
		}
	});

	it("leaves every rate open at the top, because the owner decides how wild his world is", () => {
		for (const key of [
			"ExpRate",
			"PalCaptureRate",
			"PalSpawnNumRate",
			"WorkSpeedRate",
			"ItemWeightRate",
			"EquipmentDurabilityDamageRate",
		]) {
			expect(settingsFieldOf(key)?.max).toBeUndefined();
			expect(settingsFieldOf(key)?.min).toBe(0);
		}
	});

	it("keeps a step on the open rates, so the panel arrows still move by something sane", () => {
		expect(settingsFieldOf("ExpRate")?.step).toBe(0.1);
	});

	it("keeps the limits the server enforces on its own", () => {
		expect(settingsFieldOf("ServerPlayerMaxNum")?.max).toBe(32);
		expect(settingsFieldOf("BaseCampMaxNumInGuild")?.max).toBe(10);
		expect(settingsFieldOf("BaseCampWorkerMaxNum")?.max).toBe(50);
	});

	it("gives every select the choices it accepts", () => {
		for (const field of SETTINGS_FIELDS) {
			if (field.control === BridgeControl.Select) {
				expect(Array.isArray(field.options) && field.options.length).toBeGreaterThan(0);
			}
		}
	});

	it("carries the three crossplay toggles the settings module owns", () => {
		for (const key of [
			CROSSPLAY_XBOX_KEY,
			CROSSPLAY_PS5_KEY,
			CROSSPLAY_MAC_KEY,
		]) {
			expect(settingsFieldOf(key)?.control).toBe(BridgeControl.Boolean);
		}
	});

	it("answers with nothing for a key it does not declare", () => {
		expect(settingsFieldOf("PublicIP")).toBeNull();
	});
});

describe("checking a settings write before it reaches the ini", () => {
	it("passes a partial write through, because the form only sends what changed", () => {
		expect(
			validateSettingsWrite({
				ExpRate: 2.5,
			}),
		).toEqual({
			ExpRate: 2.5,
		});
	});

	it("refuses a key the panel never offered", () => {
		expect(() => {
			validateSettingsWrite({
				RESTAPIEnabled: false,
			});
		}).toThrow(BridgeUserError);
	});

	it("names the key it refused, so the owner knows which one", () => {
		const text = messageOf(() => {
			validateSettingsWrite({
				RESTAPIEnabled: false,
			});
		});

		expect(text?.ar).toContain("RESTAPIEnabled");
		expect(text?.en).toContain("RESTAPIEnabled");
	});

	it("parses a number the codec handed back as a string", () => {
		expect(
			validateSettingsWrite({
				ExpRate: "3.000000",
			}),
		).toEqual({
			ExpRate: 3,
		});
	});

	it("takes a rate far above anything the game client offers", () => {
		expect(
			validateSettingsWrite({
				ExpRate: 5000,
			}),
		).toEqual({
			ExpRate: 5000,
		});
	});

	it("takes a rate barely above zero, because a crawl is a real choice", () => {
		expect(
			validateSettingsWrite({
				ExpRate: 0.000_01,
			}),
		).toEqual({
			ExpRate: 0.000_01,
		});
	});

	it("refuses a negative rate, which is the one number the game cannot read", () => {
		expect(() => {
			validateSettingsWrite({
				ExpRate: -1,
			});
		}).toThrow(BridgeUserError);
	});

	it("names the floor of a field that has no ceiling, in both languages", () => {
		const text = messageOf(() => {
			validateSettingsWrite({
				ExpRate: -1,
			});
		});

		expect(text?.ar).toContain("مضاعف الخبرة");
		expect(text?.ar).toContain("0 أو أكثر");
		expect(text?.en).toContain("EXP rate");
		expect(text?.en).toContain("0 or more");
	});

	it("refuses more players than the server can hold", () => {
		expect(() => {
			validateSettingsWrite({
				ServerPlayerMaxNum: 64,
			});
		}).toThrow(BridgeUserError);
	});

	it("refuses a guild with no room for anyone in it", () => {
		expect(() => {
			validateSettingsWrite({
				GuildPlayerMaxNum: 0,
			});
		}).toThrow(BridgeUserError);
	});

	it("names the field and the range it refused, in both languages", () => {
		const text = messageOf(() => {
			validateSettingsWrite({
				ServerPlayerMaxNum: 64,
			});
		});

		expect(text?.ar).toContain("أقصى عدد لاعبين");
		expect(text?.ar).toContain("32");
		expect(text?.en).toContain("Max players");
		expect(text?.en).toContain("32");
	});

	it("refuses something that is not a number at all", () => {
		expect(() => {
			validateSettingsWrite({
				ExpRate: "fast",
			});
		}).toThrow(BridgeUserError);
	});

	it("refuses an empty number instead of reading it as zero", () => {
		expect(() => {
			validateSettingsWrite({
				DropItemMaxNum: "",
			});
		}).toThrow(BridgeUserError);
	});

	it("takes a boolean from the form and the string the codec returns", () => {
		expect(
			validateSettingsWrite({
				bIsPvP: true,
				bEnableFastTravel: "false",
				bAllowClientMod: "True",
			}),
		).toEqual({
			bIsPvP: true,
			bEnableFastTravel: false,
			bAllowClientMod: true,
		});
	});

	it("refuses anything else on a toggle", () => {
		expect(() => {
			validateSettingsWrite({
				bIsPvP: 1,
			});
		}).toThrow(BridgeUserError);
	});

	it("takes a choice the select really offers", () => {
		expect(
			validateSettingsWrite({
				DeathPenalty: "ItemAndEquipment",
			}),
		).toEqual({
			DeathPenalty: "ItemAndEquipment",
		});
	});

	it("refuses a choice that is not on the list", () => {
		expect(() => {
			validateSettingsWrite({
				DeathPenalty: "Everything",
			});
		}).toThrow(BridgeUserError);
	});

	it("refuses a randomizer type palworld never declared", () => {
		expect(() => {
			validateSettingsWrite({
				RandomizerType: "Chaos",
			});
		}).toThrow(BridgeUserError);
	});

	it("keeps text inside the limit the field advertises", () => {
		expect(
			validateSettingsWrite({
				ServerName: "سيرفر الأصحاب",
			}),
		).toEqual({
			ServerName: "سيرفر الأصحاب",
		});
	});

	it("refuses text longer than the limit instead of cutting it", () => {
		expect(() => {
			validateSettingsWrite({
				RandomizerSeed: "s".repeat(33),
			});
		}).toThrow(BridgeUserError);
	});

	it("lets a password be emptied, because an open server is a real choice", () => {
		expect(
			validateSettingsWrite({
				ServerPassword: "",
			}),
		).toEqual({
			ServerPassword: "",
		});
	});

	it("refuses a newline in the server name, which would split the line the ini keeps it on", () => {
		expect(() => {
			validateSettingsWrite({
				ServerName: "سيرفر\nAdminPassword=hunted",
			});
		}).toThrow(BridgeUserError);
	});

	it("refuses a carriage return, a tab and a delete the owner could paste in without seeing them", () => {
		for (const raw of [
			"one\rtwo",
			"one\ttwo",
			"one\u007ftwo",
			"one\u0000two",
		]) {
			expect(() => {
				validateSettingsWrite({
					ServerDescription: raw,
				});
			}).toThrow(BridgeUserError);
		}
	});

	it("says in both languages why the hidden character was refused", () => {
		const text = messageOf(() => {
			validateSettingsWrite({
				ServerName: "one\ntwo",
			});
		});

		expect(text?.ar.length ?? 0).toBeGreaterThan(0);
		expect(text?.en.length ?? 0).toBeGreaterThan(0);
	});

	it("keeps every ordinary character, arabic and emoji included", () => {
		expect(
			validateSettingsWrite({
				ServerName: "سيرفر الأصحاب 🔥",
			}),
		).toEqual({
			ServerName: "سيرفر الأصحاب 🔥",
		});
	});
});
