import { describe, expect, it } from "vitest";

import type { JournalTags } from "../src/features/journal/journal-line";
import { getChildren, linePrefix, newEntryLines, planRewrite, replaceEmptyLineText, reviewItemText, rewriteText, usesTabs } from "../src/features/journal/journal-note";

const TAGS: JournalTags = { decisionTag: "decision", predictionTag: "prediction" };

describe("reviewItemText", () => {
	it("joins what happened and the lesson", () => {
		expect(reviewItemText("2027-01-08", "rent lower than expected", "visit twice before signing")).toBe(
			"Review 2027-01-08: rent lower than expected. Lesson: visit twice before signing",
		);
	});

	it("does not double the punctuation", () => {
		expect(reviewItemText("2027-01-08", "It went well!", "plan earlier")).toBe("Review 2027-01-08: It went well! Lesson: plan earlier");
		expect(reviewItemText("2027-01-08", "とても良かった。", "早く")).toBe("Review 2027-01-08: とても良かった。 Lesson: 早く");
	});

	it("handles a single part and collapses line breaks", () => {
		expect(reviewItemText("2026-10-09", "line one\nline two", "")).toBe("Review 2026-10-09: line one line two");
		expect(reviewItemText("2026-10-09", "  ", "keep notes")).toBe("Review 2026-10-09: Lesson: keep notes");
	});

	it("is null when both parts are empty", () => {
		expect(reviewItemText("2026-10-09", "", " ")).toBeNull();
	});
});

describe("getChildren", () => {
	it("finds the sub-items and stops at a blank line", () => {
		const lines = ["- [ ] a #decision", "    - Why: x", "    - Expected: y", "", "    - not mine", "- [ ] b"];
		expect(getChildren(lines, 0)).toEqual({ end: 2, indent: "    ", items: ["Why: x", "Expected: y"] });
	});

	it("stops at a line that is not deeper", () => {
		const lines = ["- [ ] a #decision", "    - Why: x", "- [ ] b", "    - Why: other"];
		expect(getChildren(lines, 0).end).toBe(1);
		expect(getChildren(lines, 2).end).toBe(3);
	});

	it("reports no children", () => {
		expect(getChildren(["- [ ] a #decision", "Next paragraph"], 0)).toEqual({ end: 0, indent: null, items: [] });
		expect(getChildren(["- [ ] a #decision"], 0).end).toBe(0);
	});

	it("includes deeper levels and tab indentation", () => {
		const lines = ["- [ ] a #decision", "\t- Why: x", "\t\t- detail", "\t- Signals: s", "- next"];
		expect(getChildren(lines, 0)).toEqual({ end: 3, indent: "\t", items: ["Why: x", "detail", "Signals: s"] });
	});

	it("follows the quote prefix inside a callout", () => {
		const lines = ["> [!note] Planning", "> - [ ] Hire #decision", ">     - Why: page", ">     - Options: a", "> - [ ] next", "text"];
		expect(getChildren(lines, 1)).toEqual({ end: 3, indent: "    ", items: ["Why: page", "Options: a"] });
	});

	it("stops where the quote ends", () => {
		const lines = ["> - [ ] Hire #decision", "    - outside the callout"];
		expect(getChildren(lines, 0).end).toBe(0);
	});

	it("handles a tab-indented decision under a parent", () => {
		const lines = ["- [ ] Parent item", "\t- [ ] Tab decision #decision", "\t\t- Why: x", "\t- sibling"];
		expect(getChildren(lines, 1).end).toBe(2);
	});
});

describe("usesTabs", () => {
	it("detects tab indentation, also in callouts", () => {
		expect(usesTabs(["- a", "\t- b"])).toBe(true);
		expect(usesTabs(["> - a", "> \t- b"])).toBe(true);
		expect(usesTabs(["- a", "    - b"])).toBe(false);
		expect(usesTabs(["text with a\ttab inside"])).toBe(false);
	});
});

const OPEN = "- [ ] Move to Lyon #decision [confidence:: 70%] ➕ 2026-10-08 📅 2027-01-08";
const CLOSED = "- [x] Move to Lyon #decision [confidence:: 70%] [outcome:: better] [quality:: good] ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-08";
const SUB = "Review 2027-01-08: rent lower than expected. Lesson: visit twice before signing.";

describe("planRewrite", () => {
	it("adds the sub-item after the last child, copying their indentation", () => {
		const lines = ["# Title", OPEN, "  - Why: cheaper", "  - Expected: less rent", "", "Next"];
		expect(planRewrite(lines, 1, OPEN, CLOSED, SUB)).toEqual({
			ok: true,
			from: 1,
			to: 3,
			replacement: [CLOSED, "  - Why: cheaper", "  - Expected: less rent", `  - ${SUB}`],
		});
	});

	it("uses four spaces, or a tab when the note uses tabs, when there is no child", () => {
		expect(planRewrite([OPEN, "next"], 0, OPEN, CLOSED, SUB)).toMatchObject({ to: 0, replacement: [CLOSED, `    - ${SUB}`] });
		expect(planRewrite(["- parent", "\t- other", OPEN], 2, OPEN, CLOSED, SUB)).toMatchObject({ replacement: [CLOSED, `\t- ${SUB}`] });
	});

	it("adds the item's own indentation and quote prefix", () => {
		const line = "> - [ ] Hire #decision 📅 2026-11-05";
		expect(planRewrite(["> [!note]", line], 1, line, "NEW", SUB)).toMatchObject({ replacement: ["NEW", `> ${"    "}- ${SUB}`] });
		const nested = "    - [ ] Nested #decision";
		expect(planRewrite([nested], 0, nested, "NEW", SUB)).toMatchObject({ replacement: ["NEW", `        - ${SUB}`] });
	});

	it("skips the sub-item when there is none", () => {
		expect(planRewrite([OPEN, "    - Why: x"], 0, OPEN, "NEW", null)).toEqual({ ok: true, from: 0, to: 0, replacement: ["NEW"] });
	});

	it("refuses when the line changed since it was read", () => {
		expect(planRewrite([`${OPEN} edited`], 0, OPEN, CLOSED, SUB)).toEqual({ ok: false });
		expect(planRewrite(["inserted", OPEN], 0, OPEN, CLOSED, SUB)).toEqual({ ok: false });
		expect(planRewrite([], 3, OPEN, CLOSED, SUB)).toEqual({ ok: false });
	});
});

describe("rewriteText", () => {
	it("rewrites an LF note", () => {
		const text = `# Title\n${OPEN}\n    - Why: cheaper\n\nEnd\n`;
		expect(rewriteText(text, 1, OPEN, CLOSED, SUB)).toEqual({ ok: true, text: `# Title\n${CLOSED}\n    - Why: cheaper\n    - ${SUB}\n\nEnd\n` });
	});

	it("keeps CRLF line breaks and finds children in a CRLF note", () => {
		const text = `# Title\r\n${OPEN}\r\n    - Why: cheaper\r\n\r\nEnd`;
		expect(rewriteText(text, 1, OPEN, CLOSED, SUB)).toEqual({ ok: true, text: `# Title\r\n${CLOSED}\r\n    - Why: cheaper\r\n    - ${SUB}\r\n\r\nEnd` });
	});

	it("refuses a changed line and a CRLF note alike", () => {
		expect(rewriteText(`${OPEN}!\n`, 0, OPEN, CLOSED, SUB)).toEqual({ ok: false });
		expect(rewriteText(`${OPEN}!\r\n`, 0, OPEN, CLOSED, SUB)).toEqual({ ok: false });
	});

	it("writes a line without a sub-item", () => {
		expect(rewriteText(`${OPEN}\n`, 0, OPEN, "NEW", null)).toEqual({ ok: true, text: "NEW\n" });
	});
});

describe("newEntryLines", () => {
	const base = { kind: "decision", tags: TAGS, today: "2026-10-09", due: "2027-01-09", confidence: 70, statement: "Buy a desk", currentLine: "", tabs: false } as const;

	it("builds the line and the non-empty sub-items", () => {
		expect(newEntryLines({ ...base, extras: [["Why", "back pain"], ["Options", ""], ["Expected", "less pain"], ["Signals", "  "]] })).toEqual([
			"- [ ] Buy a desk #decision [confidence:: 70%] ➕ 2026-10-09 📅 2027-01-09",
			"    - Why: back pain",
			"    - Expected: less pain",
		]);
	});

	it("builds a prediction without sub-items and with the tab indentation", () => {
		expect(newEntryLines({ ...base, kind: "prediction", statement: "It rains", extras: [], tabs: true })).toEqual([
			"- [ ] It rains #prediction [confidence:: 70%] ➕ 2026-10-09 📅 2027-01-09",
		]);
		expect(newEntryLines({ ...base, extras: [["Why", "x"]], tabs: true })[1]).toBe("\t- Why: x");
	});

	it("keeps the callout prefix and indentation of the current line", () => {
		expect(newEntryLines({ ...base, confidence: null, extras: [["Why", "x"]], currentLine: ">" })).toEqual([
			"> - [ ] Buy a desk #decision ➕ 2026-10-09 📅 2027-01-09",
			">     - Why: x",
		]);
		expect(newEntryLines({ ...base, confidence: null, extras: [], currentLine: "  > - [ ] earlier" })[0]).toBe("  > - [ ] Buy a desk #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(linePrefix("\t- item")).toBe("\t");
		expect(linePrefix("plain")).toBe("");
	});
});

describe("replaceEmptyLineText", () => {
	const lines = ["- [ ] A #decision", "    - Why: x"];

	it("keeps a blank line before a following block", () => {
		expect(replaceEmptyLineText("", "> [!note] Callout", lines)).toBe("- [ ] A #decision\n    - Why: x\n");
		expect(replaceEmptyLineText(">", "> text", lines)).toBe("- [ ] A #decision\n    - Why: x\n>");
	});

	it("adds nothing at the end of the note or before another blank line", () => {
		expect(replaceEmptyLineText("", null, lines)).toBe("- [ ] A #decision\n    - Why: x");
		expect(replaceEmptyLineText("", "", lines)).toBe("- [ ] A #decision\n    - Why: x");
	});
});
