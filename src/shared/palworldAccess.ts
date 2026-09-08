import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { RCON_PASSWORD_LENGTH, type RconAccessPassword, rconExposed } from "@serverkgg/bridge/rcon";
import { generateToken } from "@serverkgg/bridge/utils";
import { readInstallStamp, writeInstallStamp } from "./installStamp";
import { mergeSettings, readSettings } from "./palworldSettings";

export const RCON_PORT = 25_575;

const NOT_GENERATED: Bridge.Text = {
	ar: "شغّل سيرفرك مرة عشان تتولد كلمة المرور.",
	en: "Start your server once to generate the password.",
};

export const accessPatch = (exposed: boolean, adminPassword: string | null): Bridge.Values => {
	return {
		RCONEnabled: exposed,
		RCONPort: RCON_PORT,
		...(adminPassword === null
			? {}
			: {
					AdminPassword: adminPassword,
				}),
	};
};

export const liveAdminPassword = (settings: Bridge.Values) => {
	return String(settings.AdminPassword ?? "");
};

export const applyAccess = async (context: Bridge.Context) => {
	const stamp = await readInstallStamp(context);
	const next = stamp?.adminPasswordNext ?? null;

	await mergeSettings(context, accessPatch(rconExposed(context), next));

	if (stamp !== null && next !== null) {
		await writeInstallStamp(context, {
			...stamp,
			adminPasswordNext: null,
		});

		context.log("applied the rotated admin password");
	}
};

export const adminPassword = async (context: Bridge.Context): Promise<RconAccessPassword | null> => {
	const live = liveAdminPassword(await readSettings(context));
	const next = (await readInstallStamp(context))?.adminPasswordNext ?? null;

	if (next === null && live.length === 0) {
		return null;
	}

	return {
		value: next ?? live,
		pending: next !== null,
	};
};

export const rotateAdminPassword = async (context: Bridge.Context) => {
	const stamp = await readInstallStamp(context);

	if (stamp === null) {
		throw new BridgeUserError(NOT_GENERATED);
	}

	await writeInstallStamp(context, {
		...stamp,
		adminPasswordNext: generateToken(RCON_PASSWORD_LENGTH),
	});
};
