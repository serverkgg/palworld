import type { Bridge } from "@serverkgg/bridge";
import { activityExcerpt, BridgeEventName } from "@serverkgg/bridge/protocol";

export const RCON_SUBJECT = "RCON";

export const SAVE_GAMEPLAY = "save";

export interface PalworldActivityPlayer {
	player: string;
	userId: string;
	platform: string;
}

const playerDetails = (target: PalworldActivityPlayer): Bridge.Values => {
	return {
		userId: target.userId,
		platform: target.platform,
	};
};

export const kickedActivity = (target: PalworldActivityPlayer): Bridge.Activity => {
	return {
		name: BridgeEventName.PlayerKicked,
		text: {
			ar: `تم طرد ${target.player} (${target.platform})`,
			en: `Kicked ${target.player} (${target.platform})`,
		},
		subject: target.player,
		details: playerDetails(target),
	};
};

export const bannedActivity = (target: PalworldActivityPlayer): Bridge.Activity => {
	return {
		name: BridgeEventName.PlayerBanned,
		text: {
			ar: `تم حظر ${target.player} (${target.platform})`,
			en: `Banned ${target.player} (${target.platform})`,
		},
		subject: target.player,
		details: playerDetails(target),
	};
};

export const unbannedActivity = (target: PalworldActivityPlayer): Bridge.Activity => {
	return {
		name: BridgeEventName.PlayerUnbanned,
		text: {
			ar: `تم فك الحظر عن ${target.player} (${target.platform})`,
			en: `Unbanned ${target.player} (${target.platform})`,
		},
		subject: target.player,
		details: playerDetails(target),
	};
};

export const broadcastActivity = (message: string): Bridge.Activity => {
	const excerpt = activityExcerpt(message);

	return {
		name: BridgeEventName.BroadcastSent,
		text: {
			ar: `تم إرسال رسالة إلى اللاعبين: «${excerpt}»`,
			en: `Sent a message to players: "${excerpt}"`,
		},
		details: {
			length: message.length,
		},
	};
};

export const savedActivity = (): Bridge.Activity => {
	return {
		name: BridgeEventName.GameplayChanged,
		text: {
			ar: "تم حفظ الماب",
			en: "Saved the world",
		},
		details: {
			what: SAVE_GAMEPLAY,
		},
	};
};

export const rotatedActivity = (): Bridge.Activity => {
	return {
		name: BridgeEventName.SecretRotated,
		text: {
			ar: "تم إنشاء كلمة مرور جديدة لـ RCON والأدمن، ويُطبَّق التغيير في التشغيل القادم",
			en: "Generated a new RCON and admin password, takes effect on the next start",
		},
		subject: RCON_SUBJECT,
	};
};

export const settingsAppliedActivity = (keys: string[]): Bridge.Activity => {
	return {
		name: BridgeEventName.SettingsApplied,
		text: {
			ar: `تم تطبيق الإعدادات التي كانت بانتظار التشغيل (${keys.length})`,
			en: `Applied the settings that were waiting for the next start (${keys.length})`,
		},
		details: {
			keys: keys.join(","),
			count: keys.length,
		},
	};
};

export const updatedActivity = (from: string, to: string): Bridge.Activity => {
	return {
		name: BridgeEventName.ServerUpdated,
		text: {
			ar: `تم تحديث بالورلد من البيلد ${from} إلى ${to}`,
			en: `Updated Palworld from build ${from} to ${to}`,
		},
		details: {
			from,
			to,
		},
	};
};

export const installedActivity = (build: string | null): Bridge.Activity => {
	return {
		name: BridgeEventName.GameInstalled,
		text:
			build === null
				? {
						ar: "تم تثبيت بالورلد",
						en: "Installed Palworld",
					}
				: {
						ar: `تم تثبيت بالورلد (البيلد ${build})`,
						en: `Installed Palworld (build ${build})`,
					},
		...(build === null
			? {}
			: {
					details: {
						build,
					},
				}),
	};
};
