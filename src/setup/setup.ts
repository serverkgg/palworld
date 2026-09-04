import { type Bridge, BridgeKind, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";

export const SETTINGS_TAB = "settings";

export const WORLD_SECTION = "world";

export const NAME_STEP = "name";

export const INVITE_STEP = "invite";

export const setup: Bridge.Setup = {
	kind: BridgeKind.Setup,
	steps: [
		{
			kind: BridgeSetupStepKind.Form,
			id: NAME_STEP,
			required: false,
			tab: SETTINGS_TAB,
			section: WORLD_SECTION,
			fields: [
				"ServerName",
				"ServerDescription",
				"ServerPassword",
			],
			title: {
				ar: "سمِّ سيرفرك",
				en: "Name your server",
			},
			help: {
				ar: "الاسم والوصف اللي يطلعون في قائمة السيرفرات، وكلمة مرور الدخول لو تبي السيرفر لك ولأصحابك بس. تقدر تعدّلها بعدين من الإعدادات.",
				en: "The name and description in the server browser, and a join password if the server is for you and your friends only. Change them later from Settings.",
			},
		},
		{
			kind: BridgeSetupStepKind.Open,
			id: INVITE_STEP,
			required: false,
			target: {
				tab: GuideOpenTab.Access,
			},
			title: {
				ar: "عزّم أصحابك",
				en: "Invite your friends",
			},
			help: {
				ar: "انسخ عنوان سيرفرك وأرسله لأصحابك عشان يدخلون من Join Multiplayer Game.",
				en: "Copy your server address and send it to your friends so they can join from Join Multiplayer Game.",
			},
		},
	],
};
