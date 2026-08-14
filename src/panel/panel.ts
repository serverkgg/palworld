import {
	type Bridge,
	BridgeConfirm,
	BridgeControl,
	BridgeFormTarget,
	BridgeIcon,
	BridgeLayout,
} from "@serverkgg/bridge";
import { ANNOUNCE_MESSAGE_LENGTH } from "../shared";

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
			target: BridgeFormTarget.Settings,
			module: "settings",
			restartHint: true,
			fields: [
				{
					key: "ServerName",
					control: BridgeControl.Text,
					label: {
						ar: "اسم السيرفر",
						en: "Server name",
					},
					help: {
						ar: "الاسم اللي يظهر للاعبين في قائمة السيرفرات وشاشة الدخول.",
						en: "Shown to players in the server browser and on join.",
					},
					maxLength: 48,
				},
				{
					key: "ServerDescription",
					control: BridgeControl.Text,
					label: {
						ar: "وصف السيرفر",
						en: "Server description",
					},
					help: {
						ar: "وصف قصير يظهر تحت اسم السيرفر.",
						en: "A short description shown under the server name.",
					},
					maxLength: 128,
				},
				{
					key: "ServerPassword",
					control: BridgeControl.Text,
					label: {
						ar: "كلمة مرور الدخول",
						en: "Join password",
					},
					help: {
						ar: "اتركها فاضية عشان يكون السيرفر مفتوح للجميع.",
						en: "Leave empty to keep the server open to everyone.",
					},
					maxLength: 32,
				},
				{
					key: "AdminPassword",
					control: BridgeControl.Text,
					label: {
						ar: "كلمة مرور الأدمن",
						en: "Admin password",
					},
					help: {
						ar: "تستخدمها داخل اللعبة لأوامر الأدمن، واللوحة تستخدمها عشان توقف السيرفر وتحفظ وتدير اللاعبين. نولّد لك وحدة تلقائياً — تقدر تغيّرها، بس لا تخليها فاضية.",
						en: "Used in-game for admin commands, and by the panel to stop the server, save the world and manage players. We generate one for you — changing it is fine, leaving it empty is not.",
					},
					maxLength: 32,
				},
				{
					key: "ServerPlayerMaxNum",
					control: BridgeControl.Number,
					label: {
						ar: "أقصى عدد لاعبين",
						en: "Max players",
					},
					min: 1,
					max: 32,
				},
				{
					key: "bIsPvP",
					control: BridgeControl.Boolean,
					label: {
						ar: "قتال اللاعبين (PvP)",
						en: "PvP",
					},
					help: {
						ar: "لما تفعّله، يقدر اللاعبين يهاجمون بعض.",
						en: "When on, players can attack each other.",
					},
				},
				{
					key: "bHardcore",
					control: BridgeControl.Boolean,
					label: {
						ar: "النمط القاسي (Hardcore)",
						en: "Hardcore",
					},
					warning: {
						ar: "في النمط القاسي، موت اللاعب يعني خسارة شخصيته نهائيًا.",
						en: "In hardcore mode, death means losing your character permanently.",
					},
				},
				{
					key: "DeathPenalty",
					control: BridgeControl.Select,
					label: {
						ar: "عقوبة الموت",
						en: "Death penalty",
					},
					options: [
						{
							value: "None",
							label: {
								ar: "بدون خسارة",
								en: "Nothing",
							},
						},
						{
							value: "Item",
							label: {
								ar: "خسارة الأغراض",
								en: "Items",
							},
						},
						{
							value: "ItemAndEquipment",
							label: {
								ar: "خسارة الأغراض والعتاد",
								en: "Items and equipment",
							},
						},
						{
							value: "All",
							label: {
								ar: "خسارة كل شيء مع الـ Pals",
								en: "Everything including Pals",
							},
						},
					],
				},
				{
					key: "ExpRate",
					control: BridgeControl.Number,
					label: {
						ar: "مضاعف الخبرة",
						en: "EXP rate",
					},
					help: {
						ar: "كل ما زاد، تطورون أسرع. 1 هو المعدل الطبيعي.",
						en: "Higher means faster leveling. 1 is the normal rate.",
					},
					min: 0.1,
					max: 20,
					step: 0.1,
				},
				{
					key: "PalCaptureRate",
					control: BridgeControl.Number,
					label: {
						ar: "معدل اصطياد الـ Pals",
						en: "Pal capture rate",
					},
					help: {
						ar: "كل ما زاد، صار اصطياد الـ Pals أسهل.",
						en: "Higher makes catching Pals easier.",
					},
					min: 0.5,
					max: 2,
					step: 0.1,
				},
				{
					key: "bEnableInvaderEnemy",
					control: BridgeControl.Boolean,
					label: {
						ar: "غارات الأعداء",
						en: "Enemy raids",
					},
					help: {
						ar: "لما تطفّيه، ما تنهجم قاعدتك من الأعداء.",
						en: "When off, your base is never raided by enemies.",
					},
				},
			],
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
	],
};

export const panel: Bridge.Panel = {
	tabs: [
		settingsTab,
		playersTab,
		controlsTab,
	],
};
