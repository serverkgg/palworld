import { describe, expect, test } from "bun:test";
import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeLayout,
	BridgePlace,
} from "@serverkgg/bridge";
import type { BridgeSection } from "@serverkgg/bridge/protocol";
import { RCON_ACCESS_MODULE, RCON_ACCESS_VARIABLE } from "@serverkgg/bridge/rcon";
import {
	ANNOUNCE_MESSAGE_LENGTH,
	CROSSPLAY_MAC_KEY,
	CROSSPLAY_PS5_KEY,
	CROSSPLAY_XBOX_KEY,
	SETTINGS_FIELDS,
	settingsFieldOf,
} from "../shared";
import { panel } from "./panel";

const placeOf = (section: BridgeSection | null | undefined) => {
	return section && "place" in section ? section.place : undefined;
};

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

const tableNamed = (id: string) => {
	const section = sections.find((entry) => entry.id === id);

	return section?.layout === BridgeLayout.Table ? section : null;
};

const DEFAULT_SETTINGS_KEYS = [
	"Difficulty",
	"RandomizerType",
	"RandomizerSeed",
	"bIsRandomizerPalLevelRandom",
	"DayTimeSpeedRate",
	"NightTimeSpeedRate",
	"ExpRate",
	"PalCaptureRate",
	"PalSpawnNumRate",
	"PalDamageRateAttack",
	"PalDamageRateDefense",
	"PlayerDamageRateAttack",
	"PlayerDamageRateDefense",
	"PlayerStomachDecreaceRate",
	"PlayerStaminaDecreaceRate",
	"PlayerAutoHPRegeneRate",
	"PlayerAutoHpRegeneRateInSleep",
	"PalStomachDecreaceRate",
	"PalStaminaDecreaceRate",
	"PalAutoHPRegeneRate",
	"PalAutoHpRegeneRateInSleep",
	"BuildObjectHpRate",
	"BuildObjectDamageRate",
	"BuildObjectDeteriorationDamageRate",
	"CollectionDropRate",
	"CollectionObjectHpRate",
	"CollectionObjectRespawnSpeedRate",
	"EnemyDropItemRate",
	"DeathPenalty",
	"bEnablePlayerToPlayerDamage",
	"bEnableFriendlyFire",
	"bEnableInvaderEnemy",
	"bActiveUNKO",
	"bEnableAimAssistPad",
	"bEnableAimAssistKeyboard",
	"DropItemMaxNum",
	"PhysicsActiveDropItemMaxNum",
	"DropItemMaxNum_UNKO",
	"BaseCampMaxNum",
	"BaseCampWorkerMaxNum",
	"DropItemAliveMaxHours",
	"bAutoResetGuildNoOnlinePlayers",
	"AutoResetGuildTimeNoOnlinePlayers",
	"GuildPlayerMaxNum",
	"BaseCampMaxNumInGuild",
	"PalEggDefaultHatchingTime",
	"WorkSpeedRate",
	"AutoSaveSpan",
	"bIsMultiplay",
	"bIsPvP",
	"bHardcore",
	"bPalLost",
	"bCharacterRecreateInHardcore",
	"bCanPickupOtherGuildDeathPenaltyDrop",
	"bEnableNonLoginPenalty",
	"bEnableFastTravel",
	"bEnableFastTravelOnlyBaseCamp",
	"bIsStartLocationSelectByMap",
	"bExistPlayerAfterLogout",
	"bEnableDefenseOtherGuildPlayer",
	"bInvisibleOtherGuildBaseCampAreaFX",
	"bBuildAreaLimit",
	"ItemWeightRate",
	"CoopPlayerMaxNum",
	"ServerPlayerMaxNum",
	"ServerName",
	"ServerDescription",
	"AdminPassword",
	"ServerPassword",
	"bAllowClientMod",
	"PublicPort",
	"PublicIP",
	"RCONEnabled",
	"RCONPort",
	"Region",
	"bUseAuth",
	"BanListURL",
	"RESTAPIEnabled",
	"RESTAPIPort",
	"bShowPlayerList",
	"ChatPostLimitPerMinute",
	"CrossplayPlatforms",
	"bIsUseBackupSaveData",
	"LogFormatType",
	"bIsShowJoinLeftMessage",
	"SupplyDropSpan",
	"EnablePredatorBossPal",
	"MaxBuildingLimitNum",
	"MaxBuildingLimitNumPerPlayer",
	"ServerReplicatePawnCullDistance",
	"bAllowGlobalPalboxExport",
	"bAllowGlobalPalboxImport",
	"EquipmentDurabilityDamageRate",
	"ItemContainerForceMarkDirtyInterval",
	"PlayerDataPalStorageUpdateCheckTickInterval",
	"ItemCorruptionMultiplier",
	"MonsterFarmActionSpeedRate",
	"FishingDifficultyRate",
	"DenyTechnologyList",
	"GuildRejoinCooldownMinutes",
	"AutoTransferMasterCheckIntervalSeconds",
	"AutoTransferMasterThresholdDays",
	"MaxGuildsPerFrame",
	"BlockRespawnTime",
	"RespawnPenaltyDurationThreshold",
	"RespawnPenaltyTimeScale",
	"bDisplayPvPItemNumOnWorldMap_BaseCamp",
	"bDisplayPvPItemNumOnWorldMap_Player",
	"AdditionalDropItemWhenPlayerKillingInPvPMode",
	"AdditionalDropItemNumWhenPlayerKillingInPvPMode",
	"bAdditionalDropItemWhenPlayerKillingInPvPMode",
	"bEnableVoiceChat",
	"VoiceChatMaxVolumeDistance",
	"VoiceChatZeroVolumeDistance",
	"bAllowEnhanceStat_Health",
	"bAllowEnhanceStat_Attack",
	"bAllowEnhanceStat_Stamina",
	"bAllowEnhanceStat_Weight",
	"bAllowEnhanceStat_WorkSpeed",
	"bEnableBuildingPlayerUIdDisplay",
	"BuildingNameDisplayCacheTTLSeconds",
	"bAllowEnemyCampSpawnNearBaseCamp",
];

const CROSSPLAY_VIRTUALS = [
	CROSSPLAY_XBOX_KEY,
	CROSSPLAY_PS5_KEY,
	CROSSPLAY_MAC_KEY,
];

const settingsSections = (panel.tabs.find((tab) => tab.id === "settings")?.sections ?? []).flatMap((section) => {
	return section.layout === BridgeLayout.Form
		? [
				section,
			]
		: [];
});

const settingsFields = settingsSections.flatMap((section) => section.fields);

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

	test("puts remote access with the controls, as a variable toggle beside its detail card", () => {
		const controls = panel.tabs.find((tab) => tab.id === "controls");
		const toggle = controls?.sections.find((section) => section.layout === BridgeLayout.Form);
		const detail = controls?.sections.find((section) => {
			return section.layout === BridgeLayout.Detail && section.module === RCON_ACCESS_MODULE;
		});

		expect(toggle?.layout === BridgeLayout.Form && toggle.target).toBe(BridgeFormTarget.Variables);
		expect(fieldNamed(RCON_ACCESS_VARIABLE)?.control).toBe(BridgeControl.Boolean);
		expect(detail?.layout === BridgeLayout.Detail && detail.module).toBe(RCON_ACCESS_MODULE);
	});
});

describe("showing the owner who is on the server right now", () => {
	test("shows the player, their store account, the store itself, their level and their ping", () => {
		expect(tableNamed("online")?.columns.map((column) => column.key)).toEqual([
			"name",
			"account",
			"platform",
			"level",
			"ping",
		]);
	});

	test("labels every online column in both arabic and english", () => {
		for (const column of tableNamed("online")?.columns ?? []) {
			expect(column.label.ar.length).toBeGreaterThan(0);
			expect(column.label.en.length).toBeGreaterThan(0);
		}
	});

	test("keeps the kick and the ban on the row, and asks harder before a ban", () => {
		expect(tableNamed("online")?.actions?.map((action) => action.id)).toEqual([
			"kick",
			"ban",
		]);
		expect(tableNamed("online")?.actions?.at(0)?.confirm).toBe(BridgeConfirm.Normal);
		expect(tableNamed("online")?.actions?.at(1)?.confirm).toBe(BridgeConfirm.Strong);
	});

	test("renders the roster on the platform players page instead of a second players entry", () => {
		expect(placeOf(tableNamed("online"))).toBe(BridgePlace.Players);
	});

	test("keeps the ban on a player who already left, and the kick only on one who is still in", () => {
		expect(tableNamed("online")?.actions?.at(0)?.offline).toBeUndefined();
		expect(tableNamed("online")?.actions?.at(1)?.offline).toBe(true);
	});
});

describe("giving the owner a way back from a ban", () => {
	test("puts the ban list beside the online list, on the players tab", () => {
		const players = panel.tabs.find((tab) => tab.id === "players");

		expect(players?.sections.map((section) => section.id)).toEqual([
			"online",
			"bans",
		]);
	});

	test("puts the ban list under the roster, on the same platform players page", () => {
		expect(placeOf(tableNamed("bans"))).toBe(BridgePlace.Players);
	});

	test("places every section of the players tab, so the sidebar never shows the noun twice", () => {
		const players = panel.tabs.find((tab) => tab.id === "players");

		expect(players?.sections.every((section) => placeOf(section) === BridgePlace.Players)).toBe(true);
	});

	test("titles both tables, so two lists on one tab are never confused", () => {
		for (const id of [
			"online",
			"bans",
		]) {
			expect(tableNamed(id)?.title?.ar.length).toBeGreaterThan(0);
			expect(tableNamed(id)?.title?.en.length).toBeGreaterThan(0);
		}
	});

	test("labels every ban column in both arabic and english", () => {
		for (const column of tableNamed("bans")?.columns ?? []) {
			expect(column.label.ar.length).toBeGreaterThan(0);
			expect(column.label.en.length).toBeGreaterThan(0);
		}
	});

	test("lets the owner ban an id that never showed up on the roster", () => {
		expect(tableNamed("bans")?.add?.label.ar.length).toBeGreaterThan(0);
		expect(tableNamed("bans")?.add?.label.en.length).toBeGreaterThan(0);
		expect(tableNamed("bans")?.add?.placeholder).toContain("steam_");
	});

	test("offers exactly one row action, and only asks once before lifting a ban", () => {
		expect(tableNamed("bans")?.actions?.map((action) => action.id)).toEqual([
			"remove",
		]);
		expect(tableNamed("bans")?.actions?.at(0)?.confirm).toBe(BridgeConfirm.Normal);
	});

	test("explains an empty ban list in both arabic and english", () => {
		expect(tableNamed("bans")?.empty?.ar.length).toBeGreaterThan(0);
		expect(tableNamed("bans")?.empty?.en.length).toBeGreaterThan(0);
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

	test("never lets a rate go negative, and never caps how high the owner takes it", () => {
		for (const key of [
			"ExpRate",
			"PalCaptureRate",
		]) {
			expect(fieldNamed(key)?.min).toBe(0);
			expect(fieldNamed(key)?.max).toBeUndefined();
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

describe("opening the rest of PalWorldSettings.ini to the owner", () => {
	test("writes every settings section through the settings module, behind a restart hint", () => {
		for (const section of settingsSections) {
			expect(section.target).toBe(BridgeFormTarget.Settings);
			expect(section.module).toBe("settings");
			expect(section.restartHint).toBe(true);
		}
	});

	test("groups the settings into the five sections, world first", () => {
		expect(settingsSections.map((section) => section.id)).toEqual([
			"world",
			"community",
			"rules",
			"rates",
			"bases",
		]);
	});

	test("titles every settings section in both arabic and english", () => {
		for (const section of settingsSections) {
			expect(section.title?.ar.length).toBeGreaterThan(0);
			expect(section.title?.en.length).toBeGreaterThan(0);
		}
	});

	test("says in one sentence what every settings section controls, in both arabic and english", () => {
		for (const section of settingsSections) {
			expect(section.help?.ar.length).toBeGreaterThan(0);
			expect(section.help?.en.length).toBeGreaterThan(0);
			expect(section.help?.ar.split(".").length).toBe(2);
			expect(section.help?.en.split(".").length).toBe(2);
		}
	});

	test("keeps the world section on the five fields the setup step names", () => {
		expect(settingsSections.at(0)?.fields.map((field) => field.key)).toEqual([
			"ServerName",
			"ServerDescription",
			"ServerPassword",
			"AdminPassword",
			"ServerPlayerMaxNum",
		]);
	});

	test("stays under the 32 fields the bridge lets one form carry", () => {
		for (const section of settingsSections) {
			expect(section.fields.length).toBeLessThanOrEqual(32);
		}
	});

	test("declares only keys palworld's own defaults carry, or a crossplay toggle the module owns", () => {
		for (const field of settingsFields) {
			expect([
				...DEFAULT_SETTINGS_KEYS,
				...CROSSPLAY_VIRTUALS,
			]).toContain(field.key);
		}
	});

	test("renders exactly the keys the settings table declares, in the same order", () => {
		expect(settingsFields.map((field) => field.key)).toEqual(SETTINGS_FIELDS.map((field) => field.key));
	});

	test("renders the very field objects the write validates against, so the two cannot drift", () => {
		for (const field of settingsFields) {
			expect(settingsFieldOf(field.key)).toBe(field);
		}
	});

	test("offers only choices the settings table declares", () => {
		for (const field of settingsFields) {
			for (const option of optionsOf(field)) {
				expect(optionsOf(settingsFieldOf(field.key) ?? undefined).map((entry) => entry.value)).toContain(option.value);
			}
		}
	});

	test("floors every settings number, and keeps a ceiling above its floor where it has one", () => {
		for (const field of settingsFields) {
			if (field.control === BridgeControl.Number) {
				expect(typeof field.min).toBe("number");

				if (field.max !== undefined) {
					expect(field.max).toBeGreaterThan(field.min ?? 0);
				}
			}
		}
	});

	test("hides a field behind another field of its own section, which is what a settings form can resolve", () => {
		for (const section of settingsSections) {
			const keys = section.fields.map((field) => field.key);

			for (const field of section.fields) {
				if (field.visibleWhen) {
					expect(keys).toContain(field.visibleWhen.variable);
				}
			}
		}
	});

	test("shows the guild reset window only while the automatic reset is on", () => {
		expect(fieldNamed("AutoResetGuildTimeNoOnlinePlayers")?.visibleWhen).toEqual({
			variable: "bAutoResetGuildNoOnlinePlayers",
			values: [
				"true",
			],
		});
	});

	test("shows the randomizer details only while the randomizer is on", () => {
		for (const key of [
			"bIsRandomizerPalLevelRandom",
			"RandomizerSeed",
		]) {
			expect(fieldNamed(key)?.visibleWhen).toEqual({
				variable: "RandomizerType",
				values: [
					"Region",
					"All",
				],
			});
		}
	});

	test("opens crossplay as three toggles, because the ini keeps one tuple", () => {
		for (const key of CROSSPLAY_VIRTUALS) {
			expect(fieldNamed(key)?.control).toBe(BridgeControl.Boolean);
		}
	});

	test("says once that steam always gets in, so nobody looks for a steam toggle", () => {
		expect(fieldNamed(CROSSPLAY_XBOX_KEY)?.help?.ar).toContain("Steam");
		expect(fieldNamed(CROSSPLAY_XBOX_KEY)?.help?.en).toContain("Steam");
	});
});

const healthSection = (panel.tabs.find((tab) => tab.id === "controls")?.sections ?? []).find((section) => {
	return section.id === "health";
});

describe("opening the controls tab on how the world is actually running", () => {
	test("puts the health card above the quick actions, where the owner looks first", () => {
		expect(panel.tabs.find((tab) => tab.id === "controls")?.sections.at(0)?.id).toBe("health");
	});

	test("renders the live numbers on the overview, beside the cpu and the memory", () => {
		expect(placeOf(healthSection)).toBe(BridgePlace.Overview);
	});

	test("keeps the quick actions and remote access on the controls tab, so it stays in the sidebar", () => {
		const controls = panel.tabs.find((tab) => tab.id === "controls");

		expect(controls?.sections.some((section) => placeOf(section) === undefined)).toBe(true);
	});

	test("reads it from the health detail module", () => {
		expect(healthSection?.layout).toBe(BridgeLayout.Detail);
		expect(healthSection?.layout === BridgeLayout.Detail && healthSection.module).toBe("health");
	});

	test("titles it in both arabic and english", () => {
		expect(healthSection?.title?.ar.length).toBeGreaterThan(0);
		expect(healthSection?.title?.en.length).toBeGreaterThan(0);
	});

	test("says in both languages what an unreachable server looks like", () => {
		expect(healthSection?.layout === BridgeLayout.Detail && healthSection.empty?.ar.length).toBeGreaterThan(0);
		expect(healthSection?.layout === BridgeLayout.Detail && healthSection.empty?.en.length).toBeGreaterThan(0);
	});
});
