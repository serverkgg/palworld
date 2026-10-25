import { describe, expect, it } from "bun:test";
import { PalworldEdition } from "../shared";
import { type ModStatus, missingOf, modLoadsOf, stateOf } from "./modStatus";

describe("modLoadsOf", () => {
	it("reads the palschema and ue4ss mods the last start loaded from the ue4ss log", () => {
		const loads = modLoadsOf(
			[
				"[2026-10-19 12:03:33.8903143] Mod 'PalSchema' has enabled.txt, starting mod.",
				"[2026-10-19 12:03:39.9012979] [PalSchema] Loading mod: RefinedRanches Lean",
				"[2026-10-19 12:03:40.3818816] Mod 'ServerkHello' has enabled.txt, starting mod.",
			].join("\n"),
		);

		expect(loads.log).toEqual(true);
		expect([
			...loads.palschema,
		]).toEqual([
			"RefinedRanches Lean",
		]);
		expect([
			...loads.ue4ss,
		]).toEqual([
			"PalSchema",
			"ServerkHello",
		]);
	});

	it("knows the server has not written a log yet", () => {
		expect(modLoadsOf(null).log).toEqual(false);
	});
});

describe("stateOf", () => {
	const status = (overrides: Partial<ModStatus>): ModStatus => {
		return {
			oversized: false,
			enabled: true,
			server: true,
			missing: [],
			deployed: true,
			started: true,
			loaded: true,
			...overrides,
		};
	};

	it("says a mod runs on windows only while the server is on linux", () => {
		expect(stateOf(PalworldEdition.Linux, status({})).en).toEqual("Runs on Windows only");
	});

	it("confirms a mod only when the last start loaded it", () => {
		expect(
			[
				stateOf(PalworldEdition.Windows, status({})),
				stateOf(
					PalworldEdition.Windows,
					status({
						loaded: false,
					}),
				),
				stateOf(
					PalworldEdition.Windows,
					status({
						deployed: false,
					}),
				),
				stateOf(
					PalworldEdition.Windows,
					status({
						started: false,
						loaded: false,
					}),
				),
			].map((state) => state.en),
		).toEqual([
			"Running",
			"Couldn't start. Check the console",
			"Runs after a restart",
			"Runs after a restart",
		]);
	});

	it("marks a mod turned off and one made only for players", () => {
		expect(
			[
				stateOf(
					PalworldEdition.Windows,
					status({
						enabled: false,
					}),
				),
				stateOf(
					PalworldEdition.Windows,
					status({
						server: false,
					}),
				),
			].map((state) => state.en),
		).toEqual([
			"Off",
			"Doesn't run on servers",
		]);
	});

	it("names the mods a package needs that are not installed, before anything else about a mod that is on", () => {
		expect(
			[
				stateOf(
					PalworldEdition.Windows,
					status({
						missing: [
							"RemoteFastTravelCore",
						],
					}),
				),
				stateOf(
					PalworldEdition.Windows,
					status({
						enabled: false,
						missing: [
							"RemoteFastTravelCore",
						],
					}),
				),
			].map((state) => state.en),
		).toEqual([
			"Needs RemoteFastTravelCore, which isn't installed",
			"Off",
		]);
	});
});

describe("a package too large to place", () => {
	it("says it has too many files to place, on windows, whatever else is true of it", () => {
		expect(
			stateOf(PalworldEdition.Windows, {
				oversized: true,
				enabled: true,
				server: false,
				missing: [],
				deployed: false,
				started: false,
				loaded: false,
			}),
		).toEqual({
			ar: "تعذّر وضعه على السيرفر لكثرة ملفاته",
			en: "Too many files to place",
		});
	});
});

describe("missingOf", () => {
	it("names one missing mod, or lists several", () => {
		expect(
			missingOf([
				"CoreLib",
			]),
		).toEqual({
			ar: "يتطلب CoreLib، وهو غير مثبّت",
			en: "Needs CoreLib, which isn't installed",
		});
		expect(
			missingOf([
				"CoreLib",
				"PalHelper",
			]),
		).toEqual({
			ar: "يتطلب مودات غير مثبّتة: CoreLib، PalHelper",
			en: "Needs mods that aren't installed: CoreLib, PalHelper",
		});
	});
});
