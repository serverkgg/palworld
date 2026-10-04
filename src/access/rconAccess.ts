import type { Bridge } from "@serverkgg/bridge";
import { createRconAccess } from "@serverkgg/bridge/rcon";
import { adminPassword, rotateAdminPassword, rotatedActivity } from "../shared";

export const rotateRconPassword = async (context: Bridge.Context) => {
	await rotateAdminPassword(context);

	context.activity.report(rotatedActivity());
};

export const rconAccess = createRconAccess({
	password: adminPassword,
	rotate: rotateRconPassword,
	tools: {
		ar: "تدعمه BattleMetrics و RCON Console. توصي Pocketpair حاليًا بالـ REST API بدلًا من RCON، وتصل الأسماء التي فيها حروف غير لاتينية مقصوصة عبر RCON.",
		en: "BattleMetrics and RCON Console work with it. Pocketpair now recommends its REST API instead of RCON, and names with non-Latin letters come back cut off over RCON.",
	},
});
