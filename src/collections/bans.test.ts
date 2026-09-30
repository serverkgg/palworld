import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { bans } from "./bans";

const ADMIN_PASSWORD = "admin-s3cret";

const STEAM_KEY = "steam-key-s3cret";

interface Recorded {
	paths: string[];
	emitted: string[];
	reported: Bridge.Activity[];
	lookups: number;
}

const act = async (
	names: Record<string, string> | null,
	run: (context: Bridge.Context) => Promise<unknown>,
): Promise<Recorded> => {
	const recorded: Recorded = {
		paths: [],
		emitted: [],
		reported: [],
		lookups: 0,
	};
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request) {
			recorded.paths.push(new URL(request.url).pathname);

			return new Response("OK");
		},
	});

	const context = {
		codec: {
			ueIni: {
				read: async () => ({
					AdminPassword: ADMIN_PASSWORD,
					RESTAPIPort: server.port ?? 0,
				}),
			},
		},
		secret(key: string) {
			return names !== null && key === "STEAM_WEB_API_KEY" ? STEAM_KEY : null;
		},
		net: {
			async json(url: string) {
				recorded.lookups += 1;

				const steamIds = (new URL(url).searchParams.get("steamids") ?? "").split(",");

				return {
					response: {
						players: steamIds.flatMap((steamid) => {
							const personaname = names?.[steamid];

							return personaname === undefined
								? []
								: [
										{
											steamid,
											personaname,
										},
									];
						}),
					},
				};
			},
		},
		emit(event: string) {
			recorded.emitted.push(event);
		},
		activity: {
			report(entry: Bridge.Activity) {
				recorded.reported.push(entry);
			},
		},
		log() {},
	} as unknown as Bridge.Context;

	try {
		await run(context);

		return recorded;
	} finally {
		await server.stop(true);
	}
};

const unban = (row: Bridge.Row) => {
	return async (context: Bridge.Context) => {
		const remove = bans.actions?.remove;

		if (!remove) {
			throw new Error("the ban list lost its remove action");
		}

		await remove(context, row, {});
	};
};

describe("telling the owner who was banned or unbanned from the ban list", () => {
	test("reports a ban by user id beside the ban event, named by the id", async () => {
		const { paths, emitted, reported } = await act(null, async (context) => {
			await bans.add?.(context, "steam_76561198000000009");
		});

		expect(paths).toEqual([
			"/v1/api/ban",
		]);
		expect(emitted).toEqual([
			BridgeEventName.PlayerBanned,
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.PlayerBanned,
				text: {
					ar: "تم حظر steam_76561198000000009 (Steam)",
					en: "Banned steam_76561198000000009 (Steam)",
				},
				subject: "steam_76561198000000009",
				details: {
					userId: "steam_76561198000000009",
					platform: "Steam",
				},
			},
		]);
	});

	test("reports an unban by the name the ban list already shows", async () => {
		const { paths, emitted, reported } = await act(
			null,
			unban({
				id: "steam_76561198000000009",
				userId: "steam_76561198000000009",
				platform: "Steam",
				player: "Meslzy",
			}),
		);

		expect(paths).toEqual([
			"/v1/api/unban",
		]);
		expect(emitted).toEqual([]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.PlayerUnbanned,
				text: {
					ar: "تم فك الحظر عن Meslzy (Steam)",
					en: "Unbanned Meslzy (Steam)",
				},
				subject: "Meslzy",
				details: {
					userId: "steam_76561198000000009",
					platform: "Steam",
				},
			},
		]);
	});

	test("names an unban by the user id when the row carries no name, without asking steam", async () => {
		const { lookups, reported } = await act(
			{
				"76561198000000009": "Nasser",
			},
			unban({
				id: "steam_76561198000000009",
				player: "",
			}),
		);

		expect(reported.at(0)?.subject).toBe("steam_76561198000000009");
		expect(lookups).toBe(0);
	});

	test("reads the platform from the user id of an unnamed xbox ban", async () => {
		const { reported } = await act(
			{},
			unban({
				id: "gdk_2535400000000001",
				player: "",
			}),
		);

		expect(reported.at(0)?.subject).toBe("gdk_2535400000000001");
		expect(reported.at(0)?.details?.platform).toBe("Xbox");
	});

	test("never puts the admin password or the steam key into what it reports", async () => {
		const { reported } = await act(
			{
				"76561198000000009": "Nasser",
			},
			async (context) => {
				await bans.add?.(context, "steam_76561198000000009");
				await unban({
					id: "steam_76561198000000009",
					player: "",
				})(context);
			},
		);

		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.PlayerBanned,
			BridgeEventName.PlayerUnbanned,
		]);
		expect(JSON.stringify(reported)).not.toContain(ADMIN_PASSWORD);
		expect(JSON.stringify(reported)).not.toContain(STEAM_KEY);
	});
});
