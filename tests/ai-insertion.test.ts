import { describe, expect, it } from "vitest";

import { isConfirmed, withConfirmation } from "../src/features/ai-actions/confirmation";
import { applyPlan, planCursorInsert, planHeadingInsert, renderLine } from "../src/features/ai-actions/insertion";

const lines = (text: string): string[] => text.split("\n");
const insertUnder = (text: string, heading: string, rendered: string[]): string | null => {
	const plan = planHeadingInsert(lines(text), heading, rendered);
	return plan ? applyPlan(lines(text), plan).join("\n") : null;
};

describe("renderLine", () => {
	it("fills the template", () => {
		expect(renderLine("- {{text}}", "Why?")).toBe("- Why?");
		expect(renderLine("- [ ] {{text}} #question", "Why?")).toBe("- [ ] Why? #question");
		expect(renderLine("{{text}} / {{text}}", "Why?")).toBe("Why? / Why?");
	});
});

describe("planHeadingInsert", () => {
	it("appends at the end of an existing section, before the next heading, keeping the blank line", () => {
		const note = "# Note\n\n## Questions\n- Old?\n\n## Other\ntext";
		expect(insertUnder(note, "Questions", ["- New?"])).toBe("# Note\n\n## Questions\n- Old?\n- New?\n\n## Other\ntext");
	});

	it("matches the heading at any level, case-insensitively, ignoring closing hashes", () => {
		expect(insertUnder("### questions ###\n- Old?\n#### Deeper\nx\n### Next\ny", "Questions", ["- New?"])).toBe("### questions ###\n- Old?\n#### Deeper\nx\n- New?\n### Next\ny");
		expect(insertUnder("# Questions\nbody", "questions", ["- New?"])).toBe("# Questions\nbody\n- New?");
	});

	it("inserts right after an empty section's heading", () => {
		expect(insertUnder("## Questions\n\n## Next", "Questions", ["- New?"])).toBe("## Questions\n- New?\n\n## Next");
	});

	it("stops the section at a heading of the same or higher level only", () => {
		expect(insertUnder("## Q\n### Sub\nx\n## Z", "Q", ["- N?"])).toBe("## Q\n### Sub\nx\n- N?\n## Z");
		expect(insertUnder("### Q\nx\n## Z", "Q", ["- N?"])).toBe("### Q\nx\n- N?\n## Z");
	});

	it("never duplicates a line already in the section, and returns null when nothing is new", () => {
		const note = "## Questions\n- Old?\n- Mid?";
		expect(insertUnder(note, "Questions", ["- Old?", "- New?", "- New?"])).toBe("## Questions\n- Old?\n- Mid?\n- New?");
		expect(insertUnder(note, "Questions", ["  - Old?", "- Mid?"])).toBeNull();
	});

	it("creates the heading at the end of the note with a blank line before it", () => {
		expect(insertUnder("# Note\ntext", "Questions", ["- A?", "- B?"])).toBe("# Note\ntext\n\n## Questions\n- A?\n- B?");
	});

	it("creates the heading before trailing blank lines, and in an empty note", () => {
		expect(insertUnder("text\n\n\n", "Questions", ["- A?"])).toBe("text\n\n## Questions\n- A?\n\n\n");
		expect(insertUnder("", "Questions", ["- A?"])).toBe("## Questions\n- A?\n");
	});

	it("ignores headings in code blocks and in the frontmatter", () => {
		const note = "---\n# Questions\n---\nbody\n```\n## Questions\n```";
		expect(insertUnder(note, "Questions", ["- A?"])).toBe(`${note}\n\n## Questions\n- A?`);
	});

	it("uses the first matching heading", () => {
		expect(insertUnder("## Q\na\n## Q\nb", "Q", ["- N?"])).toBe("## Q\na\n- N?\n## Q\nb");
	});

	it("does not look in other sections for duplicates", () => {
		expect(insertUnder("## Q\n## Other\n- A?", "Q", ["- A?"])).toBe("## Q\n- A?\n## Other\n- A?");
	});
});

describe("planCursorInsert", () => {
	it("inserts after the cursor line", () => {
		const note = lines("one\ntwo\nthree");
		const plan = planCursorInsert(note, 1, ["- A?"]);
		expect(plan && applyPlan(note, plan).join("\n")).toBe("one\ntwo\n- A?\nthree");
	});

	it("replaces an empty cursor line", () => {
		const note = lines("one\n\nthree");
		const plan = planCursorInsert(note, 1, ["- A?", "- B?"]);
		expect(plan && applyPlan(note, plan).join("\n")).toBe("one\n- A?\n- B?\nthree");
	});

	it("skips lines already in the note and returns null when none is new", () => {
		const note = lines("one\n- A?");
		expect(planCursorInsert(note, 0, ["- A?", "- B?"])?.lines).toEqual(["- B?"]);
		expect(planCursorInsert(note, 0, ["- A?"])).toBeNull();
	});

	it("works on an empty note and clamps the cursor", () => {
		const plan = planCursorInsert([""], 5, ["- A?"]);
		expect(plan && applyPlan([""], plan)).toEqual(["- A?"]);
	});
});

describe("confirmations", () => {
	const path = "VaultMate/AI actions/Challenge.md";

	it("asks until confirmed, then remembers", () => {
		expect(isConfirmed({}, path, ["note"])).toBe(false);
		const confirmed = withConfirmation({}, path, ["note"]);
		expect(confirmed).toEqual({ [path]: ["note"] });
		expect(isConfirmed(confirmed, path, ["note"])).toBe(true);
	});

	it("asks again when a source is added or replaced", () => {
		const confirmed = withConfirmation({}, path, ["note"]);
		expect(isConfirmed(confirmed, path, ["note", "properties"])).toBe(false);
		expect(isConfirmed(confirmed, path, ["selection"])).toBe(false);
		expect(isConfirmed(confirmed, "other.md", ["note"])).toBe(false);
	});

	it("ignores the order of the sources, stores them sorted and keeps other actions", () => {
		const confirmed = withConfirmation({ "a.md": ["note"] }, path, ["selection", "note", "note"]);
		expect(confirmed).toEqual({ "a.md": ["note"], [path]: ["note", "selection"] });
		expect(isConfirmed(confirmed, path, ["note", "selection"])).toBe(true);
	});

	it("is not confirmed again after the sources shrink, and re-confirming replaces the old list", () => {
		const confirmed = withConfirmation({}, path, ["note", "properties"]);
		expect(isConfirmed(confirmed, path, ["note"])).toBe(false);
		expect(withConfirmation(confirmed, path, ["note"])[path]).toEqual(["note"]);
	});
});
