import { describe, expect, it } from "vitest";

import { addOutcome, classifyLine, closedWithoutReview, markNotReviewable, type JournalEntry, type JournalTags } from "../src/features/journal/journal-line";
import { resolveReviewLine } from "../src/features/journal/review-link";

const TAGS: JournalTags = { decisionTag: "decision", predictionTag: "prediction" };
const OPEN = "- [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08";
const LATE = "- [x] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-09";
const REVIEWED = "- [x] Move to Lyon #decision [outcome: better] [quality: good] ➕ 2026-10-08 ✅ 2027-01-08";
const CANCELLED = "- [-] Move to Lyon #decision ➕ 2026-10-08";

function entry(line: string): JournalEntry {
	const cls = classifyLine(line, TAGS);
	if (cls?.type !== "entry") throw new Error("not an entry");
	return cls.entry;
}

describe("closedWithoutReview", () => {
	it("is a done decision lacking outcome or quality, or a done prediction lacking result", () => {
		expect(closedWithoutReview(entry(LATE))).toBe(true);
		expect(closedWithoutReview(entry("- [x] A #decision [outcome: better] ✅ 2027-01-08"))).toBe(true);
		expect(closedWithoutReview(entry("- [x] A #decision [quality: good] ✅ 2027-01-08"))).toBe(true);
		expect(closedWithoutReview(entry("- [x] A #decision [outcome: nope] [quality: good]"))).toBe(true);
		expect(closedWithoutReview(entry("- [x] It rains #prediction [confidence: 80%] ✅ 2027-01-08"))).toBe(true);
	});
	it("is false for reviewed, open and cancelled entries", () => {
		expect(closedWithoutReview(entry(REVIEWED))).toBe(false);
		expect(closedWithoutReview(entry("- [x] It rains #prediction [result: yes]"))).toBe(false);
		expect(closedWithoutReview(entry(OPEN))).toBe(false);
		expect(closedWithoutReview(entry(CANCELLED))).toBe(false);
		expect(closedWithoutReview(entry("- [-] It rains #prediction"))).toBe(false);
	});
});

describe("addOutcome", () => {
	it("writes the missing fields in contract order and keeps the box and the done date", () => {
		expect(addOutcome(LATE, { kind: "decision", outcome: "better", quality: "good", today: "2027-02-01" })).toBe(
			"- [x] Move to Lyon #decision [confidence: 70%] [outcome: better] [quality: good] ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-09",
		);
	});
	it("keeps a field already on the line and adds the other", () => {
		const line = "- [x] A #decision [outcome: worse] ➕ 2026-10-08 ✅ 2027-01-09";
		expect(addOutcome(line, { kind: "decision", outcome: "worse", quality: "bad", today: "2027-02-01" })).toBe("- [x] A #decision [outcome: worse] [quality: bad] ➕ 2026-10-08 ✅ 2027-01-09");
	});
	it("adds the done date only when there is none", () => {
		expect(addOutcome("- [x] It rains #prediction [confidence: 80%] ➕ 2026-10-01", { kind: "prediction", result: "yes", today: "2026-10-09" })).toBe(
			"- [x] It rains #prediction [confidence: 80%] [result: yes] ➕ 2026-10-01 ✅ 2026-10-09",
		);
	});
	it("makes the line a reviewed one", () => {
		const line = addOutcome(LATE, { kind: "decision", outcome: "better", quality: "good", today: "2027-02-01" });
		expect(closedWithoutReview(entry(line))).toBe(false);
	});
});

describe("markNotReviewable", () => {
	it("turns [x] into [-] and leaves the rest alone", () => {
		expect(markNotReviewable(LATE)).toBe(LATE.replace("[x]", "[-]"));
		expect(markNotReviewable("    > - [x] A #decision ✅ 2027-01-08")).toBe("    > - [-] A #decision ✅ 2027-01-08");
	});
	it("takes the line out of the closed-without-review list", () => {
		expect(closedWithoutReview(entry(markNotReviewable(LATE)))).toBe(false);
	});
});

describe("resolveReviewLine", () => {
	it("opens an open entry on the given line, and offers the outcome for a closed one", () => {
		expect(resolveReviewLine(["x", OPEN], 1, TAGS)).toEqual({ kind: "open", line: 1 });
		expect(resolveReviewLine(["x", LATE], 1, TAGS)).toEqual({ kind: "late", line: 1 });
	});
	it("says reviewed for a reviewed or cancelled entry on the line, without looking around", () => {
		expect(resolveReviewLine([OPEN, REVIEWED], 1, TAGS)).toEqual({ kind: "reviewed" });
		expect(resolveReviewLine([OPEN, CANCELLED], 1, TAGS)).toEqual({ kind: "reviewed" });
	});
	it("finds the nearest actionable entry within three lines, the earlier one on a tie", () => {
		const lines = ["a", "b", "c", "d", OPEN, "f", "g", "h", "i"];
		expect(resolveReviewLine(lines, 2, TAGS)).toEqual({ kind: "open", line: 4 });
		expect(resolveReviewLine(lines, 7, TAGS)).toEqual({ kind: "open", line: 4 });
		expect(resolveReviewLine(lines, 8, TAGS)).toEqual({ kind: "none" });
		expect(resolveReviewLine([OPEN, "b", LATE], 1, TAGS)).toEqual({ kind: "open", line: 0 });
	});
	it("skips reviewed entries nearby and handles lines out of range", () => {
		expect(resolveReviewLine([REVIEWED, "b", LATE], 1, TAGS)).toEqual({ kind: "late", line: 2 });
		expect(resolveReviewLine([OPEN], 40, TAGS)).toEqual({ kind: "none" });
		expect(resolveReviewLine([], 0, TAGS)).toEqual({ kind: "none" });
	});
	it("uses the configured tags", () => {
		expect(resolveReviewLine(["- [ ] Move #choix 📅 2027-01-08"], 0, { decisionTag: "choix", predictionTag: "pari" })).toEqual({ kind: "open", line: 0 });
		expect(resolveReviewLine([OPEN], 0, { decisionTag: "choix", predictionTag: "pari" })).toEqual({ kind: "none" });
	});
});
