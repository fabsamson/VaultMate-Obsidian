// The review cases shared with the Android app (tests/contract/reviews/cases.json). Each case gives the lines
// of a note, the entry's line index, what the user chose and the lines expected after the write. The app runs
// the same file (copied by `npm run sync-contract`); both sides must write the same Markdown.
import { describe, expect, it } from "vitest";

import { parseDate } from "../src/core/dates";
import { addOutcome, closeEntry, dueFrom, reviewAgain, type CloseOptions, type Outcome, type PredictionResult, type Quality } from "../src/features/journal/journal-line";
import { planRewrite, reviewItemText } from "../src/features/journal/journal-note";

interface ReviewCase {
	name: string;
	lines: string[];
	index: number;
	action: { type: "close-decision"; outcome: Outcome; quality: Quality } | { type: "close-prediction"; result: PredictionResult } | { type: "again"; interval: "1w" | "1m" | "3m" };
	late: boolean;
	happened: string;
	lesson: string;
	today: string;
	/** The line as the app read it, when it differs from the note (the write must be refused). */
	expectedLine?: string;
	/** The note's lines after the write, or null when the write is refused. */
	expected: string[] | null;
}

const file = JSON.parse(
	Object.values(import.meta.glob<string>("./contract/reviews/cases.json", { query: "?raw", import: "default", eager: true }))[0] ?? "",
) as { cases: ReviewCase[] };

/** What the review form does (journal.ts `applyReview`): the new line, the review sub-item, the rewrite plan. */
function write(c: ReviewCase): string[] | null {
	const raw = c.expectedLine ?? c.lines[c.index] ?? "";
	const { action } = c;
	let line: string;
	if (action.type === "again") {
		line = reviewAgain(raw, dueFrom(parseDate(c.today) as Date, action.interval));
	} else {
		const close = c.late ? addOutcome : closeEntry;
		const options: CloseOptions =
			action.type === "close-decision"
				? { kind: "decision", outcome: action.outcome, quality: action.quality, today: c.today }
				: { kind: "prediction", result: action.result, today: c.today };
		line = close(raw, options);
	}
	const plan = planRewrite(c.lines, c.index, raw, line, reviewItemText(c.today, c.happened, c.lesson));
	return plan.ok ? [...c.lines.slice(0, plan.from), ...plan.replacement, ...c.lines.slice(plan.to + 1)] : null;
}

describe("shared review cases", () => {
	it("has cases", () => {
		expect(file.cases.length).toBeGreaterThan(20);
	});

	it.each(file.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
		expect(write(c)).toEqual(c.expected);
	});
});
