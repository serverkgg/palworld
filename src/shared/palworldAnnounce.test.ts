import { describe, expect, test } from "bun:test";
import { ANNOUNCE_MESSAGE_LENGTH, messageArgument } from "./palworldAnnounce";

describe("reading the message an admin typed into the announce action", () => {
	test("passes an ordinary message straight through", () => {
		expect(
			messageArgument({
				message: "السيرفر يرجع بعد خمس دقايق",
			}),
		).toBe("السيرفر يرجع بعد خمس دقايق");
	});

	test("trims the edges so a stray space is not announced", () => {
		expect(
			messageArgument({
				message: "  restarting soon  ",
			}),
		).toBe("restarting soon");
	});

	test("collapses newlines and tabs into single spaces, because palworld announces one line", () => {
		expect(
			messageArgument({
				message: "restart\n\nin\tfive\r\nminutes",
			}),
		).toBe("restart in five minutes");
	});

	test("cuts an over-long message down to the length the panel field advertises", () => {
		const message = messageArgument({
			message: "ب".repeat(ANNOUNCE_MESSAGE_LENGTH + 50),
		});

		expect(message).toHaveLength(ANNOUNCE_MESSAGE_LENGTH);
	});

	test("leaves a message that is exactly at the limit alone", () => {
		expect(
			messageArgument({
				message: "b".repeat(ANNOUNCE_MESSAGE_LENGTH),
			}),
		).toHaveLength(ANNOUNCE_MESSAGE_LENGTH);
	});

	test("refuses an empty message", () => {
		expect(() => {
			return messageArgument({
				message: "",
			});
		}).toThrow();
	});

	test("refuses a message that is only whitespace", () => {
		expect(() => {
			return messageArgument({
				message: " \n\t ",
			});
		}).toThrow();
	});

	test("refuses a missing message", () => {
		expect(() => {
			return messageArgument({});
		}).toThrow();
	});

	test("refuses a null message", () => {
		expect(() => {
			return messageArgument({
				message: null,
			});
		}).toThrow();
	});

	test("accepts a number the panel sent as a value", () => {
		expect(
			messageArgument({
				message: 5,
			}),
		).toBe("5");
	});
});
