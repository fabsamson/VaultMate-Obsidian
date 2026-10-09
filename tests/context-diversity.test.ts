import { describe, expect, it } from "vitest";

import { DUPLICATE_SIMILARITY, LAMBDA, pickDiverse } from "../src/features/context/diversity";
import { areTied, buildGraphContext } from "../src/features/context/graph";
import { buildNoteMeta, type NoteMeta } from "../src/features/context/note-meta";

const candidate = (path: string, score: number) => ({ path, score });
/** 1 for the pair a and twin, 0 for the others. */
const twins = (x: string, y: string): number => ([x, y].includes("a") && [x, y].includes("twin") ? 1 : 0);
const OPTIONS = { peopleProperties: [], latitudeProperty: "latitude", longitudeProperty: "longitude" };

describe("pickDiverse", () => {
	it("starts with the best score and honours the limit", () => {
		const picked = pickDiverse([candidate("b", 2), candidate("a", 3), candidate("c", 1)], () => 0, 2);
		expect(picked.map((item) => item.path)).toEqual(["a", "b"]);
		expect(pickDiverse([], () => 0, 3)).toEqual([]);
		expect(pickDiverse([candidate("a", 1)], () => 0, 3)).toHaveLength(1);
	});

	it("passes over a near-identical note for a distinct one that scores a little less", () => {
		const picked = pickDiverse([candidate("a", 1), candidate("twin", 0.95), candidate("other", 0.6)], twins, 2);
		expect(picked.map((item) => item.path)).toEqual(["a", "other"]);
		expect(LAMBDA).toBeGreaterThan(0.5);
	});

	it("penalises a similar note without dropping it when the similarity is moderate", () => {
		const similar = (x: string, y: string): number => ([x, y].includes("a") && [x, y].includes("close") ? 0.5 : 0);
		const picked = pickDiverse([candidate("a", 1), candidate("close", 0.95), candidate("weak", 0.2)], similar, 2);
		expect(picked.map((item) => item.path)).toEqual(["a", "close"]);
	});

	it("never offers a note nearly identical to one already picked", () => {
		const picked = pickDiverse([candidate("a", 1), candidate("twin", 0.95), candidate("weak", 0.2)], twins, 3);
		expect(picked.map((item) => item.path)).toEqual(["a", "weak"]);
		expect(DUPLICATE_SIMILARITY).toBeLessThan(1);
	});
});

describe("areTied", () => {
	it("is true for notes linked either way or cited together, false otherwise", () => {
		const meta = (name: string, links: string[]): [string, NoteMeta] => [`${name}.md`, buildNoteMeta({ path: `${name}.md`, links: links.map((link) => `${link}.md`), tags: [], frontmatter: undefined }, OPTIONS)];
		const notes = new Map([meta("A", ["B"]), meta("B", []), meta("C", []), meta("D", []), meta("Index", ["C", "D"]), meta("E", [])]);
		const context = buildGraphContext(notes.get("A.md") as NoteMeta, notes);
		expect(areTied(context, "A.md", "B.md")).toBe(true);
		expect(areTied(context, "B.md", "A.md")).toBe(true);
		expect(areTied(context, "C.md", "D.md")).toBe(true);
		expect(areTied(context, "C.md", "E.md")).toBe(false);
	});
});
