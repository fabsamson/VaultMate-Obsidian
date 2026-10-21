// A stranger's vault, as synthetic notes: the traps the first-run check and the classifiers must not fall for.
import { describe, expect, it } from "vitest";

import { countTagUse, type CachedNote } from "../src/core/tag-check";
import { classifyIdeaLine } from "../src/features/ideas/idea-line";
import { classifyLine } from "../src/features/journal/journal-line";


const files = import.meta.glob<string>("./fixtures/stranger/*.md", { query: "?raw", import: "default", eager: true });

/** A minimal stand-in for Obsidian's metadata cache: tags, list items (with the task character) and flat frontmatter. */
function cacheOf(text: string): CachedNote {
	const lines = text.split("\n");
	let frontmatter: Record<string, unknown> | undefined;
	let body = 0;
	if (lines[0] === "---") {
		const end = lines.indexOf("---", 1);
		frontmatter = {};
		let key = "";
		for (const line of lines.slice(1, end)) {
			const pair = /^([a-z]+):\s*(.*)$/.exec(line);
			const item = /^\s+-\s+(.*)$/.exec(line);
			if (pair) {
				key = pair[1] ?? "";
				const value = pair[2] ?? "";
				frontmatter[key] = value.startsWith("[") ? value.slice(1, -1).split(",").map((part) => part.trim()) : value === "" ? [] : value;
			} else if (item && Array.isArray(frontmatter[key])) (frontmatter[key] as string[]).push(item[1] ?? "");
		}
		body = end + 1;
	}
	const tags: NonNullable<CachedNote["tags"]> = [];
	const listItems: NonNullable<CachedNote["listItems"]> = [];
	lines.forEach((line, index) => {
		if (index < body) return;
		const position = { start: { line: index } };
		for (const match of line.matchAll(/(?<![\w/])#[A-Za-z][\w/-]*/g)) tags.push({ tag: match[0], position });
		const list = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[(.)\]\s)?/.exec(line);
		if (list) listItems.push(list[1] === undefined ? { position } : { task: list[1], position });
	});
	return { tags, listItems, ...(frontmatter ? { frontmatter } : {}) };
}

const notes = new Map(Object.entries(files).map(([path, text]) => [path.split("/").pop() ?? path, text.replace(/\r\n/g, "\n")]));
const options ={ ideasOn: true, ideaTag: "idea", journalOn: true, decisionTag: "decision", predictionTag: "prediction", projectsOn: true, projectTag: "project" };
const countsOf = (name: string): ReturnType<typeof countTagUse> => countTagUse([cacheOf(notes.get(name) ?? "")], options);

describe("a stranger's vault", () => {
	it("counts plain tagged lines, not tasks, sub-tags or look-alikes", () => {
		expect(countsOf("prose-tags.md")).toEqual({ ideaLines: 1, decisionLines: 2, predictionLines: 2, projectNotes: 0 });
		expect(countsOf("lists.md")).toEqual({ ideaLines: 2, decisionLines: 1, predictionLines: 0, projectNotes: 0 });
	});

	it("does not take a body tag, a sub-tag or a singular property for a project", () => {
		for (const name of ["project-in-body.md", "project-subtag.md", "singular-tag.md", "album.md"]) {
			expect(countsOf(name)).toEqual({ ideaLines: 0, decisionLines: 0, predictionLines: 0, projectNotes: 0 });
		}
		expect(countsOf("real-project.md").projectNotes).toBe(1);
	});

	it("counts the whole vault", () => {
		const all = countTagUse([...notes.values()].map(cacheOf), options);
		expect(all).toEqual({ ideaLines: 3, decisionLines: 3, predictionLines: 2, projectNotes: 1 });
	});

	it("leaves an album with a Tracks heading alone in the classifiers", () => {
		const tags = { decisionTag: "decision", predictionTag: "prediction" };
		for (const line of (notes.get("album.md") ?? "").split("\n")) {
			expect(classifyLine(line, tags)).toBeNull();
			expect(classifyIdeaLine(line, "idea")).toBeNull();
		}
	});

	it("reads plain tagged lines as plain, tasks as entries", () => {
		const tags = { decisionTag: "decision", predictionTag: "prediction" };
		expect(classifyLine("- Rent will go up next year #prediction", tags)).toMatchObject({ type: "plain", kind: "prediction" });
		expect(classifyLine("- [ ] Switch banks #decision", tags)).toMatchObject({ type: "entry" });
		expect(classifyIdeaLine("We should try a weekly review #idea", "idea")).toMatchObject({ type: "plain" });
		expect(classifyIdeaLine("3) [ ] numbered task #idea", "idea")?.type).toBe("task");
	});
});
