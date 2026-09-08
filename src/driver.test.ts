import { describe, expect, test } from "bun:test";
import { BridgeControl, BridgeLayout, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";
import { isBridgeEventName } from "@serverkgg/bridge/protocol";
import { RCON_ACCESS_MODULE, RCON_ACCESS_PORT, RCON_ACCESS_VARIABLE } from "@serverkgg/bridge/rcon";
import { driver } from "./driver";
import { RCON_PORT, REST_API_PORT, rosterOf } from "./shared";

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

const ROSTER_KEYS = Object.keys(
	rosterOf({
		players: [
			{
				name: "Meslzy",
				userId: "steam_1",
				level: 42,
				ping: 31,
			},
		],
	}).at(0) ?? {},
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

	test("shows the level and ping the panel promises", () => {
		expect(columnsOf("players")).toEqual([
			"name",
			"level",
			"ping",
		]);
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

	test("registers the settings, players, live and remote access modules the tabs reference", () => {
		expect(Object.keys(modules)).toEqual([
			"settings",
			"players",
			"live",
			RCON_ACCESS_MODULE,
		]);
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
