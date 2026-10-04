import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { RCON_ACCESS_VARIABLE, RCON_PASSWORD_LENGTH } from "@serverkgg/bridge/rcon";
import { readInstallStamp, writeInstallStamp } from "./installStamp";
import {
	accessPatch,
	adminPassword,
	applyAccess,
	liveAdminPassword,
	RCON_PORT,
	rotateAdminPassword,
} from "./palworldAccess";

interface Harness {
	context: Bridge.Context;
	settings: Bridge.Values;
	logged: string[];
}

const harness = (options: { settings?: Bridge.Values; variables?: Record<string, string> } = {}): Harness => {
	const stored = new Map<string, string>();
	const settings: Bridge.Values = {
		...options.settings,
	};
	const logged: string[] = [];

	const context = {
		variable(key: string) {
			return options.variables?.[key] ?? null;
		},
		files: {
			async exists(path: string) {
				return stored.has(path);
			},
			async read(path: string) {
				return stored.get(path) ?? "";
			},
			async write(path: string, content: string) {
				stored.set(path, content);
			},
		},
		codec: {
			ueIni: {
				async read() {
					return settings;
				},
				async merge(_path: string, values: Bridge.Values) {
					Object.assign(settings, values);
				},
			},
		},
		activity: {
			report() {},
		},
		log(message: string) {
			logged.push(message);
		},
	} as unknown as Bridge.Context;

	return {
		context,
		settings,
		logged,
	};
};

describe("the ini keys that open or close rcon", () => {
	it("turns rcon on only while remote access is exposed, on the port the manifest publishes", () => {
		expect(accessPatch(true, null)).toEqual({
			RCONEnabled: true,
			RCONPort: RCON_PORT,
		});
		expect(accessPatch(false, null).RCONEnabled).toBe(false);
	});

	it("writes the admin password only when it was given one", () => {
		expect(accessPatch(false, "rotated").AdminPassword).toBe("rotated");
		expect(Object.keys(accessPatch(false, null))).not.toContain("AdminPassword");
	});

	it("reads the live password from the ini the rest client reads", () => {
		expect(
			liveAdminPassword({
				AdminPassword: "s3cret",
			}),
		).toBe("s3cret");
		expect(liveAdminPassword({})).toBe("");
	});
});

describe("applying remote access at every start", () => {
	it("closes rcon when the variable is unset and keeps the password the server already has", async () => {
		const { context, settings } = harness({
			settings: {
				AdminPassword: "s3cret",
			},
		});

		await applyAccess(context);

		expect(settings).toEqual({
			AdminPassword: "s3cret",
			RCONEnabled: false,
			RCONPort: RCON_PORT,
		});
	});

	it("opens rcon when the panel turned remote access on", async () => {
		const { context, settings } = harness({
			variables: {
				[RCON_ACCESS_VARIABLE]: "true",
			},
		});

		await applyAccess(context);

		expect(settings.RCONEnabled).toBe(true);
	});

	it("promotes the rotated password into the ini and clears it from the stamp", async () => {
		const { context, settings, logged } = harness({
			settings: {
				AdminPassword: "old",
			},
		});

		await writeInstallStamp(context, {
			buildId: "1",
			adminPasswordNext: "rotated",
			settingsPending: null,
			settingsBaseline: null,
		});

		await applyAccess(context);

		expect(settings.AdminPassword).toBe("rotated");
		expect((await readInstallStamp(context))?.adminPasswordNext).toBeNull();
		expect((await readInstallStamp(context))?.buildId).toBe("1");
		expect(logged).toEqual([
			"applied the rotated admin password",
		]);
	});

	it("leaves the stamp alone when nothing is pending", async () => {
		const { context, logged } = harness();

		await writeInstallStamp(context, {
			buildId: "1",
			adminPasswordNext: null,
			settingsPending: null,
			settingsBaseline: null,
		});

		await applyAccess(context);

		expect(await readInstallStamp(context)).toEqual({
			buildId: "1",
			adminPasswordNext: null,
			settingsPending: null,
			settingsBaseline: null,
		});
		expect(logged).toEqual([]);
	});
});

describe("what the remote access card shows", () => {
	it("shows nothing before the first start generated a password", async () => {
		expect(await adminPassword(harness().context)).toBeNull();
	});

	it("shows the password the running server uses", async () => {
		const password = await adminPassword(
			harness({
				settings: {
					AdminPassword: "s3cret",
				},
			}).context,
		);

		expect(password).toEqual({
			value: "s3cret",
			pending: false,
		});
	});

	it("shows the rotated password as pending until the restart applies it", async () => {
		const { context } = harness({
			settings: {
				AdminPassword: "s3cret",
			},
		});

		await writeInstallStamp(context, {
			buildId: "1",
			adminPasswordNext: "rotated",
			settingsPending: null,
			settingsBaseline: null,
		});

		expect(await adminPassword(context)).toEqual({
			value: "rotated",
			pending: true,
		});
	});
});

describe("rotating the admin password", () => {
	it("refuses before the first install wrote a stamp", async () => {
		await expect(rotateAdminPassword(harness().context)).rejects.toBeInstanceOf(BridgeUserError);
	});

	it("stores a fresh password for the next start and touches neither the ini nor the build", async () => {
		const { context, settings } = harness({
			settings: {
				AdminPassword: "s3cret",
			},
		});

		await writeInstallStamp(context, {
			buildId: "1",
			adminPasswordNext: null,
			settingsPending: null,
			settingsBaseline: null,
		});

		await rotateAdminPassword(context);

		const stamp = await readInstallStamp(context);

		expect(stamp?.buildId).toBe("1");
		expect(stamp?.adminPasswordNext).toHaveLength(RCON_PASSWORD_LENGTH);
		expect(stamp?.adminPasswordNext).not.toBe("s3cret");
		expect(settings.AdminPassword).toBe("s3cret");
	});

	it("rotates again over a rotation nobody applied yet", async () => {
		const { context } = harness();

		await writeInstallStamp(context, {
			buildId: "1",
			adminPasswordNext: "first",
			settingsPending: null,
			settingsBaseline: null,
		});

		await rotateAdminPassword(context);

		expect((await readInstallStamp(context))?.adminPasswordNext).not.toBe("first");
	});
});
