import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
	BridgePlace,
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
			help: {
				ar: "اسم سيرفرك ووصفه، وكلمات المرور، وعدد اللاعبين الذين يدخلون معك.",
				en: "Your server's name and description, its passwords, and how many players can join.",
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
			help: {
				ar: "مودات اللاعبين والشات والشات الصوتي ورسائل الدخول والخروج داخل اللعبة.",
				en: "Client mods, chat, voice chat, and the join and leave messages inside the game.",
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
				ar: "قوانين الماب",
				en: "World rules",
			},
			help: {
				ar: "قتال اللاعبين، والنمط القاسي، وعقوبة الموت، والتنقّل السريع، وباقي قوانين مابك.",
				en: "PvP, hardcore, the death penalty, fast travel and the rest of your world's rules.",
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
			help: {
				ar: "سرعة الخبرة والاصطياد والعمل والضرر، وطول النهار والليل.",
				en: "How fast XP, catching, work and damage go, and how long the day and the night last.",
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
			help: {
				ar: "حدود القروب والقاعدة، وعدد المباني، ومدة بقاء الأغراض المرمية على الأرض.",
				en: "Guild and base limits, how many buildings there can be, and how long dropped items stay.",
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
		ar: "اللاعبون",
		en: "Players",
	},
	icon: BridgeIcon.Users,
	sections: [
		{
			layout: BridgeLayout.Table,
			id: "online",
			title: {
				ar: "المتصلون الآن",
				en: "Online now",
			},
			help: {
				ar: "اللاعبون الموجودون في سيرفرك الآن. اطرد أو احظر أي لاعب من سطره.",
				en: "Who is on your server right now. Kick or ban anyone from their row.",
			},
			place: BridgePlace.Players,
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
						ar: "اطرد",
						en: "Kick",
					},
					confirm: BridgeConfirm.Normal,
				},
				{
					id: "ban",
					label: {
						ar: "احظر",
						en: "Ban",
					},
					confirm: BridgeConfirm.Normal,
					offline: true,
				},
			],
			empty: {
				ar: "لا يوجد لاعبون متصلون الآن.",
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
			help: {
				ar: "اللاعبون الممنوعون من دخول سيرفرك. احظر أي لاعب بمعرّفه، أو فك الحظر من سطره.",
				en: "Players who can't join your server. Ban anyone by user ID, or unban them from their row.",
			},
			place: BridgePlace.Players,
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
					en: "Ban by user ID",
				},
				placeholder: "steam_7656119…",
			},
			actions: [
				{
					id: "remove",
					label: {
						ar: "فك الحظر",
						en: "Unban",
					},
					confirm: BridgeConfirm.Normal,
				},
			],
			empty: {
				ar: "لا يوجد لاعبون محظورون من سيرفرك. يظهر هنا كل لاعب تحظره من جدول المتصلين، ومن السطر نفسه تفك الحظر عنه ليعود إلى الدخول.",
				en: "Nobody is banned from your server. Anyone you ban from the online list shows up here, and you unban them from the same row so they can join again.",
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
			help: {
				ar: "أداء سيرفرك، واللاعبون، ومدة التشغيل، وتتحدث كل 15 ثانية أثناء تشغيله.",
				en: "Your server performance, players and uptime, refreshed every 15 seconds while it runs.",
			},
			place: BridgePlace.Overview,
			module: "health",
			empty: {
				ar: "تعذّر الوصول إلى سيرفرك الآن. شغّله وعطه دقيقة، وستظهر الأرقام هنا.",
				en: "We couldn't reach your server right now. Start it, give it a minute, and the numbers show up here.",
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
				ar: "تُنفَّذ فورًا على سيرفرك الشغّال.",
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
								ar: "تصل إلى كل اللاعبين المتصلين الآن.",
								en: "Reaches everyone who is on the server right now.",
							},
							maxLength: ANNOUNCE_MESSAGE_LENGTH,
						},
					],
				},
				{
					id: "save",
					label: {
						ar: "احفظ الماب",
						en: "Save the world",
					},
				},
			],
		},
		...rconAccessSections(),
	],
};

export const panel: Bridge.Panel = {
	tabs: [
		settingsTab,
		playersTab,
		controlsTab,
	],
};
