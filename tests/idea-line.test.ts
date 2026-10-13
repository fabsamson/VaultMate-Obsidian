import { describe, expect, it } from "vitest";

import { statementOffset } from "../src/core/task-line";
import {
	ageGroup,
	classifyIdeaLine,
	closeIdea,
	convertToIdea,
	ideaAge,
	ideaDate,
	resultItemText,
	resultLinkTarget,
	titleFromIdea,
} from "../src/features/ideas/idea-line";

const TODAY = "2026-10-13";
const FE0F = "️";

function entryOf(line: string) {
	const cls = classifyIdeaLine(line, "idea");
	if (cls?.type !== "task") throw new Error(`not a task idea: ${line}`);
	return cls.entry;
}

describe("classifyIdeaLine", () => {
	it("reads an open idea task", () => {
		expect(entryOf("- [ ] Prepare a sprint like a mise en place #idea ➕ 2026-10-13")).toEqual({
			status: "open",
			statement: "Prepare a sprint like a mise en place",
			created: "2026-10-13",
			done: null,
			result: null,
		});
	});

	it("reads a processed idea and its result", () => {
		expect(entryOf("- [x] Préparer un sprint #idea [result: added] ➕ 2026-10-13 ✅ 2026-10-15")).toMatchObject({
			status: "done",
			result: "added",
			created: "2026-10-13",
			done: "2026-10-15",
		});
		expect(entryOf("- [x] Drop me #idea [result: Dropped] ✅ 2026-10-15").result).toBe("dropped");
	});

	it("reads cancelled ideas and a done idea without result", () => {
		expect(entryOf("- [-] Gone #idea")).toMatchObject({ status: "cancelled", result: null });
		expect(entryOf("- [x] Done long ago #idea ➕ 2026-01-01")).toMatchObject({ status: "done", result: null });
	});

	it("ignores an unknown result value", () => {
		expect(entryOf("- [x] x #idea [result: maybe]").result).toBeNull();
	});

	it("accepts subtags and any case, in any list style or quote", () => {
		expect(entryOf("- [ ] x #idea/work").statement).toBe("x");
		expect(entryOf("* [ ] x #Idea").statement).toBe("x");
		expect(entryOf("> - [ ] x #IDEA").statement).toBe("x");
		expect(classifyIdeaLine("- [ ] x #ideas", "idea")).toBeNull();
		expect(classifyIdeaLine("- [ ] x #idea", "Idée")).toBeNull();
	});

	it("keeps unknown fields and priority out of the statement", () => {
		expect(entryOf(`- [ ] Try it #idea [effort: low] ⏫${FE0F} ➕ 2026-10-13`).statement).toBe("Try it");
	});

	it("sees a tagged line that is not a task as a plain open idea", () => {
		expect(classifyIdeaLine("- some idea #idea", "idea")).toEqual({ type: "plain", statement: "some idea" });
		expect(classifyIdeaLine("some idea #idea", "idea")).toEqual({ type: "plain", statement: "some idea" });
		expect(classifyIdeaLine("> a quoted idea #idea/work", "idea")).toEqual({ type: "plain", statement: "a quoted idea" });
	});

	it("drops the prose label from the statement of a tagged prose line", () => {
		expect(classifyIdeaLine("Idea: build it #idea", "idea")).toEqual({ type: "plain", statement: "build it" });
	});

	it("recognizes the quick-capture forms", () => {
		for (const line of ["Idée : préparer", "Idee: préparer", "Idea: préparer", "IDEA: préparer", "idée： préparer", "- Idea : préparer", "> Idea: préparer", "  - [ ] Idea: préparer"]) {
			expect(classifyIdeaLine(line, "idea"), line).toEqual({ type: "prose", statement: "préparer" });
		}
		expect(classifyIdeaLine("Idea:", "idea")).toEqual({ type: "prose", statement: "" });
	});

	it("ignores headings, other prose and words that merely start with idea", () => {
		expect(classifyIdeaLine("## Ideas #idea", "idea")).toBeNull();
		expect(classifyIdeaLine("# Idea: later", "idea")).toBeNull();
		expect(classifyIdeaLine("Ideas: later", "idea")).toBeNull();
		expect(classifyIdeaLine("An idea: later", "idea")).toBeNull();
		expect(classifyIdeaLine("", "idea")).toBeNull();
		expect(classifyIdeaLine("- [ ] plain task", "idea")).toBeNull();
	});

	it("ignores a tag inside code or a link", () => {
		expect(classifyIdeaLine("- [ ] x `#idea`", "idea")).toBeNull();
		expect(classifyIdeaLine("- [ ] x [a](https://e.org/#idea)", "idea")).toBeNull();
	});
});

describe("convertToIdea", () => {
	it("converts a prose line", () => {
		expect(convertToIdea("Idée : préparer un sprint", "idea", TODAY)).toBe("- [ ] Préparer un sprint #idea ➕ 2026-10-13");
		expect(convertToIdea("Idea: build it", "idea", TODAY)).toBe("- [ ] Build it #idea ➕ 2026-10-13");
	});

	it("keeps indentation, quote prefix and list marker", () => {
		expect(convertToIdea("    - Idea: x", "idea", TODAY)).toBe("    - [ ] X #idea ➕ 2026-10-13");
		expect(convertToIdea("> Idea: x", "idea", TODAY)).toBe("> - [ ] X #idea ➕ 2026-10-13");
		expect(convertToIdea("> > * Idea: x", "idea", TODAY)).toBe("> > * [ ] X #idea ➕ 2026-10-13");
		expect(convertToIdea("1. Idea: x", "idea", TODAY)).toBe("1. [ ] X #idea ➕ 2026-10-13");
	});

	it("converts a plain tagged line without duplicating the tag", () => {
		expect(convertToIdea("- some idea #idea", "idea", TODAY)).toBe("- [ ] some idea #idea ➕ 2026-10-13");
		expect(convertToIdea("some idea #idea", "idea", TODAY)).toBe("- [ ] some idea #idea ➕ 2026-10-13");
		expect(convertToIdea("Idea: x #idea/work", "idea", TODAY)).toBe("- [ ] X #idea/work ➕ 2026-10-13");
	});

	it("converts any other line by adding the tag", () => {
		expect(convertToIdea("Try a sauna", "idea", TODAY)).toBe("- [ ] Try a sauna #idea ➕ 2026-10-13");
	});

	it("keeps an existing ➕ and does not write 📅", () => {
		const line = "- [ ] x #idea ➕ 2026-09-01";
		expect(convertToIdea(line, "idea", TODAY)).toBe(line);
		expect(convertToIdea("- [ ] x ➕ 2026-09-01", "idea", TODAY)).toBe(line);
		expect(convertToIdea("Idea: x", "idea", TODAY)).not.toContain("📅");
	});

	it("adds the tag before the fields and keeps the rest", () => {
		expect(convertToIdea("- [ ] x [effort: low] ^abc", "idea", TODAY)).toBe("- [ ] x #idea [effort: low] ➕ 2026-10-13 ^abc");
	});

	it("is idempotent", () => {
		const once = convertToIdea("Idea: x", "idea", TODAY);
		expect(convertToIdea(once, "idea", TODAY)).toBe(once);
	});

	it("leaves two spaces before the tag for an empty statement and finds the cursor spot", () => {
		const line = convertToIdea("Idée : ", "idea", TODAY);
		expect(line).toBe("- [ ]  #idea ➕ 2026-10-13");
		expect(statementOffset(line)).toBe(6);
		expect(statementOffset(convertToIdea("> Idea:", "idea", TODAY))).toBe("> - [ ] ".length);
	});

	it("produces a line that parses back", () => {
		for (const line of ["Idea: x", "- plain #idea", "text", "> Idee：y"]) {
			expect(classifyIdeaLine(convertToIdea(line, "idea", TODAY), "idea")?.type, line).toBe("task");
		}
	});
});

describe("closeIdea", () => {
	it("closes an open idea with its result", () => {
		expect(closeIdea("- [ ] x #idea ➕ 2026-10-13", "idea", "added", "2026-10-15")).toBe("- [x] x #idea [result: added] ➕ 2026-10-13 ✅ 2026-10-15");
		expect(closeIdea("- [ ] x #idea ➕ 2026-10-13", "idea", "new-note", "2026-10-15")).toContain("[result: new-note]");
	});

	it("keeps priority, other fields, tags and the block id", () => {
		const line = `    - [ ] Try it #idea/work #later [effort: low] ⏫${FE0F} ➕ 2026-10-13 ^abc`;
		expect(closeIdea(line, "idea", "dropped", "2026-10-15")).toBe(`    - [x] Try it #idea/work #later [effort: low] [result: dropped] ⏫${FE0F} ➕ 2026-10-13 ✅ 2026-10-15 ^abc`);
	});

	it("replaces an earlier result and keeps ✅ single", () => {
		const closed = closeIdea("- [x] x #idea [result: dropped] ➕ 2026-10-13 ✅ 2026-10-14", "idea", "added", "2026-10-15");
		expect(closed).toBe("- [x] x #idea [result: added] ➕ 2026-10-13 ✅ 2026-10-15");
	});

	it("closes a cancelled idea", () => {
		expect(closeIdea("- [-] x #idea ➕ 2026-10-13", "idea", "dropped", "2026-10-15")).toMatch(/^- \[x\] /);
	});

	it("converts a plain tagged line first, with the idea's own date", () => {
		expect(closeIdea("- some idea #idea", "idea", "added", "2026-10-15", "2026-10-01")).toBe("- [x] some idea #idea [result: added] ➕ 2026-10-01 ✅ 2026-10-15");
		expect(closeIdea("some idea #idea", "idea", "dropped", "2026-10-15")).toBe("- [x] some idea #idea [result: dropped] ➕ 2026-10-15 ✅ 2026-10-15");
	});

	it("does not touch an existing ➕ when a date is given", () => {
		expect(closeIdea("- [ ] x #idea ➕ 2026-10-13", "idea", "added", "2026-10-15", "2000-01-01")).toContain("➕ 2026-10-13");
	});

	it("is read back as processed", () => {
		const closed = closeIdea("Idea: x", "idea", "decision", "2026-10-15");
		expect(entryOf(closed)).toMatchObject({ status: "done", result: "decision", done: "2026-10-15", statement: "X" });
	});
});

describe("resultItemText", () => {
	it("writes the two link results", () => {
		expect(resultItemText("new-note", "Sprint kitchen", "")).toBe("New note: [[Sprint kitchen]]");
		expect(resultItemText("added", "Sprint planning", "")).toBe("Added to [[Sprint planning]]");
	});

	it("appends the optional note", () => {
		expect(resultItemText("added", "X", "  why\nnot  ")).toBe("Added to [[X]]: why not");
		expect(resultItemText("new-note", "X", "later")).toBe("New note: [[X]]: later");
	});

	it("writes a drop only with a note", () => {
		expect(resultItemText("dropped", null, "")).toBeNull();
		expect(resultItemText("dropped", null, "   ")).toBeNull();
		expect(resultItemText("dropped", null, "too big")).toBe("Dropped: too big");
	});

	it("writes nothing for decisions, predictions or a missing link", () => {
		expect(resultItemText("decision", "X", "note")).toBeNull();
		expect(resultItemText("prediction", null, "")).toBeNull();
		expect(resultItemText("added", null, "note")).toBeNull();
		expect(resultItemText("new-note", "", "")).toBeNull();
	});
});

describe("resultLinkTarget", () => {
	it("reads the first link of a result sub-item", () => {
		expect(resultLinkTarget(["context", "Added to [[Sprint planning]]"])).toBe("Sprint planning");
		expect(resultLinkTarget(["New note: [[Sprint kitchen]]: later [[Other]]"])).toBe("Sprint kitchen");
	});

	it("drops alias, heading and block", () => {
		expect(resultLinkTarget(["Added to [[Sprint planning|the sprint]]"])).toBe("Sprint planning");
		expect(resultLinkTarget(["Added to [[Sprint planning#Ideas]]"])).toBe("Sprint planning");
		expect(resultLinkTarget(["Added to [[Sprint planning^abc]]"])).toBe("Sprint planning");
	});

	it("ignores other sub-items and results without a link", () => {
		expect(resultLinkTarget(["See [[Other]]", "Dropped: [[Other]]"])).toBeNull();
		expect(resultLinkTarget(["Added to nothing"])).toBeNull();
		expect(resultLinkTarget([])).toBeNull();
		expect(resultLinkTarget(["See [[Other]]", "added to [[Real]]"])).toBe("Real");
	});
});

describe("ideaDate", () => {
	it("prefers ➕, then a date in the note name, then the fallback", () => {
		expect(ideaDate({ created: "2026-10-01" }, "2026-09-01", "2026-08-01")).toBe("2026-10-01");
		expect(ideaDate({ created: null }, "2026-09-01", "2026-08-01")).toBe("2026-09-01");
		expect(ideaDate(null, "Meeting 2026-09-02 notes", "2026-08-01")).toBe("2026-09-02");
		expect(ideaDate(null, "Ideas", "2026-08-01")).toBe("2026-08-01");
	});

	it("skips dates that do not exist", () => {
		expect(ideaDate({ created: "2026-13-45" }, "Ideas", "2026-08-01")).toBe("2026-08-01");
		expect(ideaDate(null, "2026-02-31 then 2026-03-01", "2026-08-01")).toBe("2026-03-01");
	});
});

describe("ageGroup", () => {
	const today = new Date(2026, 9, 13);

	it("is fresh up to 2 days, waiting up to 14, then wilting", () => {
		expect(ageGroup("2026-10-13", today)).toBe("fresh");
		expect(ageGroup("2026-10-11", today)).toBe("fresh");
		expect(ageGroup("2026-10-10", today)).toBe("waiting");
		expect(ageGroup("2026-09-29", today)).toBe("waiting");
		expect(ageGroup("2026-09-28", today)).toBe("wilting");
		expect(ageGroup("2025-01-01", today)).toBe("wilting");
	});

	it("counts a future or unreadable date as fresh", () => {
		expect(ageGroup("2026-10-20", today)).toBe("fresh");
		expect(ageGroup("nope", today)).toBe("fresh");
	});

	it("gives the age in days", () => {
		expect(ideaAge("2026-10-10", today)).toBe(3);
		expect(ideaAge("2026-10-14", today)).toBe(-1);
		expect(ideaAge("nope", today)).toBeNull();
	});
});

describe("titleFromIdea", () => {
	it("keeps a short statement", () => {
		expect(titleFromIdea("Préparer un sprint")).toBe("Préparer un sprint");
	});

	it("removes the characters file names and links forbid", () => {
		expect(titleFromIdea('A/B test: "fast" or [slow]? #1 ^x <y> | z * \\')).toBe("AB test fast or slow 1 x y z");
	});

	it("cuts at a word boundary within 60 characters", () => {
		const title = titleFromIdea("Préparer un sprint comme une mise en place en cuisine avec tout le monde ensemble");
		expect(title).toBe("Préparer un sprint comme une mise en place en cuisine avec");
		expect(title.length).toBeLessThanOrEqual(60);
	});

	it("keeps a statement of exactly 60 characters and one whose 61st character is a space", () => {
		const sixty = "a".repeat(10) + (" " + "b".repeat(9)).repeat(5);
		expect(sixty).toHaveLength(60);
		expect(titleFromIdea(sixty)).toBe(sixty);
		expect(titleFromIdea(`${sixty} next`)).toBe(sixty);
	});

	it("cuts a very long word", () => {
		expect(titleFromIdea("x".repeat(100))).toBe("x".repeat(60));
	});

	it("does not split an emoji or kanji surrogate pair", () => {
		const title = titleFromIdea("😀".repeat(80));
		expect(Array.from(title)).toHaveLength(60);
	});

	it("is never empty for a non-empty statement", () => {
		expect(titleFromIdea("???")).toBe("Idea");
		expect(titleFromIdea("")).toBe("");
		expect(titleFromIdea("   ")).toBe("");
	});
});
