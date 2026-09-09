import { describe, expect, test } from "bun:test";
import { type Bridge, BridgeDetailTone } from "@serverkgg/bridge";
import { UE4SS_LIBRARY, UE4SS_LOG, UE4SS_MODS_LIST, UE4SS_SETTINGS, UE4SS_STAMP, UE4SS_VERSION } from "../ue4ss";
import { ue4ss } from "./ue4ss";

const BOOT = [
	"[14:22:01] UE4SS - v3.0.1 - Git SHA #4bf136e",
	"[14:22:02] Palworld vtable sweep: BeginPlay 0x380 -> 0x388, EndPlay 0x388 -> 0x390",
	"[14:22:03] Starting Lua mod 'BPModLoaderMod'",
].join("\n");

const REFUSED = `${BOOT}\n[14:22:03] Palworld hook validation REFUSED AGameModeBase::InitGameState at 0xa3b5000: no sane prologue (game updated? hook left disabled)`;

const context = (enabled: boolean, files: Record<string, string>) => {
	return {
		variable(key: string) {
			return key === "UE4SS_ENABLED" && enabled ? "true" : null;
		},
		files: {
			async exists(path: string) {
				return Object.hasOwn(files, path);
			},
			async read(path: string) {
				return files[path] ?? "";
			},
			async size(path: string) {
				return (files[path] ?? "").length;
			},
		},
	} as unknown as Bridge.Context;
};

const INSTALLED = {
	[UE4SS_LIBRARY]: "",
	[UE4SS_SETTINGS]: "",
	[UE4SS_STAMP]: `{"version":"${UE4SS_VERSION}"}`,
	[UE4SS_MODS_LIST]: "BPModLoaderMod : 1\nActorDumperMod : 0\n",
};

const badgeLabels = (detail: Bridge.DetailResult | null) => {
	return (detail?.badges ?? []).map((badge) => badge.label.ar);
};

const statOf = (detail: Bridge.DetailResult | null, key: string) => {
	return (detail?.stats ?? []).find((stat) => stat.key === key)?.value;
};

describe("the ue4ss card when nothing has ever happened", () => {
	test("says nothing at all, so the panel shows its empty line instead", async () => {
		expect(await ue4ss.read(context(false, {}))).toBeNull();
	});
});

describe("the ue4ss card before the server has run once", () => {
	test("says it is installed and switched on, and that no log was written yet", async () => {
		const detail = await ue4ss.read(context(true, INSTALLED));

		expect(badgeLabels(detail)).toEqual([
			"مركّب",
			"شغّال مع السيرفر",
			"ما كتب UE4SS ملف اللوق بعد",
		]);
		expect(statOf(detail, "version")).toBe(UE4SS_VERSION);
		expect(statOf(detail, "mods")).toBe(1);
		expect(statOf(detail, "refused")).toBe(0);
	});

	test("says it is not installed while the switch is still off", async () => {
		const detail = await ue4ss.read(
			context(false, {
				[UE4SS_LOG]: BOOT,
			}),
		);

		expect(badgeLabels(detail)).toEqual([
			"مو مركّب",
			"محمّل",
		]);
	});
});

describe("the ue4ss card before ue4ss wrote its log", () => {
	test("never claims it is loaded, it says the log is still missing", async () => {
		const detail = await ue4ss.read(context(true, INSTALLED));

		expect(badgeLabels(detail)).not.toContain("محمّل");
		expect((detail?.badges ?? []).at(-1)?.tone).toBe(BridgeDetailTone.Neutral);
	});
});

describe("the ue4ss card after the server booted", () => {
	test("says it loaded when the log carries the banner", async () => {
		const detail = await ue4ss.read(
			context(true, {
				...INSTALLED,
				[UE4SS_LOG]: BOOT,
			}),
		);

		expect(badgeLabels(detail)).toContain("محمّل");
		expect((detail?.badges ?? []).at(-1)?.tone).toBe(BridgeDetailTone.Success);
	});

	test("warns instead when a game update left a hook refused, and counts it", async () => {
		const detail = await ue4ss.read(
			context(true, {
				...INSTALLED,
				[UE4SS_LOG]: REFUSED,
			}),
		);

		expect(badgeLabels(detail)).toContain("هوك مرفوض بعد التحديث");
		expect((detail?.badges ?? []).at(-1)?.tone).toBe(BridgeDetailTone.Warning);
		expect(statOf(detail, "refused")).toBe(1);
	});

	test("falls back to the version the log reports when no stamp survived", async () => {
		const detail = await ue4ss.read(
			context(true, {
				[UE4SS_LIBRARY]: "",
				[UE4SS_SETTINGS]: "",
				[UE4SS_LOG]: BOOT,
			}),
		);

		expect(statOf(detail, "version")).toBe("3.0.1");
	});
});

describe("what the ue4ss card promises the owner", () => {
	test("says in both languages that this is a community port an update can break", async () => {
		const detail = await ue4ss.read(context(true, INSTALLED));

		expect(detail?.description).not.toBeNull();
		expect(detail?.subtitle).not.toBeNull();
	});

	test("links to the project page, so the owner can read the port for themselves", async () => {
		const detail = await ue4ss.read(context(true, INSTALLED));

		expect(detail?.links.at(0)?.url).toBe("https://github.com/BlackBookOfficial/ue4ss-linux-palworld");
	});

	test("offers no action of its own, because the switch is the only control", async () => {
		expect((await ue4ss.read(context(true, INSTALLED)))?.actions).toEqual([]);
		expect(ue4ss.actions).toBeUndefined();
	});

	test("reads without the server running, and refreshes on its own", () => {
		expect(ue4ss.requiresRunning).toBe(false);
		expect(ue4ss.refreshSeconds).toBe(30);
	});
});
