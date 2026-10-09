import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings, parseList, validatePropertyList } from "../src/core/settings-model";

describe("related notes settings", () => {
	it("has generic defaults", () => {
		expect(DEFAULT_SETTINGS.context).toEqual({ enabled: true, excludedFolders: [], peopleProperties: ["author", "authors", "people"] });
	});

	it("parses comma or line separated lists without empties or duplicates", () => {
		expect(parseList(" a, b ,,a\nc ")).toEqual(["a", "b", "c"]);
		expect(parseList("")).toEqual([]);
	});

	it("validates a list of property names; empty is allowed", () => {
		expect(validatePropertyList("author, people")).toBeUndefined();
		expect(validatePropertyList("")).toBeUndefined();
		expect(validatePropertyList("author, bad name")).toContain("bad name");
	});

	it("normalizes loaded values and falls back to the defaults", () => {
		const loaded = normalizeSettings({ context: { enabled: false, excludedFolders: ["/Templates/", "", "a\\b", 3], peopleProperties: ["who", "bad name", " where "] } });
		expect(loaded.context).toEqual({ enabled: false, excludedFolders: ["Templates", "a/b"], peopleProperties: ["who", "where"] });
		expect(normalizeSettings({ context: { excludedFolders: "x", peopleProperties: null } }).context).toEqual(DEFAULT_SETTINGS.context);
		expect(normalizeSettings({ context: { peopleProperties: [] } }).context.peopleProperties).toEqual([]);
	});
});
