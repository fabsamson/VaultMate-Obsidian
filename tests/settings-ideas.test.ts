import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings, validateDistinctIdeaTag } from "../src/core/settings-model";

describe("validateDistinctIdeaTag", () => {
	it("rejects the tag of a decision or a prediction, ignoring case", () => {
		expect(validateDistinctIdeaTag("idea", "Idea")).toBeTruthy();
		expect(validateDistinctIdeaTag("idea", "decision")).toBeUndefined();
	});
});

describe("normalizeSettings for ideas", () => {
	it("defaults to ideas on with the idea tag and no folder or template", () => {
		expect(DEFAULT_SETTINGS.ideas).toEqual({ enabled: true, tag: "idea", newNoteFolder: "", newNoteTemplate: "" });
		for (const data of [undefined, {}, { ideas: null }, { ideas: [] }, { ideas: "x" }]) {
			expect(normalizeSettings(data).ideas).toEqual(DEFAULT_SETTINGS.ideas);
		}
	});

	it("merges key by key", () => {
		expect(normalizeSettings({ ideas: { enabled: false } }).ideas).toEqual({ ...DEFAULT_SETTINGS.ideas, enabled: false });
		expect(normalizeSettings({ ideas: { tag: "Idée/work" } }).ideas.tag).toBe("Idée/work");
	});

	it("falls back to the default for an invalid tag or a wrong type", () => {
		for (const tag of ["#idea", "my idea", "", "2026", 42, null]) {
			expect(normalizeSettings({ ideas: { tag } }).ideas.tag, String(tag)).toBe("idea");
		}
		expect(normalizeSettings({ ideas: { enabled: "yes", newNoteFolder: 3, newNoteTemplate: false } }).ideas).toEqual(DEFAULT_SETTINGS.ideas);
	});

	it("does not accept a tag that is a decision or prediction tag", () => {
		expect(normalizeSettings({ ideas: { tag: "Decision" } }).ideas.tag).toBe("idea");
		expect(normalizeSettings({ ideas: { tag: "prediction" } }).ideas.tag).toBe("idea");
		expect(normalizeSettings({ journal: { decisionTag: "choice" }, ideas: { tag: "decision" } })).toMatchObject({
			journal: { decisionTag: "choice" },
			ideas: { tag: "decision" },
		});
	});

	it("resets the journal tags when even the default idea tag clashes with them", () => {
		const settings = normalizeSettings({ journal: { decisionTag: "idea", predictionTag: "bet" }, ideas: { tag: "bet" } });
		expect(settings.journal).toMatchObject({ decisionTag: "decision", predictionTag: "prediction" });
		expect(settings.ideas.tag).toBe("idea");
	});

	it("cleans the folder and the template path", () => {
		expect(normalizeSettings({ ideas: { newNoteFolder: " \\Ideas\\Inbox/ ", newNoteTemplate: "/Templates//Idea.md" } }).ideas).toMatchObject({
			newNoteFolder: "Ideas/Inbox",
			newNoteTemplate: "Templates/Idea.md",
		});
		expect(normalizeSettings({ ideas: { newNoteFolder: " / " } }).ideas.newNoteFolder).toBe("");
	});

	it("is stable when normalized twice", () => {
		const once = normalizeSettings({ ideas: { tag: "Idea", newNoteFolder: "A//B" } });
		expect(normalizeSettings(once)).toEqual(once);
	});
});
