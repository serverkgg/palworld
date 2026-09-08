import { createRconAccess } from "@serverkgg/bridge/rcon";
import { adminPassword, rotateAdminPassword } from "../shared";

export const rconAccess = createRconAccess({
	password: adminPassword,
	rotate: rotateAdminPassword,
	tools: {
		ar: "تشتغل معه BattleMetrics وRCON Console. Pocketpair الحين توصي بالـ REST API بدل RCON، والأسماء اللي فيها حروف غير لاتينية ترجع مقصوصة على RCON.",
		en: "BattleMetrics and RCON Console work; Pocketpair now recommends its REST API instead of RCON, and names with non-Latin letters come back cut off over RCON.",
	},
});
