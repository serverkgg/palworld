import { type Bridge, BridgeDetailFormat, BridgeDetailTone, BridgeKind } from "@serverkgg/bridge";
import { formatUptime } from "@serverkgg/bridge/utils";
import { LAG_FPS_THRESHOLD, metrics, readInfo } from "../shared";

const REFRESH_SECONDS = 15;

export const SMOOTH_FPS_THRESHOLD = 50;

const MISSING = "—";

export const fpsBadge = (fps: number): Bridge.DetailBadge => {
	if (fps >= SMOOTH_FPS_THRESHOLD) {
		return {
			label: {
				ar: "سلس",
				en: "Smooth",
			},
			tone: BridgeDetailTone.Success,
		};
	}

	if (fps >= LAG_FPS_THRESHOLD) {
		return {
			label: {
				ar: "لاق خفيف",
				en: "Slight lag",
			},
			tone: BridgeDetailTone.Warning,
		};
	}

	return {
		label: {
			ar: "لاق واضح",
			en: "Lagging",
		},
		tone: BridgeDetailTone.Danger,
	};
};

const versionOf = async (context: Bridge.Context) => {
	try {
		return (await readInfo(context)).version ?? null;
	} catch {
		return null;
	}
};

const roundOne = (value: number) => {
	return Math.round(value * 10) / 10;
};

export const health: Bridge.Detail = {
	kind: BridgeKind.Detail,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,

	async read(context) {
		const live = await metrics.sample(context);
		const current = live ?? metrics.latest();

		if (current === null) {
			return null;
		}

		const version = await versionOf(context);
		const fps = current.serverfps ?? null;
		const online = current.currentplayernum;
		const max = current.maxplayernum;

		return {
			id: "health",
			title: {
				ar: "حالة السيرفر",
				en: "Server health",
			},
			subtitle: {
				ar: "هذه الأرقام صادرة من سيرفرك مباشرة، وليست تقديرًا.",
				en: "These numbers come straight from your own server, not an estimate.",
			},
			description: null,
			image: null,
			badges: [
				...(fps === null
					? []
					: [
							fpsBadge(fps),
						]),
				...(version === null
					? []
					: [
							{
								label: {
									ar: version,
									en: version,
								},
								tone: BridgeDetailTone.Neutral,
							},
						]),
			],
			stats: [
				{
					key: "fps",
					label: {
						ar: "الإطارات بالثانية",
						en: "Server FPS",
					},
					value: fps ?? MISSING,
					format: fps === null ? BridgeDetailFormat.Text : BridgeDetailFormat.Number,
				},
				{
					key: "frametime",
					label: {
						ar: "زمن الإطار (ms)",
						en: "Frame time (ms)",
					},
					value: current.serverframetime === undefined ? MISSING : roundOne(current.serverframetime),
					format: current.serverframetime === undefined ? BridgeDetailFormat.Text : BridgeDetailFormat.Number,
				},
				{
					key: "players",
					label: {
						ar: "اللاعبون",
						en: "Players",
					},
					value: online === undefined || max === undefined ? MISSING : `${online}/${max}`,
					format: BridgeDetailFormat.Text,
				},
				{
					key: "days",
					label: {
						ar: "أيام داخل اللعبة",
						en: "In-game days",
					},
					value: current.days ?? MISSING,
					format: current.days === undefined ? BridgeDetailFormat.Text : BridgeDetailFormat.Number,
				},
				{
					key: "bases",
					label: {
						ar: "القواعد",
						en: "Bases",
					},
					value: current.basecampnum ?? MISSING,
					format: current.basecampnum === undefined ? BridgeDetailFormat.Text : BridgeDetailFormat.Number,
				},
				{
					key: "uptime",
					label: {
						ar: "مدة التشغيل",
						en: "Up for",
					},
					value: current.uptime === undefined ? MISSING : formatUptime(current.uptime),
					format: BridgeDetailFormat.Text,
				},
			],
			links: [],
			stale: live === null,
			actions: [],
		};
	},
};
