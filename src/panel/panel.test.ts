import { describe, expect, test } from "bun:test";
import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
} from "@serverkgg/bridge";
import { RCON_ACCESS_MODULE, RCON_ACCESS_VARIABLE } from "@serverkgg/bridge/rcon";
import {
	ANNOUNCE_MESSAGE_LENGTH,
	CROSSPLAY_MAC_KEY,
	CROSSPLAY_PS5_KEY,
	CROSSPLAY_XBOX_KEY,
	SETTINGS_FIELDS,
	settingsFieldOf,
} from "../shared";
import { UE4SS_MOD_STAGING, UE4SS_VARIABLE } from "../ue4ss";
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
});

describe("giving the owner a way back from a ban", () => {
	test("puts the ban list beside the online list, on the players tab", () => {
		const players = panel.tabs.find((tab) => tab.id === "players");

		expect(players?.sections.map((section) => section.id)).toEqual([
			"online",
			"bans",
		]);
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

const modsTab = panel.tabs.find((tab) => tab.id === "mods");

const modsSection = (id: string) => {
	return (modsTab?.sections ?? []).find((section) => section.id === id) ?? null;
};

describe("giving palworld a mods tab the owner drives from one switch", () => {
	test("puts the mods tab last, behind the puzzle icon", () => {
		expect(panel.tabs.at(-1)?.id).toBe("mods");
		expect(modsTab?.icon).toBe(BridgeIcon.Puzzle);
		expect(modsTab?.title.ar.length).toBeGreaterThan(0);
		expect(modsTab?.title.en.length).toBeGreaterThan(0);
	});

	test("reads the loader card above the switch, where the owner looks first", () => {
		expect(modsTab?.sections.map((section) => section.id)).toEqual([
			"ue4ss",
			"loader",
			"lua-mods",
		]);
	});

	test("draws the card from the ue4ss detail module and explains an empty one", () => {
		const card = modsSection("ue4ss");

		expect(card?.layout).toBe(BridgeLayout.Detail);
		expect(card?.layout === BridgeLayout.Detail && card.module).toBe("ue4ss");
		expect(card?.layout === BridgeLayout.Detail && card.empty?.ar.length).toBeGreaterThan(0);
		expect(card?.layout === BridgeLayout.Detail && card.empty?.en.length).toBeGreaterThan(0);
	});

	test("offers one boolean, stored as a variable the installer reads", () => {
		const form = modsSection("loader");

		expect(form?.layout).toBe(BridgeLayout.Form);
		expect(form?.layout === BridgeLayout.Form && form.target).toBe(BridgeFormTarget.Variables);
		expect(form?.layout === BridgeLayout.Form && form.fields.map((field) => field.key)).toEqual([
			UE4SS_VARIABLE,
		]);
		expect(fieldNamed(UE4SS_VARIABLE)?.control).toBe(BridgeControl.Boolean);
	});

	test("needs no settings module, because the form writes a variable", () => {
		const form = modsSection("loader");

		expect(form?.layout === BridgeLayout.Form && form.module).toBeUndefined();
	});

	test("restarts the container instead of reinstalling it, so the world is never touched", () => {
		const form = modsSection("loader");

		expect(form?.layout === BridgeLayout.Form && form.restartHint).toBe(true);
		expect(form?.layout === BridgeLayout.Form && form.reinstall).toBe(false);
	});

	test("says in both languages what the switch does and what turning it off keeps", () => {
		const help = fieldNamed(UE4SS_VARIABLE)?.help;

		expect(help?.ar).toContain("UE4SS");
		expect(help?.en).toContain("UE4SS");
		expect(help?.ar.length).toBeGreaterThan(0);
		expect(help?.en.length).toBeGreaterThan(0);
	});
});

describe("listing the lua mods on that tab", () => {
	test("draws the table from the collection the driver registers", () => {
		expect(tableNamed("lua-mods")?.module).toBe("ue4ssMods");
		expect(tableNamed("lua-mods")?.restartHint).toBe(true);
	});

	test("shows the mod and whether it is switched on, labelled in both languages", () => {
		expect(tableNamed("lua-mods")?.columns.map((column) => column.key)).toEqual([
			"name",
			"enabled",
		]);

		for (const column of tableNamed("lua-mods")?.columns ?? []) {
			expect(column.label.ar.length).toBeGreaterThan(0);
			expect(column.label.en.length).toBeGreaterThan(0);
		}
	});

	test("takes a zip upload into the staging folder the collection reads back", () => {
		expect(tableNamed("lua-mods")?.upload?.extensions).toEqual([
			"zip",
		]);
		expect(tableNamed("lua-mods")?.upload?.staging).toBe(UE4SS_MOD_STAGING);
		expect(tableNamed("lua-mods")?.upload?.label.ar.length).toBeGreaterThan(0);
		expect(tableNamed("lua-mods")?.upload?.label.en.length).toBeGreaterThan(0);
	});

	test("offers the two row actions the collection implements", () => {
		expect(tableNamed("lua-mods")?.actions?.map((action) => action.id)).toEqual([
			"enable",
			"disable",
		]);
	});

	test("explains an empty mods list in both languages", () => {
		expect(tableNamed("lua-mods")?.empty?.ar.length).toBeGreaterThan(0);
		expect(tableNamed("lua-mods")?.empty?.en.length).toBeGreaterThan(0);
	});
});
