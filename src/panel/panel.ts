import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
	BridgePlace,
	BridgeUploadMode,
} from "@serverkgg/bridge";
import { rconAccessSections } from "@serverkgg/bridge/rcon";
import {
	ANNOUNCE_MESSAGE_LENGTH,
	BASES_FIELDS,
	COMMUNITY_FIELDS,
	EDITION_VARIABLE,
	MOD_STAGING,
	MOD_UPLOAD_EXTENSIONS,
	PalworldEdition,
	RATES_FIELDS,
	RULES_FIELDS,
	WORLD_FIELDS,
} from "../shared";
import { steamSection } from "./steamSection";

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
		steamSection,
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

const EDITION_SECTION = "edition";

const modsTab: Bridge.Tab = {
	id: "mods",
	title: {
		ar: "المودات",
		en: "Mods",
	},
	icon: BridgeIcon.Puzzle,
	sections: [
		{
			layout: BridgeLayout.Form,
			id: EDITION_SECTION,
			title: {
				ar: "لينكس أو ويندوز؟",
				en: "Linux or Windows?",
			},
			help: {
				ar: "يشغّل بالورلد مودات السيرفر، مثل UE4SS و PalSchema، على ويندوز فقط. على ويندوز يبدأ كل لاعب بشخصية جديدة، ولذلك يناسب ويندوز الماب الجديد أكثر.",
				en: "Palworld runs server mods, such as UE4SS and PalSchema, only on Windows. On Windows every player starts a new character, so Windows suits a new world best.",
			},
			target: BridgeFormTarget.Variables,
			reinstall: true,
			confirm: BridgeConfirm.Normal,
			confirmText: {
				ar: "تبديل نظام التشغيل ينزّل ملفات اللعبة من Steam من جديد، ويتوقف السيرفر حتى ينتهي التنزيل. يبقى الماب والإعدادات كما هي، لكن على ويندوز يبدأ كل لاعب بشخصية جديدة، لأن سيرفر بالورلد على ويندوز يتعرف على اللاعبين بطريقة مختلفة. شخصيات لينكس محفوظة وتعود عند العودة إلى لينكس، ونأخذ نسخة احتياطية قبل التبديل.",
				en: "Switching downloads the game files from Steam again, and the server is down until the download finishes. Your world and settings stay, but on Windows every player starts a new character, because Palworld's Windows server identifies players differently. Your Linux characters are kept and come back when you switch back to Linux, and we take a backup before the switch.",
			},
			fields: [
				{
					key: EDITION_VARIABLE,
					control: BridgeControl.Select,
					label: {
						ar: "نظام التشغيل",
						en: "Operating system",
					},
					options: [
						{
							value: PalworldEdition.Linux,
							label: {
								ar: "لينكس، بدون مودات سيرفر",
								en: "Linux, no server mods",
							},
						},
						{
							value: PalworldEdition.Windows,
							label: {
								ar: "ويندوز، مع مودات السيرفر",
								en: "Windows, with server mods",
							},
						},
					],
				},
			],
		},
		{
			layout: BridgeLayout.Catalog,
			id: "mods",
			title: {
				ar: "مودات سيرفرك",
				en: "Your mods",
			},
			help: {
				ar: "يعرض الكتالوج مودات Steam Workshop التي يشغّلها السيرفر، ونثبّت مع كل مود ما يعتمد عليه. يلزم أن تكون المودات نفسها عند كل لاعب. وإذا كان المود من Nexus Mods أو CurseForge، فارفع ملف zip كما نزّلته.",
				en: "The catalog lists the Steam Workshop mods that run on servers, and we install each one with what it depends on. Every player needs the same mods in their own game. For a mod from Nexus Mods or CurseForge, upload its zip as you downloaded it.",
			},
			module: "mods",
			restartHint: true,
			upload: {
				label: {
					ar: "ارفع مودًا",
					en: "Upload a mod",
				},
				extensions: MOD_UPLOAD_EXTENSIONS,
				staging: MOD_STAGING,
				mode: BridgeUploadMode.Archive,
			},
			empty: {
				ar: "لا توجد مودات مثبّتة. ابحث عن مود وثبّته، أو ارفع ملف zip لمود.",
				en: "No mods installed. Search for one and install it, or upload a mod's zip.",
			},
			visibleWhen: {
				variable: EDITION_VARIABLE,
				values: [
					PalworldEdition.Windows,
				],
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
