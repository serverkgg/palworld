import { describe, expect, test } from "bun:test";
import { REST_API_PORT } from "../shared";
import { needsAdminPassword, seedPatch } from "./seedSettings";

describe("deciding whether an install has to generate an admin password", () => {
	test("generates one when the settings carry no admin password", () => {
		expect(needsAdminPassword({})).toBe(true);
	});

	test("generates one when the shipped defaults left it empty", () => {
		expect(
			needsAdminPassword({
				AdminPassword: "",
			}),
		).toBe(true);
	});

	test("generates one when the codec read it back as null", () => {
		expect(
			needsAdminPassword({
				AdminPassword: null,
			}),
		).toBe(true);
	});

	test("keeps the password a player already set, so reinstalling never locks them out", () => {
		expect(
			needsAdminPassword({
				AdminPassword: "chosen-by-the-player",
			}),
		).toBe(false);
	});

	test("keeps a password made only of whitespace, because palworld accepts it as set", () => {
		expect(
			needsAdminPassword({
				AdminPassword: " ",
			}),
		).toBe(false);
	});

	test("keeps a numeric password the codec read back unquoted", () => {
		expect(
			needsAdminPassword({
				AdminPassword: 1234,
			}),
		).toBe(false);
	});
});

describe("building the settings patch an install writes", () => {
	test("always turns the rest api on and pins it to the port the driver talks to", () => {
		expect(seedPatch(null)).toEqual({
			RESTAPIEnabled: true,
			RESTAPIPort: REST_API_PORT,
		});
	});

	test("never overwrites an existing admin password", () => {
		expect(Object.keys(seedPatch(null))).not.toContain("AdminPassword");
	});

	test("writes the generated password alongside the rest api settings", () => {
		expect(seedPatch("generated")).toEqual({
			RESTAPIEnabled: true,
			RESTAPIPort: REST_API_PORT,
			AdminPassword: "generated",
		});
	});

	test("still enables the rest api when it generates a password", () => {
		expect(seedPatch("generated").RESTAPIEnabled).toBe(true);
	});
});
