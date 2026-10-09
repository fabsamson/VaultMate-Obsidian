import { describe, expect, it } from "vitest";

import { parseJournalLine, type JournalEntry } from "../src/features/journal/journal-line";
import { computeTrackRecord, decisionStats, parseLesson, predictionStats } from "../src/features/journal/track-record";

const TAGS = { decisionTag: "decision", predictionTag: "prediction" };

function entry(line: string): JournalEntry {
	const parsed = parseJournalLine(line, TAGS);
	if (!parsed) throw new Error(`not an entry: ${line}`);
	return parsed;
}

function prediction(confidence: number | null, result: string, status = "x"): JournalEntry {
	const field = confidence === null ? "" : ` [confidence: ${confidence}%]`;
	return entry(`- [${status}] Guess #prediction${field} [result: ${result}]`);
}

function decision(outcome: string, quality: string, status = "x"): JournalEntry {
	return entry(`- [${status}] Pick #decision [outcome: ${outcome}] [quality: ${quality}]`);
}

const five = (p: number, result: string): JournalEntry[] => Array.from({ length: 5 }, () => prediction(p, result));

describe("predictionStats", () => {
	it("computes the Brier score on known values", () => {
		// 0.01 + 0.49 + 0.25 + 0.01 + 0.01 = 0.77, over 5
		const stats = predictionStats([prediction(90, "yes"), prediction(70, "no"), prediction(50, "yes"), prediction(90, "yes"), prediction(90, "yes")]);
		expect(stats.brier).toBeCloseTo(0.154, 6);
		expect(stats.scored).toBe(5);
	});

	it("scores always-50% as 0.25", () => {
		expect(predictionStats([...five(50, "yes"), ...five(50, "no")]).brier).toBeCloseTo(0.25, 9);
	});

	it("counts partly as 0.5 and as neither hit nor miss", () => {
		const stats = predictionStats(five(80, "partly"));
		expect(stats.brier).toBeCloseTo(0.09, 9);
		expect(stats.hits).toBe(0);
		expect(stats.misses).toBe(0);
		expect(stats.bands[0]).toMatchObject({ from: 80, observed: 50 });
	});

	it("counts hits and misses, and ignores p = 50%", () => {
		const stats = predictionStats([prediction(70, "yes"), prediction(30, "no"), prediction(70, "no"), prediction(30, "yes"), prediction(50, "yes"), prediction(50, "no")]);
		expect(stats.hits).toBe(2);
		expect(stats.misses).toBe(2);
	});

	it("places bands at their edges, 100 in the last one", () => {
		const stats = predictionStats([prediction(0, "no"), prediction(9, "no"), prediction(10, "yes"), prediction(95, "yes"), prediction(100, "yes")]);
		expect(stats.bands.map((band) => [band.from, band.count])).toEqual([
			[0, 2],
			[10, 1],
			[90, 2],
		]);
		expect(stats.bands[2]).toMatchObject({ stated: 97.5, observed: 100 });
	});

	it("shows only counts below five scored predictions", () => {
		const stats = predictionStats([prediction(80, "yes"), prediction(80, "no"), prediction(80, "yes"), prediction(80, "yes")]);
		expect(stats).toMatchObject({ scored: 4, hits: 3, misses: 1, brier: null, bands: [] });
	});

	it("leaves out cancelled, open and resultless entries and counts unscored ones apart", () => {
		const stats = predictionStats([...five(70, "yes"), prediction(70, "yes", "-"), prediction(70, "yes", " "), prediction(null, "yes"), entry("- [x] No result #prediction [confidence: 60%]")]);
		expect(stats.scored).toBe(5);
		expect(stats.unscored).toBe(1);
		expect(stats.hits).toBe(5);
	});

	it("ignores decisions", () => {
		expect(predictionStats([decision("better", "good")]).scored).toBe(0);
	});
});

describe("decisionStats", () => {
	it("fills the quality x outcome matrix and names the off-diagonal readings", () => {
		const stats = decisionStats([decision("worse", "good"), decision("worse", "good"), decision("better", "bad"), decision("as-expected", "unsure"), decision("better", "good")]);
		expect(stats.closed).toBe(5);
		expect(stats.matrix).toEqual([
			[1, 0, 2],
			[0, 1, 0],
			[1, 0, 0],
		]);
		expect(stats.badLuck).toBe(2);
		expect(stats.lucky).toBe(1);
	});

	it("skips cancelled, open and incomplete decisions", () => {
		const stats = decisionStats([decision("better", "good", "-"), decision("better", "good", " "), entry("- [x] No quality #decision [outcome: better]")]);
		expect(stats.closed).toBe(0);
	});
});

describe("parseLesson", () => {
	it("reads an English lesson", () => {
		expect(parseLesson("Review 2026-07-06: fewer dropped tasks. Lesson: keep the plan to five items.")).toEqual({ date: "2026-07-06", text: "keep the plan to five items." });
	});

	it("reads French and full-width colons", () => {
		expect(parseLesson("Review 2026-07-06 : ok. Leçon : demander avant")?.text).toBe("demander avant");
		expect(parseLesson("Review 2026-07-06： ok. Lesson：ask first")?.text).toBe("ask first");
	});

	it("reads a lesson without what happened", () => {
		expect(parseLesson("Review 2026-07-06: Lesson: measure")?.text).toBe("measure");
	});

	it("rejects reviews without a lesson and other sub-items", () => {
		expect(parseLesson("Review 2026-07-06: nothing to add")).toBeNull();
		expect(parseLesson("Review 2026-07-06: ok. Lesson:")).toBeNull();
		expect(parseLesson("Why: Lesson: not a review")).toBeNull();
	});
});

describe("computeTrackRecord", () => {
	const item = (line: string, children: string[] = []) => ({ entry: entry(line), children });

	it("orders lessons by review date, keeps several per entry and counts closed entries", () => {
		const a = item("- [x] A #decision [outcome: better] [quality: good]", ["Review 2026-01-05: a. Lesson: first", "Review 2026-03-01: b. Lesson: third"]);
		const b = item("- [ ] B #prediction [confidence: 60%]", ["Review 2026-02-01: c. Lesson: second", "Why: because"]);
		const c = item("- [x] C #prediction [confidence: 60%] [result: yes]");
		const record = computeTrackRecord([a, b, c]);
		expect(record.lessons.map((lesson) => lesson.text)).toEqual(["third", "second", "first"]);
		expect(record.lessons[0]?.item).toBe(a);
		expect(record.reviewsDone).toBe(2);
	});

	it("is empty without entries", () => {
		const record = computeTrackRecord([]);
		expect(record).toMatchObject({ lessons: [], reviewsDone: 0 });
		expect(record.predictions.brier).toBeNull();
	});
});
