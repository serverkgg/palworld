import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { banPlayer, kickPlayer } from "./players";

const ADMIN_PASSWORD = "admin-s3cret";

interface Recorded {
	paths: string[];
	emitted: string[];
	reported: Bridge.Activity[];
}

const MESLZY: Bridge.Row = {
	id: "steam_76561198000000001",
	name: "Meslzy",
	platform: "Steam",
};

const act = async (action: Bridge.RowAction, row: Bridge.Row): Promise<Recorded> => {
	const recorded: Recorded = {
		paths: [],
		emitted: [],
		reported: [],
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
		emit(event: string) {
			recorded.emitted.push(event);
		},
		activity: {
			report(entry: Bridge.Activity) {
				recorded.reported.push(entry);
			},
		},
		log() {},
		variable() {
			return null;
		},
	} as unknown as Bridge.Context;

	try {
		await action(context, row, {});

		return recorded;
	} finally {
		await server.stop(true);
	}
};

describe("telling the owner who was kicked or banned from the players table", () => {
	it("reports a kick with the player's name and platform, beside the kick event", async () => {
		const { paths, emitted, reported } = await act(kickPlayer, MESLZY);

		expect(paths).toEqual([
			"/v1/api/kick",
		]);
		expect(emitted).toEqual([
			BridgeEventName.PlayerKicked,
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.PlayerKicked,
				text: {
					ar: "تم طرد Meslzy (Steam)",
					en: "Kicked Meslzy (Steam)",
				},
				subject: "Meslzy",
				details: {
					userId: "steam_76561198000000001",
					platform: "Steam",
				},
			},
		]);
	});

	it("reports a ban with the player's name and platform, beside the ban event", async () => {
		const { emitted, reported } = await act(banPlayer, MESLZY);

		expect(emitted).toEqual([
			BridgeEventName.PlayerBanned,
		]);
		expect(reported.map((entry) => entry.name)).toEqual([
			BridgeEventName.PlayerBanned,
		]);
		expect(reported.at(0)?.subject).toBe("Meslzy");
		expect(reported.at(0)?.text.ar).toBe("تم حظر Meslzy (Steam)");
	});

	it("names an xbox player by the platform their id carries", async () => {
		const { reported } = await act(kickPlayer, {
			id: "gdk_2535400000000001",
			name: "Nasser",
		});

		expect(reported.at(0)?.details).toEqual({
			userId: "gdk_2535400000000001",
			platform: "Xbox",
		});
	});

	it("never puts the admin password into what it reports", async () => {
		for (const action of [
			kickPlayer,
			banPlayer,
		]) {
			expect(JSON.stringify((await act(action, MESLZY)).reported)).not.toContain(ADMIN_PASSWORD);
		}
	});
});
