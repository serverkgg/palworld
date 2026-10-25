import { type Bridge, BridgeConfirm, BridgeControl, BridgeFormTarget, BridgeLayout } from "@serverkgg/bridge";
import { EDITION_VARIABLE, PalworldEdition, WINDOWS_STEAM_VARIABLE } from "../shared";

export const STEAM_SECTION = "steam";

export const steamSection: Bridge.Section = {
	layout: BridgeLayout.Form,
	id: STEAM_SECTION,
	title: {
		ar: "Steam على ويندوز",
		en: "Steam on Windows",
	},
	help: {
		ar: "يتعرف السيرفر على كل لاعب بحساب Steam ويتحقق منه عبر Steam، ويطبّق قائمة الحظر العامة من Pocketpair، كما على لينكس. يكون Steam مفعّلًا على ويندوز افتراضيًا.",
		en: "Your server knows each player by their Steam account, checks it with Steam and applies Pocketpair's global ban list, as on Linux. On Windows, Steam is on by default.",
	},
	target: BridgeFormTarget.Variables,
	reinstall: false,
	confirm: BridgeConfirm.Normal,
	confirmText: {
		ar: "ننفّذ ريستارت لسيرفرك ليُطبّق التغيير، ويدخل كل لاعب بعده بمعرّف جديد، فلا يجد شخصيته الحالية.",
		en: "We restart your server so the change takes effect. After that every player joins with a new ID and won't find their current character.",
	},
	fields: [
		{
			key: WINDOWS_STEAM_VARIABLE,
			control: BridgeControl.Boolean,
			default: "true",
			label: {
				ar: "تفعيل Steam",
				en: "Use Steam",
			},
			warning: {
				ar: "يغيّر هذا الخيار معرّف كل لاعب، ولا تنتقل الشخصيات الحالية إلى المعرّف الجديد. اختر قبل أن يبدأ اللاعبون البناء.",
				en: "This changes every player's ID, and existing characters don't move to the new ID. Choose before players start building.",
			},
		},
	],
	visibleWhen: {
		variable: EDITION_VARIABLE,
		values: [
			PalworldEdition.Windows,
		],
	},
};
