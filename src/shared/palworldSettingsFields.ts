import { type Bridge, BridgeControl, BridgeUserError } from "@serverkgg/bridge";
import { CROSSPLAY_MAC_KEY, CROSSPLAY_PS5_KEY, CROSSPLAY_XBOX_KEY } from "./palworldCrossplay";

const RANDOMIZER_ON = [
	"Region",
	"All",
];

const UNIT_SEPARATOR = 0x1f;

const DELETE_CHARACTER = 0x7f;

const hasControlCharacter = (text: string) => {
	for (const character of text) {
		const code = character.codePointAt(0) ?? 0;

		if (code <= UNIT_SEPARATOR || code === DELETE_CHARACTER) {
			return true;
		}
	}

	return false;
};

export const WORLD_FIELDS: Bridge.Field[] = [
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
		control: BridgeControl.Secret,
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
		control: BridgeControl.Secret,
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
];

export const COMMUNITY_FIELDS: Bridge.Field[] = [
	{
		key: CROSSPLAY_XBOX_KEY,
		control: BridgeControl.Boolean,
		label: {
			ar: "لاعبين Xbox",
			en: "Xbox players",
		},
		help: {
			ar: "لاعبين Steam يدخلون على طول لأن السيرفر نفسه على Steam. هذي الخيارات تفتح الباب لأصحابك على Xbox و PS5 و Mac.",
			en: "Steam players can always join because the server itself runs on Steam. These open the door to your friends on Xbox, PS5 and Mac.",
		},
	},
	{
		key: CROSSPLAY_PS5_KEY,
		control: BridgeControl.Boolean,
		label: {
			ar: "لاعبين PS5",
			en: "PS5 players",
		},
	},
	{
		key: CROSSPLAY_MAC_KEY,
		control: BridgeControl.Boolean,
		label: {
			ar: "لاعبين Mac",
			en: "Mac players",
		},
	},
	{
		key: "bAllowClientMod",
		control: BridgeControl.Boolean,
		label: {
			ar: "السماح بمودات اللاعبين",
			en: "Allow client mods",
		},
		help: {
			ar: "يخلي اللي عنده مودات يدخل سيرفرك. طفّيه إذا تبي الكل على نفس النسخة.",
			en: "Lets players with mods join your server. Turn it off to keep everyone on the same build.",
		},
	},
	{
		key: "bShowPlayerList",
		control: BridgeControl.Boolean,
		label: {
			ar: "إظهار قائمة اللاعبين",
			en: "Show the player list",
		},
		help: {
			ar: "يخلي أي أحد داخل السيرفر يشوف أسماء اللي معه.",
			en: "Anyone on the server can see who else is in.",
		},
	},
	{
		key: "bIsShowJoinLeftMessage",
		control: BridgeControl.Boolean,
		label: {
			ar: "رسائل الدخول والخروج",
			en: "Join and leave messages",
		},
		help: {
			ar: "تطلع رسالة في الشات كل ما أحد دخل أو طلع.",
			en: "A chat line every time someone joins or leaves.",
		},
	},
	{
		key: "ChatPostLimitPerMinute",
		control: BridgeControl.Number,
		label: {
			ar: "حد رسائل الشات في الدقيقة",
			en: "Chat messages per minute",
		},
		help: {
			ar: "أقصى عدد رسائل يرسلها اللاعب الواحد في الدقيقة — يوقف السبام.",
			en: "The most messages one player can send per minute — it stops spam.",
		},
		min: 0,
		step: 1,
	},
	{
		key: "bEnableVoiceChat",
		control: BridgeControl.Boolean,
		label: {
			ar: "الشات الصوتي",
			en: "Voice chat",
		},
	},
];

export const RULES_FIELDS: Bridge.Field[] = [
	{
		key: "bIsPvP",
		control: BridgeControl.Boolean,
		label: {
			ar: "قتال اللاعبين (PvP)",
			en: "PvP",
		},
		help: {
			ar: "من هنا تفصّل عالمك: القتال، عقوبة الموت، الغارات، والتنقّل. لما تفعّل PvP يقدر اللاعبين يهاجمون بعض.",
			en: "This is where you shape your world: combat, the death penalty, raids and travel. With PvP on, players can attack each other.",
		},
	},
	{
		key: "bEnablePlayerToPlayerDamage",
		control: BridgeControl.Boolean,
		label: {
			ar: "الضرر بين اللاعبين",
			en: "Player to player damage",
		},
		help: {
			ar: "لازم يكون شغّال عشان ضربات اللاعبين تأثر على بعض.",
			en: "It has to be on for player hits to land on each other.",
		},
	},
	{
		key: "bEnableFriendlyFire",
		control: BridgeControl.Boolean,
		label: {
			ar: "ضرر أعضاء القروب",
			en: "Friendly fire",
		},
		help: {
			ar: "لما يشتغل، ضرباتك تأذي أعضاء قروبك بعد.",
			en: "When on, your hits hurt your own guild members too.",
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
		key: "bPalLost",
		control: BridgeControl.Boolean,
		label: {
			ar: "خسارة الـ Pals مع الشخصية",
			en: "Lose your Pals with your character",
		},
		help: {
			ar: "في النمط القاسي، الـ Pals اللي بفريقك تروح مع شخصيتك.",
			en: "In hardcore, the Pals in your party are lost along with your character.",
		},
	},
	{
		key: "bCharacterRecreateInHardcore",
		control: BridgeControl.Boolean,
		label: {
			ar: "شخصية جديدة بعد الموت القاسي",
			en: "New character after a hardcore death",
		},
		help: {
			ar: "يخلي اللاعب يبدأ من جديد بدل ما يقفل عليه السيرفر.",
			en: "Lets the player start over instead of being locked out of the server.",
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
	{
		key: "EnablePredatorBossPal",
		control: BridgeControl.Boolean,
		label: {
			ar: "Pals المفترسة",
			en: "Predator Pals",
		},
		help: {
			ar: "Pals نادرة وقوية تطلع في العالم وتصيد اللي يقابلها.",
			en: "Rare, powerful Pals that roam the world and hunt whoever runs into them.",
		},
	},
	{
		key: "bEnableFastTravel",
		control: BridgeControl.Boolean,
		label: {
			ar: "التنقّل السريع",
			en: "Fast travel",
		},
	},
	{
		key: "bIsStartLocationSelectByMap",
		control: BridgeControl.Boolean,
		label: {
			ar: "اختيار نقطة البداية من الماب",
			en: "Pick your starting point on the map",
		},
		help: {
			ar: "كل لاعب جديد يختار من وين يبدأ بدل نقطة ثابتة.",
			en: "Every new player picks where to start instead of one fixed spot.",
		},
	},
	{
		key: "bExistPlayerAfterLogout",
		control: BridgeControl.Boolean,
		label: {
			ar: "بقاء الشخصية بعد الخروج",
			en: "Character stays after logout",
		},
		help: {
			ar: "شخصية اللاعب تضل في العالم بعد ما يطلع، وممكن أحد يهاجمها.",
			en: "The player's character stays in the world after they leave, and it can be attacked.",
		},
	},
	{
		key: "bEnableNonLoginPenalty",
		control: BridgeControl.Boolean,
		label: {
			ar: "عقوبة الغياب",
			en: "Absence penalty",
		},
		help: {
			ar: "اللي ما يدخل مدة طويلة تنقص موارد قاعدته.",
			en: "A player who stays away for a long time loses base resources.",
		},
	},
	{
		key: "bBuildAreaLimit",
		control: BridgeControl.Boolean,
		label: {
			ar: "حد مساحة البناء",
			en: "Build area limit",
		},
		help: {
			ar: "يمنع البناء برّا حدود القاعدة.",
			en: "Stops building outside the base area.",
		},
	},
	{
		key: "bAllowEnemyCampSpawnNearBaseCamp",
		control: BridgeControl.Boolean,
		label: {
			ar: "مخيمات الأعداء جنب القاعدة",
			en: "Enemy camps near your base",
		},
		help: {
			ar: "لما تطفّيه، ما تطلع مخيمات أعداء قريبة من قواعدكم.",
			en: "When off, enemy camps never spawn close to your bases.",
		},
	},
	{
		key: "RandomizerType",
		control: BridgeControl.Select,
		label: {
			ar: "عشوائية الـ Pals",
			en: "Pal randomizer",
		},
		help: {
			ar: "يخلط الـ Pals اللي تطلع في كل مكان بالعالم.",
			en: "Shuffles which Pals show up around the world.",
		},
		options: [
			{
				value: "None",
				label: {
					ar: "بدون",
					en: "Off",
				},
			},
			{
				value: "Region",
				label: {
					ar: "حسب المنطقة",
					en: "By region",
				},
			},
			{
				value: "All",
				label: {
					ar: "كل شي عشوائي",
					en: "Everything random",
				},
			},
		],
	},
	{
		key: "bIsRandomizerPalLevelRandom",
		control: BridgeControl.Boolean,
		label: {
			ar: "مستويات الـ Pals عشوائية",
			en: "Random Pal levels",
		},
		visibleWhen: {
			variable: "RandomizerType",
			values: RANDOMIZER_ON,
		},
	},
	{
		key: "RandomizerSeed",
		control: BridgeControl.Text,
		label: {
			ar: "بذرة العشوائية (Seed)",
			en: "Randomizer seed",
		},
		help: {
			ar: "خلها فاضية عشان تطلع عشوائية جديدة، أو اكتب نفس البذرة عشان يرجع لك نفس الترتيب.",
			en: "Leave it empty for a fresh shuffle, or type the same seed to get the same shuffle back.",
		},
		maxLength: 32,
		visibleWhen: {
			variable: "RandomizerType",
			values: RANDOMIZER_ON,
		},
	},
];

export const RATES_FIELDS: Bridge.Field[] = [
	{
		key: "ExpRate",
		control: BridgeControl.Number,
		label: {
			ar: "مضاعف الخبرة",
			en: "EXP rate",
		},
		help: {
			ar: "كل المعدلات هنا تمشي بنفس الطريقة: 1 هو الطبيعي، وكل ما كبّرت الرقم صار الشي أسرع أو أكثر. هذا يقرر سرعة رفع المستوى.",
			en: "Every rate here reads the same way: 1 is normal, and a bigger number means faster or more. This one sets how fast you level up.",
		},
		min: 0,
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
		min: 0,
		step: 0.1,
	},
	{
		key: "PalSpawnNumRate",
		control: BridgeControl.Number,
		label: {
			ar: "عدد الـ Pals في العالم",
			en: "Pal spawn count",
		},
		warning: {
			ar: "كل ما زاد العدد، زاد الضغط على المعالج وممكن يصير لاق.",
			en: "More Pals load the CPU and can bring lag.",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "WorkSpeedRate",
		control: BridgeControl.Number,
		label: {
			ar: "سرعة شغل الـ Pals",
			en: "Pal work speed",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PalEggDefaultHatchingTime",
		control: BridgeControl.Number,
		label: {
			ar: "وقت تفقيس البيضة الضخمة",
			en: "Huge egg hatching time",
		},
		help: {
			ar: "بالساعات — كم تبي البيضة الضخمة عشان تفقس.",
			en: "In hours — how long a huge egg takes to hatch.",
		},
		min: 0,
		step: 1,
	},
	{
		key: "DayTimeSpeedRate",
		control: BridgeControl.Number,
		label: {
			ar: "سرعة النهار",
			en: "Day speed",
		},
		help: {
			ar: "كل ما زاد، قصر النهار.",
			en: "Higher makes the day shorter.",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "NightTimeSpeedRate",
		control: BridgeControl.Number,
		label: {
			ar: "سرعة الليل",
			en: "Night speed",
		},
		help: {
			ar: "كل ما زاد، قصر الليل.",
			en: "Higher makes the night shorter.",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "CollectionDropRate",
		control: BridgeControl.Number,
		label: {
			ar: "كمية الموارد من الجمع",
			en: "Gathering yield",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "CollectionObjectRespawnSpeedRate",
		control: BridgeControl.Number,
		label: {
			ar: "رجوع الأشجار والصخور",
			en: "Tree and rock respawn",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "EnemyDropItemRate",
		control: BridgeControl.Number,
		label: {
			ar: "غنائم الأعداء",
			en: "Enemy drops",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PlayerDamageRateAttack",
		control: BridgeControl.Number,
		label: {
			ar: "ضرر هجوم اللاعب",
			en: "Player attack damage",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PlayerDamageRateDefense",
		control: BridgeControl.Number,
		label: {
			ar: "الضرر اللي ياخذه اللاعب",
			en: "Damage the player takes",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PalDamageRateAttack",
		control: BridgeControl.Number,
		label: {
			ar: "ضرر هجوم الـ Pals",
			en: "Pal attack damage",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PalDamageRateDefense",
		control: BridgeControl.Number,
		label: {
			ar: "الضرر اللي تاخذه الـ Pals",
			en: "Damage Pals take",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PlayerStomachDecreaceRate",
		control: BridgeControl.Number,
		label: {
			ar: "سرعة جوع اللاعب",
			en: "Player hunger speed",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PlayerStaminaDecreaceRate",
		control: BridgeControl.Number,
		label: {
			ar: "نزول ستامينا اللاعب",
			en: "Player stamina drain",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PalStomachDecreaceRate",
		control: BridgeControl.Number,
		label: {
			ar: "سرعة جوع الـ Pals",
			en: "Pal hunger speed",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "PalStaminaDecreaceRate",
		control: BridgeControl.Number,
		label: {
			ar: "نزول ستامينا الـ Pals",
			en: "Pal stamina drain",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "ItemWeightRate",
		control: BridgeControl.Number,
		label: {
			ar: "وزن الأغراض",
			en: "Item weight",
		},
		help: {
			ar: "كل ما نقّصته، شلت أغراض أكثر.",
			en: "Lower it and you carry more.",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "EquipmentDurabilityDamageRate",
		control: BridgeControl.Number,
		label: {
			ar: "تآكل العتاد",
			en: "Equipment wear",
		},
		help: {
			ar: "كل ما زاد، خربت أسلحتك وعتادك أسرع.",
			en: "Higher wears your weapons and gear out faster.",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "BuildObjectDamageRate",
		control: BridgeControl.Number,
		label: {
			ar: "ضرر المباني",
			en: "Building damage",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "BuildObjectDeteriorationDamageRate",
		control: BridgeControl.Number,
		label: {
			ar: "تهالك المباني",
			en: "Building decay",
		},
		help: {
			ar: "0 يعني مبانيك ما تتهالك أبداً.",
			en: "0 means your buildings never decay.",
		},
		min: 0,
		step: 0.1,
	},
	{
		key: "SupplyDropSpan",
		control: BridgeControl.Number,
		label: {
			ar: "كل كم تنزل الإمدادات",
			en: "Supply drop interval",
		},
		help: {
			ar: "بالدقايق.",
			en: "In minutes.",
		},
		min: 0,
		step: 10,
	},
];

export const BASES_FIELDS: Bridge.Field[] = [
	{
		key: "BaseCampMaxNumInGuild",
		control: BridgeControl.Number,
		label: {
			ar: "عدد القواعد للقروب",
			en: "Bases per guild",
		},
		help: {
			ar: "هنا حدود القواعد والقروبات والأغراض المرمية بالعالم. هذا أقصى عدد قواعد يبنيها القروب الواحد.",
			en: "This is where the limits on bases, guilds and dropped items live. This one is the most bases a single guild can build.",
		},
		min: 1,
		max: 10,
		step: 1,
	},
	{
		key: "BaseCampWorkerMaxNum",
		control: BridgeControl.Number,
		label: {
			ar: "عدد الـ Pals العاملة في القاعدة",
			en: "Workers per base",
		},
		warning: {
			ar: "كل ما زاد العدد، زاد الضغط على المعالج وممكن يصير لاق.",
			en: "More workers load the CPU and can bring lag.",
		},
		min: 1,
		max: 50,
		step: 1,
	},
	{
		key: "GuildPlayerMaxNum",
		control: BridgeControl.Number,
		label: {
			ar: "أقصى عدد أعضاء القروب",
			en: "Max guild members",
		},
		min: 1,
		step: 1,
	},
	{
		key: "bAutoResetGuildNoOnlinePlayers",
		control: BridgeControl.Boolean,
		label: {
			ar: "حذف القروب الفاضي تلقائياً",
			en: "Delete an empty guild automatically",
		},
		help: {
			ar: "لما ما يدخل ولا عضو من القروب مدة طويلة، ينحذف القروب وقواعده.",
			en: "When nobody from a guild logs in for a long time, the guild and its bases go away.",
		},
	},
	{
		key: "AutoResetGuildTimeNoOnlinePlayers",
		control: BridgeControl.Number,
		label: {
			ar: "مدة الغياب قبل الحذف",
			en: "Absence before the guild goes",
		},
		help: {
			ar: "بالساعات.",
			en: "In hours.",
		},
		min: 0,
		step: 1,
		visibleWhen: {
			variable: "bAutoResetGuildNoOnlinePlayers",
			values: [
				"true",
			],
		},
	},
	{
		key: "GuildRejoinCooldownMinutes",
		control: BridgeControl.Number,
		label: {
			ar: "الانتظار قبل الرجوع لقروب",
			en: "Guild rejoin cooldown",
		},
		help: {
			ar: "بالدقايق، بعد ما يطلع اللاعب من قروبه.",
			en: "In minutes, after a player leaves their guild.",
		},
		min: 0,
		step: 1,
	},
	{
		key: "MaxBuildingLimitNumPerPlayer",
		control: BridgeControl.Number,
		label: {
			ar: "حد المباني لكل لاعب",
			en: "Building limit per player",
		},
		help: {
			ar: "0 يعني بدون حد.",
			en: "0 means no limit.",
		},
		min: 0,
		step: 1,
	},
	{
		key: "DropItemMaxNum",
		control: BridgeControl.Number,
		label: {
			ar: "أقصى عدد أغراض مرمية بالعالم",
			en: "Max dropped items in the world",
		},
		min: 0,
		step: 100,
	},
	{
		key: "DropItemAliveMaxHours",
		control: BridgeControl.Number,
		label: {
			ar: "مدة بقاء الغرض المرمي",
			en: "How long a dropped item lasts",
		},
		help: {
			ar: "بالساعات.",
			en: "In hours.",
		},
		min: 0,
		step: 0.1,
	},
];

export const SETTINGS_FIELDS: Bridge.Field[] = [
	...WORLD_FIELDS,
	...COMMUNITY_FIELDS,
	...RULES_FIELDS,
	...RATES_FIELDS,
	...BASES_FIELDS,
];

export const settingsFieldOf = (key: string) => {
	return SETTINGS_FIELDS.find((field) => field.key === key) ?? null;
};

const booleanOf = (field: Bridge.Field, value: Bridge.Value) => {
	if (typeof value === "boolean") {
		return value;
	}

	const text = String(value).toLowerCase();

	if (text === "true" || text === "false") {
		return text === "true";
	}

	throw new BridgeUserError({
		ar: `«${field.label.ar}» يا مشغّل يا مطفّي، ما فيه خيار ثالث.`,
		en: `${field.label.en} is either on or off, nothing else.`,
	});
};

const numberOf = (field: Bridge.Field, value: Bridge.Value) => {
	const text = typeof value === "string" ? value.trim() : value;
	const parsed = typeof text === "number" ? text : Number(text);
	const readable = typeof text === "number" || (typeof text === "string" && text.length > 0);

	if (!readable || !Number.isFinite(parsed)) {
		throw new BridgeUserError({
			ar: `«${field.label.ar}» يبي له رقم.`,
			en: `${field.label.en} needs a number.`,
		});
	}

	const min = field.min;
	const max = field.max;

	if (min === undefined) {
		return parsed;
	}

	if (max === undefined) {
		if (parsed < min) {
			throw new BridgeUserError({
				ar: `«${field.label.ar}» لازم يكون ${min} أو أكثر.`,
				en: `${field.label.en} must be ${min} or more.`,
			});
		}

		return parsed;
	}

	if (parsed < min || parsed > max) {
		throw new BridgeUserError({
			ar: `«${field.label.ar}» لازم يكون بين ${min} و ${max}.`,
			en: `${field.label.en} must be between ${min} and ${max}.`,
		});
	}

	return parsed;
};

const selectOf = (field: Bridge.Field, value: Bridge.Value) => {
	const text = String(value ?? "");
	const options = Array.isArray(field.options) ? field.options : [];

	if (!options.some((option) => option.value === text)) {
		throw new BridgeUserError({
			ar: `«${field.label.ar}» ما يقبل «${text}».`,
			en: `${field.label.en} does not accept "${text}".`,
		});
	}

	return text;
};

const textOf = (field: Bridge.Field, value: Bridge.Value) => {
	const text = value === null ? "" : String(value);
	const limit = field.maxLength ?? Number.POSITIVE_INFINITY;

	if (hasControlCharacter(text)) {
		throw new BridgeUserError({
			ar: `«${field.label.ar}» يبيله سطر واحد بدون رموز مخفية.`,
			en: `${field.label.en} must be one line, with no line breaks or control characters.`,
		});
	}

	if (text.length > limit) {
		throw new BridgeUserError({
			ar: `«${field.label.ar}» أطول من ${limit} حرف.`,
			en: `${field.label.en} is longer than ${limit} characters.`,
		});
	}

	return text;
};

const settingsValueOf = (field: Bridge.Field, value: Bridge.Value): Bridge.Value => {
	if (field.control === BridgeControl.Boolean) {
		return booleanOf(field, value);
	}

	if (field.control === BridgeControl.Number) {
		return numberOf(field, value);
	}

	if (field.control === BridgeControl.Select) {
		return selectOf(field, value);
	}

	return textOf(field, value);
};

export const validateSettingsWrite = (values: Bridge.Values): Bridge.Values => {
	const checked: Bridge.Values = {};

	for (const [key, value] of Object.entries(values)) {
		const field = settingsFieldOf(key);

		if (field === null) {
			throw new BridgeUserError({
				ar: `${key} مو إعداد تقدر تغيّره من اللوحة.`,
				en: `${key} is not a setting the panel can change.`,
			});
		}

		checked[key] = settingsValueOf(field, value);
	}

	return checked;
};
