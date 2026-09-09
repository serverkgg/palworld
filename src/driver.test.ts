import { describe, expect, test } from "bun:test";
import { BridgeControl, BridgeFormTarget, BridgeKind, BridgeLayout, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";
import { PRESENCE_FIELDS_LIMIT, presencePlaceholders } from "@serverkgg/bridge/manifest";
import { isBridgeEventName } from "@serverkgg/bridge/protocol";
import { RCON_ACCESS_MODULE, RCON_ACCESS_PORT, RCON_ACCESS_VARIABLE } from "@serverkgg/bridge/rcon";
import { banRow } from "./collections";
import { driver } from "./driver";
import {
	CROSSPLAY_KEY,
	presenceOf,
	RCON_PORT,
	REST_API_PORT,
	rosterOf,
	settingsFieldOf,
	validateSettingsWrite,
} from "./shared";

interface Manifest {
	container: {
		ports: {
			key: string;
			containerPort: number;
			protocol: string;
			mirror?: boolean;
			activeWhen?: {
				variable: string;
				values: string[];
			}[];
		}[];
	};
	presence: {
		name: string;
		id: string;
		avatar: string;
		fields: {
			key: string;
			label: {
				ar: string;
				en: string;
			};
		}[];
	};
}

const manifest = Bun.YAML.parse(await Bun.file(new URL("../serverk.yml", import.meta.url)).text()) as Manifest;

const modules = driver.modules ?? {};

const sections = (driver.panel?.tabs ?? []).flatMap((tab) => tab.sections);

const tables = sections.flatMap((section) => {
	return section.layout === BridgeLayout.Table
		? [
				section,
			]
		: [];
});

const args = (driver.terminal?.commands ?? [])
	.flatMap((command) => command.args ?? [])
	.filter((arg) => arg.module !== undefined);

const columnsOf = (module: string) => {
	return tables
		.filter((table) => table.module === module)
		.flatMap((table) => table.columns.map((column) => column.key));
};

const ROSTER_ENTRY = rosterOf({
	players: [
		{
			name: "Meslzy",
			accountName: "meslzy",
			userId: "steam_76561198000000001",
			level: 42,
			ping: 31,
			building_count: 7,
		},
	],
}).at(0);

const ROSTER_KEYS = Object.keys(ROSTER_ENTRY ?? {});

const BAN_KEYS = Object.keys(
	banRow(
		{
			userId: "steam_1",
			playerId: null,
		},
		"Meslzy",
	),
);

describe("wiring the terminal autocomplete to the live roster", () => {
	test("completes every argument from a module the driver actually registers", () => {
		for (const arg of args) {
			expect(Object.keys(modules)).toContain(arg.module ?? "");
		}
	});

	test("completes every argument from a column that module's table shows", () => {
		for (const arg of args) {
			expect(columnsOf(arg.module ?? "")).toContain(arg.column ?? "");
		}
	});

	test("completes every argument from a field the roster really carries", () => {
		for (const arg of args) {
			expect(ROSTER_KEYS).toContain(arg.column ?? "");
		}
	});
});

describe("wiring the players table to the roster the collection returns", () => {
	test("shows only columns the roster carries", () => {
		for (const key of columnsOf("players")) {
			expect(ROSTER_KEYS).toContain(key);
		}
	});

	test("shows the account, platform, level and ping the panel promises", () => {
		expect(columnsOf("players")).toEqual([
			"name",
			"account",
			"platform",
			"level",
			"ping",
		]);
	});
});

const PRESENCE = presenceOf({
	...(ROSTER_ENTRY ?? {
		id: "steam_76561198000000001",
		name: "Meslzy",
		account: null,
		platform: "Steam",
		level: null,
		ping: null,
		buildings: null,
		avatarHash: null,
	}),
	avatarHash: "a".repeat(40),
});

describe("keeping the presence the manifest promises and the payload the driver sends together", () => {
	test("names the player and identifies them by keys the payload really carries", () => {
		expect(Object.keys(PRESENCE)).toContain(manifest.presence.name);
		expect(Object.keys(PRESENCE)).toContain(manifest.presence.id);
	});

	test("keeps the ban id as the presence id, so a kick and a ban target the same player", () => {
		expect(PRESENCE[manifest.presence.id as keyof typeof PRESENCE]).toBe(ROSTER_ENTRY?.id);
	});

	test("resolves the steam avatar template from a placeholder the payload fills", () => {
		expect(manifest.presence.avatar).toContain("{avatarHash}");

		for (const placeholder of presencePlaceholders(manifest.presence.avatar)) {
			expect(Object.keys(PRESENCE)).toContain(placeholder);
		}
	});

	test("leads with the account every store gives a player, then the platform, the level and the ping", () => {
		expect(manifest.presence.fields.map((field) => field.key)).toEqual([
			"account",
			"platform",
			"level",
			"ping",
		]);
	});

	test("declares only fields the payload really carries", () => {
		for (const field of manifest.presence.fields) {
			expect(Object.keys(PRESENCE)).toContain(field.key);
		}
	});

	test("labels every presence field in both arabic and english", () => {
		for (const field of manifest.presence.fields) {
			expect(field.label.ar.length).toBeGreaterThan(0);
			expect(field.label.en.length).toBeGreaterThan(0);
		}
	});

	test("stays under the six fields the manifest lets presence carry", () => {
		expect(manifest.presence.fields.length).toBeLessThanOrEqual(PRESENCE_FIELDS_LIMIT);
	});
});

describe("wiring the bans table to the rows the collection returns", () => {
	test("shows only columns a ban row carries", () => {
		for (const key of columnsOf("bans")) {
			expect(BAN_KEYS).toContain(key);
		}
	});

	test("shows the name, the platform and the id the owner needs to recognise a ban", () => {
		expect(columnsOf("bans")).toEqual([
			"player",
			"platform",
			"userId",
		]);
	});

	test("takes the unban id by hand, because a banned player is never on the roster", () => {
		const unban = (driver.terminal?.commands ?? []).find((command) => command.name === "UnBanPlayer");

		expect(unban?.args?.map((arg) => arg.key)).toEqual([
			"userId",
		]);
		expect(unban?.args?.at(0)?.module).toBeUndefined();
		expect(unban?.args?.at(0)?.column).toBeUndefined();
	});
});

const steps = driver.setup?.steps ?? [];

const formSection = (tabId: string, sectionId: string) => {
	const tab = (driver.panel?.tabs ?? []).find((entry) => entry.id === tabId);
	const section = tab?.sections.find((entry) => entry.id === sectionId);

	return section?.layout === BridgeLayout.Form ? section : null;
};

const fieldOf = (tabId: string, sectionId: string, key: string) => {
	return formSection(tabId, sectionId)?.fields.find((field) => field.key === key) ?? null;
};

describe("walking the customer through the first run", () => {
	test("names the server first, then hands the address over", () => {
		expect(steps.map((step) => step.id)).toEqual([
			"name",
			"invite",
		]);
	});

	test("blocks nothing, because a fresh palworld server already runs", () => {
		expect(steps.filter((step) => step.required !== false)).toEqual([]);
	});

	test("needs no driver step, so the setup declares no submit", () => {
		expect(steps.filter((step) => step.kind === BridgeSetupStepKind.Driver)).toEqual([]);
		expect(driver.setup?.submit).toBeUndefined();
	});

	test("points every form step at a form section the panel really declares", () => {
		for (const step of steps) {
			if (step.kind !== BridgeSetupStepKind.Form) {
				continue;
			}

			expect(formSection(step.tab, step.section)).not.toBeNull();
		}
	});

	test("names only fields that section really carries", () => {
		for (const step of steps) {
			if (step.kind !== BridgeSetupStepKind.Form) {
				continue;
			}

			const keys = (formSection(step.tab, step.section)?.fields ?? []).map((field) => field.key);

			for (const key of step.fields ?? []) {
				expect(keys).toContain(key);
			}
		}
	});

	test("sends the invite step to the access page, where the address lives", () => {
		const invite = steps.find((step) => step.id === "invite");

		expect(invite?.kind === BridgeSetupStepKind.Open && invite.target.tab).toBe(GuideOpenTab.Access);
	});

	test("titles and explains every step in both arabic and english", () => {
		for (const step of steps) {
			expect(step.title.ar.length).toBeGreaterThan(0);
			expect(step.title.en.length).toBeGreaterThan(0);
			expect(step.help?.ar.length).toBeGreaterThan(0);
			expect(step.help?.en.length).toBeGreaterThan(0);
		}
	});
});

describe("keeping the customer's own secrets out of everyone else's hands", () => {
	test("keeps both passwords secrets", () => {
		expect(fieldOf("settings", "world", "ServerPassword")?.control).toBe(BridgeControl.Secret);
		expect(fieldOf("settings", "world", "AdminPassword")?.control).toBe(BridgeControl.Secret);
	});
});

describe("declaring the events the platform is allowed to act on", () => {
	test("names only events the platform's taxonomy knows, so none are dropped", () => {
		for (const name of driver.events?.emits ?? []) {
			expect(isBridgeEventName(name)).toBe(true);
		}
	});

	test("names only events the platform's taxonomy knows in the log patterns too", () => {
		for (const pattern of driver.events?.patterns ?? []) {
			expect(isBridgeEventName(pattern.emit)).toBe(true);
		}
	});
});

describe("assembling the palworld driver", () => {
	test("registers every module the panel binds a section to", () => {
		for (const section of sections) {
			if (section.layout !== BridgeLayout.Form) {
				expect(Object.keys(modules)).toContain(section.module);
			}
		}
	});

	test("declares every capability the panel and the platform depend on", () => {
		expect(driver.install).toBeDefined();
		expect(driver.lifecycle).toBeDefined();
		expect(driver.events).toBeDefined();
		expect(driver.query).toBeDefined();
		expect(driver.backup).toBeDefined();
		expect(driver.announce).toBeDefined();
		expect(driver.setup).toBeDefined();
		expect(driver.terminal).toBeDefined();
		expect(driver.panel).toBeDefined();
	});

	test("registers the settings, players, bans, health, live, ue4ss and remote access modules the tabs reference", () => {
		expect(Object.keys(modules)).toEqual([
			"settings",
			"players",
			"bans",
			"health",
			"live",
			"ue4ss",
			"ue4ssMods",
			RCON_ACCESS_MODULE,
		]);
	});

	test("keeps the ue4ss card a detail module and the mods table a collection, which is what their sections demand", () => {
		expect(modules.ue4ss?.kind).toBe(BridgeKind.Detail);
		expect(modules.ue4ssMods?.kind).toBe(BridgeKind.Collection);
	});

	test("keeps the health card a detail module, which is what its section demands", () => {
		expect(modules.health?.kind).toBe(BridgeKind.Detail);
	});

	test("keeps the setup singleton out of the panel modules, because its id is reserved", () => {
		expect(Object.keys(modules)).not.toContain("setup");
	});
});

const rconPort = manifest.container.ports.find((port) => port.key === RCON_ACCESS_PORT);

describe("the manifest and the driver agreeing on remote access", () => {
	test("publishes the rcon port the driver writes into the ini, over tcp", () => {
		expect(rconPort?.containerPort).toBe(RCON_PORT);
		expect(rconPort?.protocol).toBe("tcp");
	});

	test("never mirrors the rcon port, because palworld binds the container port the ini names", () => {
		expect(rconPort?.mirror ?? false).toBe(false);
	});

	test("publishes the rcon port only while the panel toggle the sections declare is on", () => {
		expect(rconPort?.activeWhen).toEqual([
			{
				variable: RCON_ACCESS_VARIABLE,
				values: [
					"true",
				],
			},
		]);
	});

	test("keeps the rest api the panel talks to off the published ports", () => {
		for (const port of manifest.container.ports) {
			expect(port.containerPort).not.toBe(REST_API_PORT);
		}
	});

	test("declares every tcp container port once, so the rcon port collides with nothing", () => {
		const tcp = manifest.container.ports.filter((port) => port.protocol === "tcp").map((port) => port.containerPort);

		expect(new Set(tcp).size).toBe(tcp.length);
	});

	test("declares the remote access toggle in a form, which is what validate demands of activeWhen", () => {
		const keys = sections.flatMap((section) => {
			return section.layout === BridgeLayout.Form ? section.fields.map((field) => field.key) : [];
		});

		expect(keys).toContain(RCON_ACCESS_VARIABLE);
	});
});

const settingsForms = sections.flatMap((section) => {
	return section.layout === BridgeLayout.Form && section.target === BridgeFormTarget.Settings
		? [
				section,
			]
		: [];
});

describe("binding every settings form to the module that guards its writes", () => {
	test("names a module the driver really registers", () => {
		for (const section of settingsForms) {
			expect(Object.keys(modules)).toContain(section.module ?? "");
		}
	});

	test("keeps that module a settings module, which is what a settings form demands", () => {
		expect(modules.settings?.kind).toBe(BridgeKind.Settings);
	});

	test("accepts every field it renders, so the panel can never offer a write the driver refuses", () => {
		for (const section of settingsForms) {
			for (const field of section.fields) {
				expect(settingsFieldOf(field.key)).not.toBeNull();
			}
		}
	});

	test("refuses the ini keys the driver writes for itself, which the panel never offers", () => {
		for (const key of [
			"PublicPort",
			"RESTAPIEnabled",
			"RESTAPIPort",
			"RCONEnabled",
			"RCONPort",
			CROSSPLAY_KEY,
		]) {
			expect(settingsFieldOf(key)).toBeNull();
			expect(() => {
				validateSettingsWrite({
					[key]: 1,
				});
			}).toThrow();
		}
	});
});
