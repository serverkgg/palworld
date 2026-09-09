import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
} from "@serverkgg/bridge";
import { rconAccessSections } from "@serverkgg/bridge/rcon";
import {
	ANNOUNCE_MESSAGE_LENGTH,
	BASES_FIELDS,
	COMMUNITY_FIELDS,
	RATES_FIELDS,
	RULES_FIELDS,
	WORLD_FIELDS,
} from "../shared";
import { UE4SS_MOD_STAGING, UE4SS_VARIABLE } from "../ue4ss";

const settingsTab: Bridge.Tab = {
	id: "settings",
	title: {
		ar: "الإعدادات",
		en: "Settings",
	},
	icon: BridgeIcon.Settings,
	sections: [
		{
			layout: BridgeLayout.Form,
			id: "world",
			title: {
				ar: "أساسيات السيرفر",
				en: "Server basics",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: WORLD_FIELDS,
		},
		{
			layout: BridgeLayout.Form,
			id: "community",
			title: {
				ar: "المجتمع",
				en: "Community",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: COMMUNITY_FIELDS,
		},
		{
			layout: BridgeLayout.Form,
			id: "rules",
			title: {
				ar: "قوانين العالم",
				en: "World rules",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: RULES_FIELDS,
		},
		{
			layout: BridgeLayout.Form,
			id: "rates",
			title: {
				ar: "معدلات اللعب",
				en: "Game rates",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: RATES_FIELDS,
		},
		{
			layout: BridgeLayout.Form,
			id: "bases",
			title: {
				ar: "القواعد والقروبات",
				en: "Bases and guilds",
			},
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: BASES_FIELDS,
		},
	],
};

const playersTab: Bridge.Tab = {
	id: "players",
	title: {
		ar: "اللاعبين",
		en: "Players",
	},
	icon: BridgeIcon.Users,
	sections: [
		{
			layout: BridgeLayout.Table,
			id: "online",
			title: {
				ar: "المتصلين الحين",
				en: "Online now",
			},
			module: "players",
			columns: [
				{
					key: "name",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
				{
					key: "account",
					label: {
						ar: "الحساب",
						en: "Account",
					},
				},
				{
					key: "platform",
					label: {
						ar: "المنصة",
						en: "Platform",
					},
				},
				{
					key: "level",
					label: {
						ar: "المستوى",
						en: "Level",
					},
				},
				{
					key: "ping",
					label: {
						ar: "البنق",
						en: "Ping",
					},
				},
			],
			actions: [
				{
					id: "kick",
					label: {
						ar: "طرد",
						en: "Kick",
					},
					confirm: BridgeConfirm.Normal,
				},
				{
					id: "ban",
					label: {
						ar: "حظر",
						en: "Ban",
					},
					confirm: BridgeConfirm.Strong,
				},
			],
			empty: {
				ar: "ما فيه أحد داخل الحين.",
				en: "Nobody is online right now.",
			},
		},
		{
			layout: BridgeLayout.Table,
			id: "bans",
			title: {
				ar: "المحظورون",
				en: "Banned players",
			},
			module: "bans",
			columns: [
				{
					key: "player",
					label: {
						ar: "اللاعب",
						en: "Player",
					},
				},
				{
					key: "platform",
					label: {
						ar: "المنصة",
						en: "Platform",
					},
				},
				{
					key: "userId",
					label: {
						ar: "المعرّف",
						en: "User ID",
					},
				},
			],
			add: {
				label: {
					ar: "احظر بالمعرّف",
					en: "Ban by user id",
				},
				placeholder: "steam_7656119…",
			},
			actions: [
				{
					id: "remove",
					label: {
						ar: "رفع الحظر",
						en: "Unban",
					},
					confirm: BridgeConfirm.Normal,
				},
			],
			empty: {
				ar: "ما فيه أحد محظور من سيرفرك. أي واحد تحظره من جدول المتصلين بيطلع لك هنا، ومن نفس السطر ترفع عنه الحظر ويرجع يدخل.",
				en: "Nobody is banned from your server. Whoever you ban from the online list lands here, and the same row is where you lift it so they can join again.",
			},
		},
	],
};

const controlsTab: Bridge.Tab = {
	id: "controls",
	title: {
		ar: "التحكم",
		en: "Controls",
	},
	icon: BridgeIcon.Command,
	sections: [
		{
			layout: BridgeLayout.Detail,
			id: "health",
			title: {
				ar: "حالة السيرفر",
				en: "Server health",
			},
			module: "health",
			empty: {
				ar: "ما قدرنا نوصل لسيرفرك الحين. شغّله وخلّه دقيقة، وبتطلع لك الأرقام هنا.",
				en: "We could not reach your server right now. Start it, give it a minute, and the numbers land here.",
			},
		},
		{
			layout: BridgeLayout.Actions,
			id: "live",
			title: {
				ar: "أوامر سريعة",
				en: "Quick actions",
			},
			help: {
				ar: "تشتغل على طول على سيرفرك الشغّال.",
				en: "These run on your server right away.",
			},
			module: "live",
			actions: [
				{
					id: "announce",
					label: {
						ar: "رسالة للاعبين",
						en: "Announce",
					},
					fields: [
						{
							key: "message",
							control: BridgeControl.Text,
							label: {
								ar: "الرسالة",
								en: "Message",
							},
							help: {
								ar: "توصل لكل اللي داخلين الحين.",
								en: "Reaches everyone who is on the server right now.",
							},
							maxLength: ANNOUNCE_MESSAGE_LENGTH,
						},
					],
				},
				{
					id: "save",
					label: {
						ar: "احفظ العالم",
						en: "Save the world",
					},
				},
			],
		},
		...rconAccessSections(),
	],
};

const modsTab: Bridge.Tab = {
	id: "mods",
	title: {
		ar: "المودات",
		en: "Mods",
	},
	icon: BridgeIcon.Puzzle,
	sections: [
		{
			layout: BridgeLayout.Detail,
			id: "ue4ss",
			title: {
				ar: "محمّل المودات",
				en: "Mod loader",
			},
			module: "ue4ss",
			empty: {
				ar: "UE4SS مطفّي. شغّله من الخيار اللي تحت وننزّله لك ونعيد تشغيل سيرفرك.",
				en: "UE4SS is off. Turn the switch below on and we download it and restart your server for you.",
			},
		},
		{
			layout: BridgeLayout.Form,
			id: "loader",
			title: {
				ar: "UE4SS",
				en: "UE4SS",
			},
			target: BridgeFormTarget.Variables,
			reinstall: false,
			restartHint: true,
			fields: [
				{
					key: UE4SS_VARIABLE,
					control: BridgeControl.Boolean,
					label: {
						ar: "شغّل UE4SS",
						en: "Enable UE4SS",
					},
					help: {
						ar: "UE4SS هو محمّل المودات اللي تشتغل عليه مودات لوا في بالورلد. لما تشغّله ننزّله لك ونعيد تشغيل سيرفرك، ولما تطفّيه يروح المحمّل بس ومجلد المودات يبقى مكانه.",
						en: "UE4SS is the mod loader Palworld Lua mods run on. Turning it on downloads it and restarts your server; turning it off removes only the loader and keeps your mods folder.",
					},
				},
			],
		},
		{
			layout: BridgeLayout.Table,
			id: "lua-mods",
			title: {
				ar: "مودات لوا",
				en: "Lua mods",
			},
			module: "ue4ssMods",
			restartHint: true,
			columns: [
				{
					key: "name",
					label: {
						ar: "المود",
						en: "Mod",
					},
				},
				{
					key: "enabled",
					label: {
						ar: "شغّال",
						en: "Enabled",
					},
				},
			],
			upload: {
				label: {
					ar: "رفع مود",
					en: "Upload a mod",
				},
				extensions: [
					"zip",
				],
				staging: UE4SS_MOD_STAGING,
			},
			actions: [
				{
					id: "enable",
					label: {
						ar: "شغّل",
						en: "Enable",
					},
				},
				{
					id: "disable",
					label: {
						ar: "طفّي",
						en: "Disable",
					},
				},
			],
			empty: {
				ar: "ما فيه مودات. شغّل UE4SS أول، بعدين ارفع ملف zip فيه مجلد المود ومعاه scripts/main.lua.",
				en: "No mods yet. Turn UE4SS on first, then upload a zip holding a mod folder with scripts/main.lua in it.",
			},
		},
	],
};

export const panel: Bridge.Panel = {
	tabs: [
		settingsTab,
		playersTab,
		controlsTab,
		modsTab,
	],
};
