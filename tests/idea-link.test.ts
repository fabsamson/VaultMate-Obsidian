import { describe, expect, it } from "vitest";

import { noteCandidates, parseIdeaLink, resolveIdeaLine } from "../src/features/ideas/idea-link";

describe("parseIdeaLink", () => {
	it("reads a file and a 0-based line", () => {
		expect(parseIdeaLink({ file: "Journal/2026-10-13", line: "4" })).toEqual({ file: "Journal/2026-10-13", line: 4 });
		expect(parseIdeaLink({ file: "A.md", line: "0" })).toEqual({ file: "A.md", line: 0 });
	});
	it("normalises the path", () => {
		expect(parseIdeaLink({ file: "/A//B\\C/./D.md/", line: "1" })?.file).toBe("A/B/C/D.md");
		expect(parseIdeaLink({ file: " A / B ", line: "1" })?.file).toBe("A/B");
	});
	it("refuses a missing, empty or escaping file", () => {
		expect(parseIdeaLink({ line: "1" })).toBeNull();
		expect(parseIdeaLink({ file: "", line: "1" })).toBeNull();
		expect(parseIdeaLink({ file: " / ", line: "1" })).toBeNull();
		expect(parseIdeaLink({ file: ".md", line: "1" })).toBeNull();
		expect(parseIdeaLink({ file: "../Secret", line: "1" })).toBeNull();
		expect(parseIdeaLink({ file: "A/../B", line: "1" })).toBeNull();
		expect(parseIdeaLink({ file: "A\u0000B", line: "1" })).toBeNull();
	});
	it("refuses a line that is not a non-negative integer", () => {
		for (const line of [undefined, "", "-1", "1.5", "1e2", "abc", " 3", "+3", "12345678901"]) {
			expect(parseIdeaLink({ file: "A", line })).toBeNull();
		}
	});
});

describe("noteCandidates", () => {
	it("appends .md only when missing", () => {
		expect(noteCandidates("A/B")).toEqual(["A/B", "A/B.md"]);
		expect(noteCandidates("A/B.md")).toEqual(["A/B.md"]);
		expect(noteCandidates("A/B.MD")).toEqual(["A/B.MD"]);
	});
});

describe("resolveIdeaLine", () => {
	const lines = [
		"# Notes", //0
		"- [ ] Open one #idea ➕ 2026-10-13", //1
		"text", //2
		"- [x] Done one #idea [result: dropped] ➕ 2026-10-01 ✅ 2026-10-02", //3
		"Tagged plain line #idea", //4
		"x", //5
		"y", //6
		"z", //7
		"w", //8
		"- [ ] Far open #idea", //9
	];
	it("uses the given line when it is an open idea", () => {
		expect(resolveIdeaLine(lines, 1, "idea")).toEqual({ kind: "open", line: 1 });
		expect(resolveIdeaLine(lines, 4, "idea")).toEqual({ kind: "open", line: 4 });
	});
	it("reports a processed idea", () => {
		expect(resolveIdeaLine(lines, 3, "idea")).toEqual({ kind: "processed" });
	});
	it("finds the nearest open idea within three lines, earlier line first on a tie", () => {
		expect(resolveIdeaLine(lines, 2, "idea")).toEqual({ kind: "open", line: 1 });
		expect(resolveIdeaLine(lines, 6, "idea")).toEqual({ kind: "open", line: 4 });
		expect(resolveIdeaLine(lines, 7, "idea")).toEqual({ kind: "open", line: 9 });
		expect(resolveIdeaLine(lines, 0, "idea")).toEqual({ kind: "open", line: 1 });
	});
	it("gives up beyond three lines or outside the note", () => {
		expect(resolveIdeaLine(lines, 8, "idea")).toEqual({ kind: "open", line: 9 });
		expect(resolveIdeaLine(["a", "b", "c", "d", "e", "f", "- [ ] x #idea"], 0, "idea")).toEqual({ kind: "none" });
		expect(resolveIdeaLine(lines, 100, "idea")).toEqual({ kind: "none" });
		expect(resolveIdeaLine([], 0, "idea")).toEqual({ kind: "none" });
	});
});
