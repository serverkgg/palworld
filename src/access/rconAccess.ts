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
		ar: "تشتغل معه BattleMetrics وRCON Console. Pocketpair الحين توصي بالـ REST API بدل RCON، والأسماء اللي فيها حروف غير لاتينية ترجع مقصوصة على RCON.",
		en: "BattleMetrics and RCON Console work; Pocketpair now recommends its REST API instead of RCON, and names with non-Latin letters come back cut off over RCON.",
	},
});
