import { describe, expect, it } from "vitest";

import { buildGraphContext, eligibleNotes, MIN_OWN_WORDS } from "../src/features/context/graph";
import { buildNoteMeta, type NoteMeta } from "../src/features/context/note-meta";
import { makeDoc } from "../src/features/context/text-index";

const OPTIONS = { peopleProperties: [], latitudeProperty: "latitude", longitudeProperty: "longitude" };

/** `graph` maps a name to the names it links to; notes named in `empty` have no prose. */
function eligible(graph: Record<string, string[]>, empty: string[] = [], active = "A"): string[] {
	const notes = new Map<string, NoteMeta>();
	for (const [name, links] of Object.entries(graph)) {
		notes.set(`${name}.md`, buildNoteMeta({ path: `${name}.md`, links: links.map((link) => `${link}.md`), tags: [], frontmatter: undefined }, OPTIONS));
	}
	const context = buildGraphContext(notes.get(`${active}.md`) as NoteMeta, notes);
	const words = (path: string): number => (empty.includes(path.replace(/\.md$/, "")) ? 5 : MIN_OWN_WORDS);
	return [...eligibleNotes(context, words)].map((path) => path.replace(/\.md$/, "")).sort();
}

describe("eligibleNotes", () => {
	it("excludes the active note and direct links in both directions", () => {
		expect(eligible({ A: ["Out"], Out: [], Back: ["A"], Free: [] })).toEqual(["Free"]);
	});

	it("excludes notes co-cited by a third note, large or small", () => {
		const index = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`Item${i}`, []]));
		const graph = { A: [], Small: [], Big: [], Free: [], Pair: ["A", "Small"], Index: ["A", "Big", ...Object.keys(index)], ...index };
		expect(eligible(graph)).toEqual(["Free"]);
	});

	it("excludes 2-hop neighbours in the three directions", () => {
		const graph = { A: ["X", "Y"], X: [], Y: ["Reached"], Reached: [], Sibling: ["X"], Upstream: ["Z"], Z: ["A"], Free: [] };
		expect(eligible(graph)).toEqual(["Free"]);
	});

	it("keeps 2-hop neighbours through a hub", () => {
		const readers = Array.from({ length: 90 }, (_, i) => `Reader${i}`);
		const graph: Record<string, string[]> = { A: ["Hub"], Hub: [], Sibling: ["Hub"], Free: [] };
		for (const name of readers) graph[name] = ["Hub"];
		const found = eligible(graph);
		expect(found).toContain("Sibling");
		expect(found).toContain("Free");
		expect(found).not.toContain("Hub");
	});

	it("excludes notes without content of their own, and everything when the active note has none", () => {
		const graph = { A: [], Index: [], Free: [], Other: [] };
		expect(eligible(graph, ["Index"])).toEqual(["Free", "Other"]);
		expect(eligible(graph, ["A"])).toEqual([]);
	});

	it("does not look at folders", () => {
		const notes = new Map<string, NoteMeta>();
		for (const path of ["Same/A.md", "Same/B.md", "Other/C.md"]) notes.set(path, buildNoteMeta({ path, links: [], tags: [], frontmatter: undefined }, OPTIONS));
		const context = buildGraphContext(notes.get("Same/A.md") as NoteMeta, notes);
		expect([...eligibleNotes(context, () => MIN_OWN_WORDS)].sort()).toEqual(["Other/C.md", "Same/B.md"]);
	});
});

describe("own words", () => {
	it("counts the prose outside links, code and frontmatter", () => {
		const doc = (markdown: string) => makeDoc(markdown, 1).words;
		expect(doc("---\ntags: [a]\n---\n- [[One]]\n- [[Two]]\n")).toBe(0);
		expect(doc("The quick brown fox jumps over the lazy dog, see [[Target]] and [text](http://x.y).")).toBe(12);
		expect(doc("```\ncode words here\n```\nOnly prose")).toBe(2);
		expect(doc("里昂大学")).toBe(2);
	});
});
