import { describe, expect, it } from "bun:test";
import { ANNOUNCE_MESSAGE_LENGTH, messageArgument } from "./palworldAnnounce";

describe("reading the message an admin typed into the announce action", () => {
	it("passes an ordinary message straight through", () => {
		expect(
			messageArgument({
				message: "السيرفر يرجع بعد خمس دقايق",
			}),
		).toBe("السيرفر يرجع بعد خمس دقايق");
	});

	it("trims the edges so a stray space is not announced", () => {
		expect(
			messageArgument({
				message: "  restarting soon  ",
			}),
		).toBe("restarting soon");
	});

	it("collapses newlines and tabs into single spaces, because palworld announces one line", () => {
		expect(
			messageArgument({
				message: "restart\n\nin\tfive\r\nminutes",
			}),
		).toBe("restart in five minutes");
	});

	it("cuts an over-long message down to the length the panel field advertises", () => {
		const message = messageArgument({
			message: "ب".repeat(ANNOUNCE_MESSAGE_LENGTH + 50),
		});

		expect(message).toHaveLength(ANNOUNCE_MESSAGE_LENGTH);
	});

	it("leaves a message that is exactly at the limit alone", () => {
		expect(
			messageArgument({
				message: "b".repeat(ANNOUNCE_MESSAGE_LENGTH),
			}),
		).toHaveLength(ANNOUNCE_MESSAGE_LENGTH);
	});

	it("refuses an empty message", () => {
		expect(() => {
			return messageArgument({
				message: "",
			});
		}).toThrow();
	});

	it("refuses a message that is only whitespace", () => {
		expect(() => {
			return messageArgument({
				message: " \n\t ",
			});
		}).toThrow();
	});

	it("refuses a missing message", () => {
		expect(() => {
			return messageArgument({});
		}).toThrow();
	});

	it("refuses a null message", () => {
		expect(() => {
			return messageArgument({
				message: null,
			});
		}).toThrow();
	});

	it("accepts a number the panel sent as a value", () => {
		expect(
			messageArgument({
				message: 5,
			}),
		).toBe("5");
	});
});
