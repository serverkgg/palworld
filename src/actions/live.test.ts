import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { live } from "./live";

const ADMIN_PASSWORD = "admin-s3cret";

interface Recorded {
	bodies: string[];
	emitted: string[];
	reported: Bridge.Activity[];
}

const act = async (action: string, args: Bridge.Values = {}): Promise<Recorded> => {
	const recorded: Recorded = {
		bodies: [],
		emitted: [],
		reported: [],
	};
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			recorded.bodies.push(await request.text());

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
	} as unknown as Bridge.Context;

	const run = live.actions[action];

	if (!run) {
		throw new Error(`the live actions lost "${action}"`);
	}

	try {
		await run(context, args);

		return recorded;
	} finally {
		await server.stop(true);
	}
};

describe("telling the owner what the live actions did", () => {
	it("reports a short broadcast whole", async () => {
		const { reported } = await act("announce", {
			message: "restart in 5 minutes",
		});

		expect(reported).toEqual([
			{
				name: BridgeEventName.BroadcastSent,
				text: {
					ar: "تم إرسال رسالة إلى اللاعبين: «restart in 5 minutes»",
					en: 'Sent a message to players: "restart in 5 minutes"',
				},
				details: {
					length: 20,
				},
			},
		]);
	});

	it("reports a long broadcast only as an 80 character excerpt, while the game gets all of it", async () => {
		const message = `${"word ".repeat(30)}end`;
		const { bodies, reported } = await act("announce", {
			message,
		});

		expect(JSON.parse(bodies.at(0) ?? "{}").message).toBe(message);

		const excerpt = /"(?<quoted>.*)"$/.exec(reported.at(0)?.text.en ?? "")?.groups?.quoted ?? "";

		expect(excerpt.length).toBeLessThanOrEqual(80);
		expect(excerpt.endsWith("…")).toBe(true);
		expect(reported.at(0)?.text.ar).toContain(excerpt);
	});

	it("reports a save as a gameplay change, beside the save event a backup waits for", async () => {
		const { emitted, reported } = await act("save");

		expect(emitted).toEqual([
			BridgeEventName.WorldSaved,
		]);
		expect(reported).toEqual([
			{
				name: BridgeEventName.GameplayChanged,
				text: {
					ar: "تم حفظ الماب",
					en: "Saved the world",
				},
				details: {
					what: "save",
				},
			},
		]);
	});

	it("refuses an empty broadcast before anything is sent or reported", async () => {
		await expect(
			act("announce", {
				message: "   ",
			}),
		).rejects.toThrow("Write the message first.");
	});

	it("never puts the admin password into what it reports", async () => {
		for (const action of [
			"announce",
			"save",
		]) {
			const { reported } = await act(action, {
				message: "hello",
			});

			expect(JSON.stringify(reported)).not.toContain(ADMIN_PASSWORD);
		}
	});
});
