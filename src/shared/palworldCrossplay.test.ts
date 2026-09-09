import { describe, expect, test } from "bun:test";
import {
	CROSSPLAY_KEY,
	CROSSPLAY_MAC_KEY,
	CROSSPLAY_PS5_KEY,
	CROSSPLAY_XBOX_KEY,
	crossplayRaw,
	crossplayValues,
	foldCrossplay,
	parseCrossplay,
	serializeCrossplay,
} from "./palworldCrossplay";

describe("reading the crossplay tuple palworld keeps in one key", () => {
	test("treats a missing key as every platform welcome, the way the game does", () => {
		expect(parseCrossplay(null)).toEqual({
			xbox: true,
			ps5: true,
			mac: true,
		});
	});

	test("treats an empty value the same as a missing one", () => {
		expect(parseCrossplay("   ")).toEqual({
			xbox: true,
			ps5: true,
			mac: true,
		});
	});

	test("reads the shipped default", () => {
		expect(parseCrossplay("(Steam,Xbox,PS5,Mac)")).toEqual({
			xbox: true,
			ps5: true,
			mac: true,
		});
	});

	test("reads the platforms in any order and any case", () => {
		expect(parseCrossplay("( mac , STEAM , xBox )")).toEqual({
			xbox: true,
			ps5: false,
			mac: true,
		});
	});

	test("reads a steam-only server as every console shut out", () => {
		expect(parseCrossplay("(Steam)")).toEqual({
			xbox: false,
			ps5: false,
			mac: false,
		});
	});
});

describe("writing the crossplay tuple back", () => {
	test("keeps steam first and the rest in the order the game writes them", () => {
		expect(
			serializeCrossplay({
				xbox: true,
				ps5: true,
				mac: true,
			}),
		).toBe("(Steam,Xbox,PS5,Mac)");
	});

	test("drops the platforms that are off", () => {
		expect(
			serializeCrossplay({
				xbox: false,
				ps5: true,
				mac: false,
			}),
		).toBe("(Steam,PS5)");
	});

	test("never writes an empty tuple, because the server itself is steam", () => {
		expect(
			serializeCrossplay({
				xbox: false,
				ps5: false,
				mac: false,
			}),
		).toBe("(Steam)");
	});

	test("survives a round trip", () => {
		const raw = "(Steam,Xbox,Mac)";

		expect(serializeCrossplay(parseCrossplay(raw))).toBe(raw);
	});
});

describe("showing crossplay as three toggles the panel can render", () => {
	test("splits the tuple into the three virtual keys", () => {
		expect(
			crossplayValues({
				[CROSSPLAY_KEY]: "(Steam,PS5)",
			}),
		).toEqual({
			[CROSSPLAY_XBOX_KEY]: false,
			[CROSSPLAY_PS5_KEY]: true,
			[CROSSPLAY_MAC_KEY]: false,
		});
	});

	test("answers with every toggle on when the key is not in the file", () => {
		expect(crossplayValues({})).toEqual({
			[CROSSPLAY_XBOX_KEY]: true,
			[CROSSPLAY_PS5_KEY]: true,
			[CROSSPLAY_MAC_KEY]: true,
		});
	});

	test("only reads a string, because anything else is not a tuple", () => {
		expect(
			crossplayRaw({
				[CROSSPLAY_KEY]: 5,
			}),
		).toBeNull();
	});
});

describe("folding the three toggles back into one key", () => {
	test("leaves a write that never mentions crossplay alone", () => {
		expect(
			foldCrossplay(
				{
					ExpRate: 2,
				},
				"(Steam,Xbox)",
			),
		).toEqual({
			ExpRate: 2,
		});
	});

	test("keeps the platforms the customer did not touch", () => {
		expect(
			foldCrossplay(
				{
					[CROSSPLAY_MAC_KEY]: false,
				},
				"(Steam,Xbox,PS5,Mac)",
			),
		).toEqual({
			[CROSSPLAY_KEY]: "(Steam,Xbox,PS5)",
		});
	});

	test("strips the virtual keys, so none of them reaches the ini", () => {
		const folded = foldCrossplay(
			{
				[CROSSPLAY_XBOX_KEY]: true,
				[CROSSPLAY_PS5_KEY]: false,
				[CROSSPLAY_MAC_KEY]: false,
				ServerName: "بيت الأصحاب",
			},
			"(Steam)",
		);

		expect(folded).toEqual({
			ServerName: "بيت الأصحاب",
			[CROSSPLAY_KEY]: "(Steam,Xbox)",
		});
		expect(Object.keys(folded)).not.toContain(CROSSPLAY_XBOX_KEY);
	});

	test("starts from every platform on when the key was never written", () => {
		expect(
			foldCrossplay(
				{
					[CROSSPLAY_XBOX_KEY]: false,
				},
				null,
			),
		).toEqual({
			[CROSSPLAY_KEY]: "(Steam,PS5,Mac)",
		});
	});
});
