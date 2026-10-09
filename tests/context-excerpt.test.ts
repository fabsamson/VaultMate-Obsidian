import { describe, expect, it } from "vitest";

import { excerpt, excerptParts } from "../src/features/context/excerpt";

const marked = (found: ReturnType<typeof excerpt>): string[] => found.marks.map(([start, end]) => found.text.slice(start, end));

describe("excerpt", () => {
	it("cleans frontmatter, code, headings, embeds and markup, keeps link names, and marks the terms", () => {
		const note = ["---", "tags: [a]", "---", "# Title", "", "- [ ] Prepare the **checklist** before the [[Plan|sprint]] starts.", "```", "checklist in code", "```", "## Next", "See [docs](https://x.example), [[Areas/Kitchen notes#Knives]] and ![[photo.png]]."].join("\n");
		const found = excerpt(note, ["checklist", "sprint"]);
		expect(found.text).toBe("Prepare the checklist before the sprint starts. See docs, Kitchen notes and.");
		expect(marked(found)).toEqual(["checklist", "sprint"]);
	});

	it("matches the folded forms of accented words and keeps the original spelling", () => {
		const found = excerpt("Une pâte à tarte a besoin de repos. Le Repos est la clé.", ["repos"]);
		expect(marked(found)).toEqual(["repos", "Repos"]);
	});

	it("picks the passage with the most distinct hits and cuts at word boundaries", () => {
		const filler = "lorem ipsum dolor sit amet ".repeat(20);
		const note = `checklist ${filler} the ordinary part ${filler} here checklist and interruptions and a dry run together ${filler}`;
		const found = excerpt(note, ["checklist", "interruptions", "dry"], [], 120);
		expect(marked(found)).toEqual(expect.arrayContaining(["checklist", "interruptions", "dry"]));
		expect(found.text.startsWith("… ")).toBe(true);
		expect(found.text.endsWith(" …")).toBe(true);
		expect(found.text.length).toBeLessThanOrEqual(130);
	});

	it("marks a phrase such as the other note's title, for a mention", () => {
		const found = excerpt("Today I thought about the Lyon move again.", [], ["Lyon move"]);
		expect(marked(found)).toEqual(["Lyon move"]);
	});

	it("marks Chinese and Japanese terms by position", () => {
		const found = excerpt("今日は東京大学の図書館へ行った。", ["東京", "京大"]);
		expect(marked(found)).toEqual(["東京大"]);
	});

	it("falls back to the first lines when nothing matches, and handles an empty note", () => {
		const note = "Opening line of the note. ".repeat(20);
		const found = excerpt(note, ["absent"], [], 100);
		expect(found.marks).toEqual([]);
		expect(found.text.startsWith("Opening line")).toBe(true);
		expect(found.text.length).toBeLessThanOrEqual(110);
		expect(excerpt("", ["a"])).toEqual({ text: "", marks: [] });
	});

	it("cuts the excerpt into plain and emphasised parts", () => {
		const found = excerpt("alpha beta gamma beta", ["beta"]);
		expect(excerptParts(found)).toEqual([
			{ text: "alpha ", hit: false },
			{ text: "beta", hit: true },
			{ text: " gamma ", hit: false },
			{ text: "beta", hit: true },
		]);
		expect(excerptParts({ text: "none", marks: [] })).toEqual([{ text: "none", hit: false }]);
	});
});
