import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings, validateDistinctTags, validateTag } from "../src/core/settings-model";

describe("validateTag", () => {
	it("accepts Obsidian tag names", () => {
		for (const tag of ["decision", "Décision", "決定", "a/b", "my_tag-1", "2026q4", "choice/長期"]) {
			expect(validateTag(tag), tag).toBeUndefined();
		}
	});

	it("rejects empty, spaced, hashed and malformed tags", () => {
		expect(validateTag("")).toBeTruthy();
		expect(validateTag("   ")).toBeTruthy();
		expect(validateTag("#decision")).toBeTruthy();
		expect(validateTag("my decision")).toBeTruthy();
		expect(validateTag("a,b")).toBeTruthy();
		expect(validateTag("a.b")).toBeTruthy();
		expect(validateTag("2026")).toBeTruthy();
	});
});

describe("validateDistinctTags", () => {
	it("rejects equal tags, ignoring case", () => {
		expect(validateDistinctTags("decision", "Decision")).toBeTruthy();
		expect(validateDistinctTags("decision", "prediction")).toBeUndefined();
	});
});

describe("normalizeSettings", () => {
	it("returns the defaults for missing or unusable data", () => {
		for (const data of [undefined, null, 42, "x", [], {}, { journal: null }, { journal: [] }]) {
			expect(normalizeSettings(data)).toEqual(DEFAULT_SETTINGS);
		}
	});

	it("merges key by key", () => {
		expect(normalizeSettings({ journal: { enabled: false } }).journal).toEqual({ enabled: false, decisionTag: "decision", predictionTag: "prediction" });
		expect(normalizeSettings({ journal: { decisionTag: "choix" } }).journal).toEqual({ enabled: true, decisionTag: "choix", predictionTag: "prediction" });
	});

	it("keeps valid values", () => {
		const saved = { journal: { enabled: false, decisionTag: "choix", predictionTag: "pari" } };
		expect(normalizeSettings(saved)).toEqual(saved);
	});

	it("replaces invalid values by their default", () => {
		const loaded = normalizeSettings({ journal: { enabled: "yes", decisionTag: "#bad tag", predictionTag: 7 } });
		expect(loaded).toEqual(DEFAULT_SETTINGS);
	});

	it("resets both tags when they clash", () => {
		const loaded = normalizeSettings({ journal: { decisionTag: "pari", predictionTag: "PARI" } });
		expect(loaded.journal).toMatchObject({ decisionTag: "decision", predictionTag: "prediction" });
	});

	it("drops unknown keys and does not share the defaults object", () => {
		const loaded = normalizeSettings({ journal: { other: 1 }, future: true });
		expect(loaded).toEqual(DEFAULT_SETTINGS);
		expect(loaded.journal).not.toBe(DEFAULT_SETTINGS.journal);
	});
});
