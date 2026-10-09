import { describe, expect, it } from "vitest";

import { cleanFolderPath, DEFAULT_SETTINGS, normalizeSettings, validateActionsFolder, validateDistinctTags, validateTag } from "../src/core/settings-model";

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
		const saved = {
			journal: { enabled: false, decisionTag: "choix", predictionTag: "pari" },
			journalState: { lastNoticeDate: "2026-10-09" },
			ai: { enabled: false, baseUrl: "http://localhost:1234/v1", model: "local", apiKeySecret: "kotoba-key", actionsFolder: "Prompts/AI" },
			aiState: { confirmed: { "Prompts/AI/A.md": ["note", "properties"] }, notInterested: { movie: ["Heat"] } },
			collections: { folder: "Media", typeProperty: "kind", ratingProperty: "score" },
			location: { enabled: false, latitudeProperty: "lat", longitudeProperty: "lng", labelProperty: "where", androidApp: true },
			context: { enabled: false, excludedFolders: ["Templates"], peopleProperties: ["who"], maxConnections: 5 },
			contextState: { notUseful: [["A.md", "B.md"]] },
		};
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

	it("drops an invalid notice date", () => {
		for (const bad of ["yesterday", 5, null, "2026-1-9"]) {
			expect(normalizeSettings({ journalState: { lastNoticeDate: bad } }).journalState.lastNoticeDate).toBe("");
		}
	});

	it("drops unknown keys and does not share the defaults object", () => {
		const loaded = normalizeSettings({ journal: { other: 1 }, future: true });
		expect(loaded).toEqual(DEFAULT_SETTINGS);
		expect(loaded.journal).not.toBe(DEFAULT_SETTINGS.journal);
	});
});

describe("AI settings", () => {
	it("has generic defaults", () => {
		expect(DEFAULT_SETTINGS.ai).toEqual({ enabled: true, baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna", apiKeySecret: "", actionsFolder: "VaultMate/AI actions" });
		expect(DEFAULT_SETTINGS.aiState).toEqual({ confirmed: {}, notInterested: {} });
	});

	it("replaces an insecure or malformed base URL, an empty model and an empty folder by their default", () => {
		const loaded = normalizeSettings({ ai: { baseUrl: "http://example.com/v1", model: "  ", actionsFolder: "//", apiKeySecret: 3, enabled: "no" } });
		expect(loaded.ai).toEqual(DEFAULT_SETTINGS.ai);
	});

	it("accepts a local HTTP server and cleans the folder path", () => {
		const loaded = normalizeSettings({ ai: { baseUrl: " http://127.0.0.1:8080/v1 ", actionsFolder: "/My\\AI//actions/" } });
		expect(loaded.ai).toMatchObject({ baseUrl: "http://127.0.0.1:8080/v1", actionsFolder: "My/AI/actions" });
	});

	it("drops malformed confirmations and keeps the valid ones", () => {
		const loaded = normalizeSettings({ aiState: { confirmed: { "a.md": ["note"], "b.md": "note", "c.md": [1], "d.md": null } } });
		expect(loaded.aiState.confirmed).toEqual({ "a.md": ["note"] });
		expect(normalizeSettings({ aiState: { confirmed: [] } }).aiState.confirmed).toEqual({});
	});

	it("cleans and validates the actions folder", () => {
		expect(cleanFolderPath(" A\\B/ ")).toBe("A/B");
		expect(validateActionsFolder("  ")).toBeTruthy();
		expect(validateActionsFolder("VaultMate/AI actions")).toBeUndefined();
	});
});

describe("collection settings", () => {
	it("defaults to the whole vault, type and rating", () => {
		expect(normalizeSettings(undefined).collections).toEqual({ folder: "", typeProperty: "type", ratingProperty: "rating" });
	});

	it("keeps valid values and cleans the folder", () => {
		const { collections } = normalizeSettings({ collections: { folder: "/Media//Films/", typeProperty: "kind", ratingProperty: "score" } });
		expect(collections).toEqual({ folder: "Media/Films", typeProperty: "kind", ratingProperty: "score" });
	});

	it("falls back when the properties are invalid or the same", () => {
		expect(normalizeSettings({ collections: { typeProperty: "a b", ratingProperty: "" } }).collections).toMatchObject({ typeProperty: "type", ratingProperty: "rating" });
		expect(normalizeSettings({ collections: { typeProperty: "Score", ratingProperty: "score" } }).collections).toMatchObject({ typeProperty: "type", ratingProperty: "rating" });
	});

	it("keeps the Not interested titles per type and drops anything else", () => {
		const { aiState } = normalizeSettings({ aiState: { notInterested: { movie: ["Heat", 3, null], bad: "x" } } });
		expect(aiState.notInterested).toEqual({ movie: ["Heat"] });
	});
});

