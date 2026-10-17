import { describe, expect, it } from "vitest";

import { countPlainIdeaLines, countTagUse, needsTagNotice, TAG_CHECK_THRESHOLD, type CachedNote } from "../src/core/tag-check";

const at = (line: number): { start: { line: number } } => ({ start: { line } });

describe("countPlainIdeaLines", () => {
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
		expect(countPlainIdeaLines(cache, "idea")).toBe(3);
	});

	it("is 0 without tags or cache", () => {
		expect(countPlainIdeaLines(null, "idea")).toBe(0);
		expect(countPlainIdeaLines({}, "idea")).toBe(0);
	});
});

describe("countTagUse", () => {
	const caches: CachedNote[] = [{ frontmatter: { tags: ["project"] } }, { frontmatter: { tags: "other" }, tags: [{ tag: "#idea", position: at(0) }] }, {}];
	const options = { ideasOn: true, ideaTag: "idea", projectsOn: true, projectTag: "project" };

	it("counts both uses", () => {
		expect(countTagUse(caches, options)).toEqual({ ideaLines: 1, projectNotes: 1 });
	});

	it("does not count a feature that is off", () => {
		expect(countTagUse(caches, { ...options, ideasOn: false, projectsOn: false })).toEqual({ ideaLines: null, projectNotes: null });
	});
});

describe("needsTagNotice", () => {
	it("warns from the threshold on, for either count", () => {
		expect(needsTagNotice({ ideaLines: TAG_CHECK_THRESHOLD - 1, projectNotes: TAG_CHECK_THRESHOLD - 1 })).toBe(false);
		expect(needsTagNotice({ ideaLines: TAG_CHECK_THRESHOLD, projectNotes: null })).toBe(true);
		expect(needsTagNotice({ ideaLines: null, projectNotes: TAG_CHECK_THRESHOLD })).toBe(true);
		expect(needsTagNotice({ ideaLines: null, projectNotes: null })).toBe(false);
	});
});
