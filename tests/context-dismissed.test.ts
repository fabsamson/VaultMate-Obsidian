import { describe, expect, it } from "vitest";

import { addPair, cleanPairs, hasPair, makePair, removePair, renamePath, type NotePair } from "../src/features/context/dismissed";

describe("not useful pairs", () => {
	it("is the same pair in both directions and is added once", () => {
		expect(makePair("b.md", "a.md")).toEqual(["a.md", "b.md"]);
		const pairs = addPair(addPair([], "b.md", "a.md"), "a.md", "b.md");
		expect(pairs).toEqual([["a.md", "b.md"]]);
		expect(hasPair(pairs, "b.md", "a.md")).toBe(true);
		expect(hasPair(pairs, "a.md", "c.md")).toBe(false);
	});

	it("removes a pair (undo) without touching the others", () => {
		const pairs: NotePair[] = [["a.md", "b.md"], ["a.md", "c.md"]];
		expect(removePair(pairs, "b.md", "a.md")).toEqual([["a.md", "c.md"]]);
		expect(pairs).toHaveLength(2);
	});

	it("follows a renamed note and keeps pairs sorted", () => {
		expect(renamePath([["a.md", "b.md"], ["c.md", "d.md"]], "a.md", "z.md")).toEqual([["b.md", "z.md"], ["c.md", "d.md"]]);
		expect(renamePath([["a.md", "b.md"]], "a.md", "b.md")).toEqual([]);
	});

	it("cleans what data.json holds", () => {
		expect(cleanPairs([["b", "a"], ["a", "b"], ["a", "a"], 3, ["a"]])).toEqual([["a", "b"]]);
		expect(cleanPairs(undefined)).toEqual([]);
	});
});
