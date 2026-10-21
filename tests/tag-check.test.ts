import { describe, expect, it } from "vitest";

import { countPlainTagLines, countTagUse, needsTagNotice, TAG_CHECK_THRESHOLD, type CachedNote } from "../src/core/tag-check";

const at = (line: number): { start: { line: number } } => ({ start: { line } });

describe("countPlainTagLines", () => {
	it("counts distinct lines with exactly the idea tag that are not tasks", () => {
		const cache: CachedNote = {
			tags: [
				{ tag: "#idea", position: at(1) },
				{ tag: "#Idea", position: at(2) },
				{ tag: "#idea", position: at(3) },
				{ tag: "#idea/work", position: at(4) },
				{ tag: "#ideas", position: at(5) },
				{ tag: "#idea", position: at(6) },
				{ tag: "#idea", position: at(6) },
			],
			listItems: [
				{ task: " ", position: at(3) },
				{ position: at(2) },
			],
		};
		expect(countPlainTagLines(cache, "idea")).toBe(3);
	});

	it("is 0 without tags or cache", () => {
		expect(countPlainTagLines(null, "idea")).toBe(0);
		expect(countPlainTagLines({}, "idea")).toBe(0);
	});
});

describe("countTagUse", () => {
	const caches: CachedNote[] = [{ frontmatter: { tags: ["project"] } }, { frontmatter: { tags: "other" }, tags: [{ tag: "#idea", position: at(0) }] }, {}];
	const options = { ideasOn: true, ideaTag: "idea", journalOn: true, decisionTag: "decision", predictionTag: "prediction", projectsOn: true, projectTag: "project" };

	it("counts both uses", () => {
		expect(countTagUse(caches, options)).toEqual({ ideaLines: 1, decisionLines: 0, predictionLines: 0, projectNotes: 1 });
	});

	it("does not count a feature that is off", () => {
		expect(countTagUse(caches, { ...options, ideasOn: false, journalOn: false, projectsOn: false })).toEqual({ ideaLines: null, decisionLines: null, predictionLines: null, projectNotes: null });
	});
});

describe("needsTagNotice", () => {
	it("warns from the threshold on, for either count", () => {
		expect(needsTagNotice({ ideaLines: TAG_CHECK_THRESHOLD - 1, decisionLines: null, predictionLines: null, projectNotes: TAG_CHECK_THRESHOLD - 1 })).toBe(false);
		expect(needsTagNotice({ ideaLines: TAG_CHECK_THRESHOLD, decisionLines: null, predictionLines: null, projectNotes: null })).toBe(true);
		expect(needsTagNotice({ ideaLines: null, decisionLines: null, predictionLines: null, projectNotes: TAG_CHECK_THRESHOLD })).toBe(true);
		expect(needsTagNotice({ ideaLines: null, decisionLines: null, predictionLines: null, projectNotes: null })).toBe(false);
		expect(needsTagNotice({ ideaLines: 0, decisionLines: TAG_CHECK_THRESHOLD, predictionLines: 0, projectNotes: 0 })).toBe(true);
		expect(needsTagNotice({ ideaLines: 0, decisionLines: 0, predictionLines: TAG_CHECK_THRESHOLD, projectNotes: 0 })).toBe(true);
	});
});
