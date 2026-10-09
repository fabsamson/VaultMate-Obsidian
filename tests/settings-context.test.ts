import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings, parseList, validatePropertyList } from "../src/core/settings-model";

describe("new connections settings", () => {
	it("has generic defaults", () => {
		expect(DEFAULT_SETTINGS.context).toEqual({ enabled: true, excludedFolders: [], peopleProperties: ["author", "authors", "people"], maxConnections: 3 });
		expect(DEFAULT_SETTINGS.contextState).toEqual({ notUseful: [] });
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
		expect(loaded.context).toEqual({ enabled: false, excludedFolders: ["Templates", "a/b"], peopleProperties: ["who", "where"], maxConnections: 3 });
		expect(normalizeSettings({ context: { excludedFolders: "x", peopleProperties: null } }).context).toEqual(DEFAULT_SETTINGS.context);
		expect(normalizeSettings({ context: { peopleProperties: [] } }).context.peopleProperties).toEqual([]);
	});

	it("keeps the maximum number of connections between 1 and 5", () => {
		const max = (value: unknown) => normalizeSettings({ context: { maxConnections: value } }).context.maxConnections;
		expect([1, 2, 5].map(max)).toEqual([1, 2, 5]);
		expect([0, 6, 2.5, "3", null].map(max)).toEqual([3, 3, 3, 3, 3]);
	});

	it("loads the pairs marked not useful, sorted, once each and only when valid", () => {
		const loaded = normalizeSettings({ contextState: { notUseful: [["b.md", "a.md"], ["a.md", "b.md"], ["a.md", "a.md"], ["a.md"], [1, "x"], "nope", ["c.md", ""], ["c.md", "d.md"]] } });
		expect(loaded.contextState.notUseful).toEqual([["a.md", "b.md"], ["c.md", "d.md"]]);
		expect(normalizeSettings({ contextState: { notUseful: "x" } }).contextState.notUseful).toEqual([]);
		expect(normalizeSettings(undefined).contextState.notUseful).toEqual([]);
	});
});
