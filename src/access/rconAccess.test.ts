import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { RCON_ACCESS_ROTATE } from "@serverkgg/bridge/rcon";
import { PalworldEdition, readInstallStamp, writeInstallStamp } from "../shared";
import { rconAccess } from "./rconAccess";

const ADMIN_PASSWORD = "admin-s3cret";

interface Harness {
	context: Bridge.Context;
	reported: Bridge.Activity[];
}

const harness = (): Harness => {
	const stored = new Map<string, string>();
	const reported: Bridge.Activity[] = [];

	const context = {
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
					return {
						AdminPassword: ADMIN_PASSWORD,
					};
				},
			},
		},
		activity: {
			report(entry: Bridge.Activity) {
				reported.push(entry);
			},
		},
		log() {},
	} as unknown as Bridge.Context;

	return {
		context,
		reported,
	};
};

const rotate = async (context: Bridge.Context) => {
	const action = rconAccess.kind === BridgeKind.Detail ? rconAccess.actions?.[RCON_ACCESS_ROTATE] : undefined;

	if (!action) {
		throw new Error("the remote access card lost its rotate action");
	}

	await action(context, {});
};

describe("telling the owner the remote access password was rotated", () => {
	it("reports the rotation by its target alone", async () => {
		const { context, reported } = harness();

		await writeInstallStamp(context, {
			buildId: "1",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: null,
			settingsPending: null,
			settingsBaseline: null,
		});

		await rotate(context);

		expect(reported).toEqual([
			{
				name: BridgeEventName.SecretRotated,
				text: {
					ar: "تم إنشاء كلمة مرور جديدة لـ RCON والأدمن، ويُطبَّق التغيير في التشغيل القادم",
					en: "Generated a new RCON and admin password, takes effect on the next start",
				},
				subject: "RCON",
			},
		]);
	});

	it("never puts the old or the new password into what it reports", async () => {
		const { context, reported } = harness();

		await writeInstallStamp(context, {
			buildId: "1",
			edition: PalworldEdition.Linux,
			mods: [],
			adminPasswordNext: null,
			settingsPending: null,
			settingsBaseline: null,
		});

		await rotate(context);

		const next = (await readInstallStamp(context))?.adminPasswordNext ?? "";

		expect(next.length).toBeGreaterThan(0);
		expect(JSON.stringify(reported)).not.toContain(next);
		expect(JSON.stringify(reported)).not.toContain(ADMIN_PASSWORD);
	});

	it("reports nothing when there is no password to rotate yet", async () => {
		const { context, reported } = harness();

		await expect(rotate(context)).rejects.toThrow("Start your server once to generate the password.");

		expect(reported).toEqual([]);
	});
});
