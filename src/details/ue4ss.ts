import { type Bridge, BridgeDetailFormat, BridgeDetailTone, BridgeKind } from "@serverkgg/bridge";
import {
	enabledMods,
	readModsList,
	readUe4ssLog,
	readUe4ssStamp,
	UE4SS_PROJECT_URL,
	UE4SS_VARIABLE,
	ue4ssEnabled,
	ue4ssInstalled,
} from "../ue4ss";

const REFRESH_SECONDS = 30;

const MISSING = "—";

const installedBadge = (installed: boolean): Bridge.DetailBadge => {
	return installed
		? {
				label: {
					ar: "مركّب",
					en: "Installed",
				},
				tone: BridgeDetailTone.Success,
			}
		: {
				label: {
					ar: "مو مركّب",
					en: "Not installed",
				},
				tone: BridgeDetailTone.Neutral,
			};
};

const noLogBadge = (): Bridge.DetailBadge => {
	return {
		label: {
			ar: "ما كتب UE4SS ملف اللوق بعد",
			en: "UE4SS has not written its log yet",
		},
		tone: BridgeDetailTone.Neutral,
	};
};

const loadedBadge = (refused: number): Bridge.DetailBadge => {
	return refused > 0
		? {
				label: {
					ar: "هوك مرفوض بعد التحديث",
					en: "A hook was refused after an update",
				},
				tone: BridgeDetailTone.Warning,
			}
		: {
				label: {
					ar: "محمّل",
					en: "Loaded",
				},
				tone: BridgeDetailTone.Success,
			};
};

export const ue4ss: Bridge.Detail = {
	kind: BridgeKind.Detail,
	requiresRunning: false,
	refreshSeconds: REFRESH_SECONDS,

	async read(context) {
		const enabled = ue4ssEnabled(context.variable(UE4SS_VARIABLE));
		const installed = await ue4ssInstalled(context);
		const stamp = await readUe4ssStamp(context);
		const status = await readUe4ssLog(context);

		if (!enabled && !installed && stamp === null && status === null) {
			return null;
		}

		const mods = enabledMods(await readModsList(context)).length;
		const refused = status?.refused.length ?? 0;

		return {
			id: "ue4ss",
			title: "UE4SS",
			subtitle: {
				ar: "محمّل المودات اللي تشتغل عليه مودات لوا في بالورلد",
				en: "The mod loader Palworld Lua mods run on",
			},
			description: {
				ar: "هذي نسخة لينكس من المجتمع، مو النسخة الرسمية من UE4SS. أي تحديث للعبة ممكن يرفض هوك ويطفّيه لين تتحدث النسخة، والسيرفر يظل شغّال عادي.",
				en: "This is a community Linux port, not the official UE4SS build. A game update can refuse a hook and leave it off until the port catches up, and the server still boots.",
			},
			image: null,
			badges: [
				installedBadge(installed),
				...(enabled
					? [
							{
								label: {
									ar: "شغّال مع السيرفر",
									en: "Loaded on start",
								},
								tone: BridgeDetailTone.Success,
							},
						]
					: []),
				status === null ? noLogBadge() : loadedBadge(refused),
			],
			stats: [
				{
					key: "version",
					label: {
						ar: "الإصدار",
						en: "Version",
					},
					value: stamp?.version ?? status?.version ?? MISSING,
					format: BridgeDetailFormat.Text,
				},
				{
					key: "mods",
					label: {
						ar: "مودات شغّالة",
						en: "Mods enabled",
					},
					value: mods,
					format: BridgeDetailFormat.Number,
				},
				{
					key: "refused",
					label: {
						ar: "هوكات مرفوضة",
						en: "Refused hooks",
					},
					value: refused,
					format: BridgeDetailFormat.Number,
				},
			],
			links: [
				{
					label: {
						ar: "صفحة المشروع",
						en: "Project page",
					},
					url: UE4SS_PROJECT_URL,
				},
			],
			stale: false,
			actions: [],
		};
	},
};
