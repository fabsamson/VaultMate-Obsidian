// The track record (plan §4, F1): what closed predictions and decisions say about the user's judgment.
// Pure: no Obsidian import, so Vitest tests it.
import { OUTCOMES, QUALITIES, type JournalEntry, type Outcome, type PredictionResult, type Quality } from "./journal-line";

/** The least number of resolved predictions for a Brier score and calibration bands to mean something. */
export const MIN_SCORED = 5;

const RESULT_VALUE: Record<PredictionResult, number> = { yes: 1, no: 0, partly: 0.5 };

export interface CalibrationBand {
	/** Lower edge, 0 to 90; the band covers `from` to `from + 9` (the last one also holds 100). */
	from: number;
	count: number;
	/** Mean stated probability, in percent. */
	stated: number;
	/** Share of the outcome that came true, in percent (partly counts for half). */
	observed: number;
}

export interface PredictionStats {
	/** Resolved and scored: done, with a result and a probability. */
	scored: number;
	/** Done with a result but no probability. */
	unscored: number;
	hits: number;
	misses: number;
	/** Null below `MIN_SCORED` scored predictions. */
	brier: number | null;
	/** Empty below `MIN_SCORED` scored predictions; only bands with data, lowest first. */
	bands: CalibrationBand[];
}

export interface DecisionStats {
	closed: number;
	/** `matrix[quality][outcome]`, indexed like `QUALITIES` and `OUTCOMES`. */
	matrix: number[][];
	/** Good decision, worse outcome. */
	badLuck: number;
	/** Bad decision, better outcome. */
	lucky: number;
}

export interface Lesson<T> {
	item: T;
	/** `YYYY-MM-DD` of the review. */
	date: string;
	text: string;
}

export interface TrackRecord<T> {
	predictions: PredictionStats;
	decisions: DecisionStats;
	/** Every lesson, most recent review first. */
	lessons: Lesson<T>[];
	/** Closed entries, decisions and predictions. */
	reviewsDone: number;
}

interface Scored {
	p: number;
	outcome: number;
	result: PredictionResult;
}

function mean(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function predictionStats(entries: readonly JournalEntry[]): PredictionStats {
	const scored: Scored[] = [];
	let unscored = 0;
	for (const entry of entries) {
		if (entry.kind !== "prediction" || entry.status !== "done" || entry.result === null) continue;
		if (entry.confidence === null) unscored++;
		else scored.push({ p: entry.confidence, outcome: RESULT_VALUE[entry.result], result: entry.result });
	}
	const hit = (s: Scored): boolean => (s.result === "yes" && s.p > 50) || (s.result === "no" && s.p < 50);
	const miss = (s: Scored): boolean => (s.result === "yes" && s.p < 50) || (s.result === "no" && s.p > 50);
	const stats: PredictionStats = { scored: scored.length, unscored, hits: scored.filter(hit).length, misses: scored.filter(miss).length, brier: null, bands: [] };
	if (scored.length < MIN_SCORED) return stats;

	stats.brier = mean(scored.map((s) => (s.p / 100 - s.outcome) ** 2));
	for (let band = 0; band < 10; band++) {
		const inBand = scored.filter((s) => Math.min(9, Math.floor(s.p / 10)) === band);
		if (inBand.length === 0) continue;
		stats.bands.push({
			from: band * 10,
			count: inBand.length,
			stated: mean(inBand.map((s) => s.p)),
			observed: mean(inBand.map((s) => s.outcome)) * 100,
		});
	}
	return stats;
}

export function decisionStats(entries: readonly JournalEntry[]): DecisionStats {
	const matrix = QUALITIES.map(() => OUTCOMES.map(() => 0));
	let closed = 0;
	for (const entry of entries) {
		if (entry.kind !== "decision" || entry.status !== "done" || entry.outcome === null || entry.quality === null) continue;
		const row = matrix[QUALITIES.indexOf(entry.quality)];
		if (row) row[OUTCOMES.indexOf(entry.outcome)]++;
		closed++;
	}
	const cell = (quality: Quality, outcome: Outcome): number => matrix[QUALITIES.indexOf(quality)]?.[OUTCOMES.indexOf(outcome)] ?? 0;
	return { closed, matrix, badLuck: cell("good", "worse"), lucky: cell("bad", "better") };
}

// "Review 2026-07-06: what happened. Lesson: what to keep" (also "Leçon :", ASCII or full-width colon).
const REVIEW_RE = /^review[ \t]+(\d{4}-\d{2}-\d{2})[ \t]*[:：]/i;
const LESSON_RE = /(?:^|\s)(?:lesson|leçon)[ \t]*[:：][ \t]*(\S.*)$/iu;

/** The review date and lesson of a sub-item, or null when it is not a review with a lesson. */
export function parseLesson(child: string): { date: string; text: string } | null {
	const review = REVIEW_RE.exec(child.trim());
	if (!review?.[1]) return null;
	const lesson = LESSON_RE.exec(child.trim().slice(review[0].length));
	const text = lesson?.[1]?.trim();
	return text ? { date: review[1], text } : null;
}

export function computeTrackRecord<T extends { entry: JournalEntry; children: string[] }>(items: readonly T[]): TrackRecord<T> {
	const entries = items.map((item) => item.entry);
	const lessons: Lesson<T>[] = [];
	for (const item of items) {
		for (const child of item.children) {
			const lesson = parseLesson(child);
			if (lesson) lessons.push({ item, ...lesson });
		}
	}
	lessons.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
	return {
		predictions: predictionStats(entries),
		decisions: decisionStats(entries),
		lessons,
		reviewsDone: entries.filter((entry) => entry.status === "done").length,
	};
}
