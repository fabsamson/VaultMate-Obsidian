import { describe, expect, it } from "vitest";

import { hasProjectTag, propertyTags } from "../src/features/projects/project-tag";

// The cases shared with the Android app (tag `projet`).
describe("hasProjectTag", () => {
	const yes: Array<[string, Record<string, unknown>]> = [
		["list", { tags: ["projet"] }],
		["list, other case", { tags: ["Projet"] }],
		["text", { tags: "projet" }],
		["text with #", { tags: "#projet" }],
		["comma list", { tags: "a, projet" }],
		["block list", { tags: ["a", "projet", 3] }],
	];
	for (const [name, frontmatter] of yes) {
		it(`accepts ${name}`, () => expect(hasProjectTag(frontmatter, "projet")).toBe(true));
	}

	const no: Array<[string, Record<string, unknown> | undefined | null]> = [
		["a subtag", { tags: ["projet/finance"] }],
		["a longer tag", { tags: ["projets"] }],
		["frontmatter without the tag (body-only #projet)", { title: "x", tags: ["other"] }],
		["the singular key", { tag: "projet" }],
		["no frontmatter", undefined],
		["null frontmatter", null],
		["a non-text value", { tags: 3 }],
	];
	for (const [name, frontmatter] of no) {
		it(`rejects ${name}`, () => expect(hasProjectTag(frontmatter, "projet")).toBe(false));
	}

	it("compares with a configured tag, ignoring case", () => {
		expect(hasProjectTag({ tags: ["Project"] }, "project")).toBe(true);
		expect(hasProjectTag({ tags: ["project"] }, "Project")).toBe(true);
	});
});

describe("propertyTags", () => {
	it("splits text on commas and blanks and drops # and empty values", () => {
		expect(propertyTags({ tags: "#a,  b\tc ,," })).toEqual(["a", "b", "c"]);
		expect(propertyTags({ tags: ["#x", " ", "y "] })).toEqual(["x", "y"]);
	});
});
