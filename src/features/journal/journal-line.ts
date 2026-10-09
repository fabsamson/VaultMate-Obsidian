// The decision and prediction line model (plan §2). Pure: no Obsidian import, so Vitest tests it.
//
//   - [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08
//
// A journal entry is a task line (it has a checkbox) whose body carries the decision or prediction tag.
// Every transform takes a line and returns the new line text; characters it does not need to change
// (priority, recurrence, block id, other fields) stay as they were.
import { addInterval, daysBetween, dueLabel, formatDate, parseDate, type ReviewInterval } from "../../core/dates";
import {
	ensureTag,
	getDescription,
	getInlineField,
	getTaskDate,
	hasTag,
	parseTaskLine,
	serializeTaskLine,
	setInlineField,
	setTaskDate,
	setTaskStatus,
	toTaskLine,
} from "../../core/task-line";

export type JournalKind = "decision" | "prediction";
export type JournalStatus = "open" | "done" | "cancelled";

export const OUTCOMES = ["better", "as-expected", "worse"] as const;
export const QUALITIES = ["good", "unsure", "bad"] as const;
export const RESULTS = ["yes", "no", "partly"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type Quality = (typeof QUALITIES)[number];
export type PredictionResult = (typeof RESULTS)[number];

/** Tag names without `#`, from the settings. */
export interface JournalTags {
	decisionTag: string;
	predictionTag: string;
}

export interface JournalEntry {
	kind: JournalKind;
	status: JournalStatus;
	/** The description without tags, inline fields and emojis. */
	statement: string;
	/** 0 to 100, or null when absent or invalid. */
	confidence: number | null;
	/** `YYYY-MM-DD` texts, or null. */
	created: string | null;
	due: string | null;
	done: string | null;
	/** Decisions only; null when absent or not an allowed value. */
	outcome: Outcome | null;
	quality: Quality | null;
	/** Predictions only. */
	result: PredictionResult | null;
}

/** What a line is, as far as the journal is concerned. */
export type LineClass =
	| { type: "entry"; entry: JournalEntry }
	/** Not a task, but it carries the tag: it can be tracked. */
	| { type: "plain"; kind: JournalKind; statement: string }
	/** A quick-capture prose line ("Decision: …"): it can be converted. */
	| { type: "prose"; kind: JournalKind; statement: string };

// "Decision:", "Décision :", "Prediction：" (ASCII or full-width colon); followed by the statement.
const PROSE_RE = /^(?:(decision|décision)|(prediction|prédiction))[ \t]*[:：][ \t]*/iu;
const HEADING_RE = /^#{1,6}[ \t]/;

export function tagOf(kind: JournalKind, tags: JournalTags): string {
	return kind === "decision" ? tags.decisionTag : tags.predictionTag;
}

function tagKind(body: string, tags: JournalTags): JournalKind | null {
	if (hasTag(body, tags.decisionTag)) return "decision";
	return hasTag(body, tags.predictionTag) ? "prediction" : null;
}

/** 0 to 100 from "70%", "70", "0.7" or "70 %"; a bare number up to 1 is a fraction. Null when invalid. */
export function parseConfidence(text: string | null): number | null {
	if (text === null) return null;
	const match = /^(\d+(?:[.,]\d+)?)\s*(%?)$/.exec(text.trim());
	if (!match) return null;
	const value = Number((match[1] ?? "").replace(",", "."));
	const percent = match[2] ? value : value <= 1 ? value * 100 : value;
	return percent <= 100 ? Math.round(percent * 1e6) / 1e6 : null;
}

/** A percentage typed in a form field ("70", "70%"), 0 to 100, or null. Unlike `parseConfidence`, "1" is 1%. */
export function parsePercentInput(text: string): number | null {
	const match = /^(\d+(?:[.,]\d+)?)\s*%?$/.exec(text.trim());
	if (!match) return null;
	const value = Number((match[1] ?? "").replace(",", "."));
	return value <= 100 ? value : null;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | null {
	const lower = value?.toLowerCase() ?? "";
	return allowed.find((item) => item === lower) ?? null;
}

function statusOf(char: string): JournalStatus {
	if (char === "x" || char === "X") return "done";
	return char === "-" ? "cancelled" : "open";
}

/** Classifies one line; null when the journal has nothing to do with it. */
export function classifyLine(line: string, tags: JournalTags): LineClass | null {
	const parsed = parseTaskLine(line);
	const { body } = parsed;
	if (parsed.status !== null) {
		const kind = tagKind(body, tags);
		if (kind) return { type: "entry", entry: buildEntry(kind, parsed.status, body) };
	} else if (HEADING_RE.test(body)) {
		return null;
	}
	const prose = PROSE_RE.exec(body);
	if (prose) return { type: "prose", kind: prose[1] ? "decision" : "prediction", statement: body.slice(prose[0].length).trim() };
	const kind = parsed.status === null ? tagKind(body, tags) : null;
	return kind ? { type: "plain", kind, statement: getDescription(body) } : null;
}

/** The entry on a line, or null when the line is not a task with the decision or prediction tag. */
export function parseJournalLine(line: string, tags: JournalTags): JournalEntry | null {
	const cls = classifyLine(line, tags);
	return cls?.type === "entry" ? cls.entry : null;
}

function buildEntry(kind: JournalKind, statusChar: string, body: string): JournalEntry {
	return {
		kind,
		status: statusOf(statusChar),
		statement: getDescription(body),
		confidence: parseConfidence(getInlineField(body, "confidence")),
		created: getTaskDate(body, "created"),
		due: getTaskDate(body, "due"),
		done: getTaskDate(body, "done"),
		outcome: kind === "decision" ? oneOf(OUTCOMES, getInlineField(body, "outcome")) : null,
		quality: kind === "decision" ? oneOf(QUALITIES, getInlineField(body, "quality")) : null,
		result: kind === "prediction" ? oneOf(RESULTS, getInlineField(body, "result")) : null,
	};
}

// ---- Transforms -----------------------------------------------------------------------------------

export interface ConvertOptions {
	kind: JournalKind;
	tags: JournalTags;
	/** `YYYY-MM-DD`. */
	today: string;
	/** Review date, `YYYY-MM-DD`. */
	due: string;
	/** Written as `[confidence: NN%]` when not null; an existing field is kept otherwise. */
	confidence: number | null;
}

/**
 * Turns a quick-capture prose line, a plain tagged line, a plain line or a tagged task without dates into
 * a contract line. An empty statement leaves two spaces before the tag, so the user can type between them
 * (see `statementOffset`).
 */
export function convertToEntry(line: string, options: ConvertOptions): string {
	const text = line.trimEnd();
	let parsed = parseTaskLine(text);
	if (classifyLine(text, options.tags)?.type === "prose") {
		const prose = PROSE_RE.exec(parsed.body);
		// The prose statement starts a sentence once the label is gone: capitalize a lowercase first letter.
		parsed = { ...parsed, body: parsed.body.slice(prose?.[0].length ?? 0).replace(/^\p{Ll}/u, (c) => c.toUpperCase()) };
	}
	let { body } = toTaskLine(parsed);
	body = ensureTag(body, tagOf(options.kind, options.tags));
	if (options.confidence !== null) body = setInlineField(body, "confidence", `${options.confidence}%`);
	if (!getTaskDate(body, "created")) body = setTaskDate(body, "created", options.today);
	body = setTaskDate(body, "due", options.due);
	if (getDescription(body) === "") body = ` ${body}`;
	return serializeTaskLine({ ...toTaskLine(parsed), body });
}

/** Where the statement goes in a line made by `convertToEntry` with an empty statement. */
export function statementOffset(line: string): number {
	const parsed = parseTaskLine(line);
	const prefix = line.length - parsed.body.length;
	return parsed.statusGap.length > 1 ? prefix - 1 : prefix;
}

export type CloseOptions =
	| { kind: "decision"; outcome: Outcome; quality: Quality; today: string }
	| { kind: "prediction"; result: PredictionResult; today: string };

/** Closes an entry: `[x]`, the outcome fields and ✅ today. The review date stays. */
export function closeEntry(line: string, options: CloseOptions): string {
	const parsed = setTaskStatus(parseTaskLine(line), "x");
	let { body } = parsed;
	if (options.kind === "decision") {
		body = setInlineField(body, "outcome", options.outcome);
		body = setInlineField(body, "quality", options.quality);
	} else {
		body = setInlineField(body, "result", options.result);
	}
	return serializeTaskLine({ ...parsed, body: setTaskDate(body, "done", options.today) });
}

/** An intermediate review: the box stays open and 📅 moves to the new date. */
export function reviewAgain(line: string, due: string): string {
	const parsed = parseTaskLine(line);
	return serializeTaskLine({ ...parsed, body: setTaskDate(parsed.body, "due", due) });
}

/** `YYYY-MM-DD` of today plus a review interval. */
export function dueFrom(today: Date, interval: ReviewInterval): string {
	return formatDate(addInterval(today, interval));
}

// ---- Grouping for the hub ---------------------------------------------------------------------------

export interface ReviewGroups<T> {
	overdue: T[];
	/** Today up to six days ahead. */
	week: T[];
	upcoming: T[];
	/** Open entries without a usable 📅 date. */
	undated: T[];
}

/** Open entries only, each group sorted by review date (undated keep their order). */
export function groupByDue<T extends { entry: JournalEntry }>(items: readonly T[], today: Date): ReviewGroups<T> {
	const groups: ReviewGroups<T> = { overdue: [], week: [], upcoming: [], undated: [] };
	const days = new Map<T, number>();
	for (const item of items) {
		if (item.entry.status !== "open") continue;
		const due = item.entry.due === null ? null : parseDate(item.entry.due);
		if (!due) {
			groups.undated.push(item);
			continue;
		}
		const away = daysBetween(today, due);
		days.set(item, away);
		(away < 0 ? groups.overdue : away < 7 ? groups.week : groups.upcoming).push(item);
	}
	for (const group of [groups.overdue, groups.week, groups.upcoming]) group.sort((a, b) => (days.get(a) ?? 0) - (days.get(b) ?? 0));
	return groups;
}

/** Number of open entries due today or earlier. */
export function countDue<T extends { entry: JournalEntry }>(items: readonly T[], today: Date): number {
	return items.filter((item) => {
		const due = item.entry.status === "open" && item.entry.due !== null ? parseDate(item.entry.due) : null;
		return due !== null && daysBetween(today, due) <= 0;
	}).length;
}

// ---- Badge text -------------------------------------------------------------------------------------

export interface BadgeInfo {
	/** Visible text, kind written out. */
	text: string;
	/** What a click does: review an open entry, track a prose or undated line, nothing for a closed one. */
	action: "review" | "track" | "none";
	kind: JournalKind;
}

const KIND_LABEL: Record<JournalKind, string> = { decision: "⚖ Decision", prediction: "◔ Prediction" };

export function kindName(kind: JournalKind): string {
	return kind === "decision" ? "decision" : "prediction";
}

function entryDetail(entry: JournalEntry, today: Date): string {
	if (entry.status === "cancelled") return "cancelled";
	if (entry.status === "done") {
		if (entry.kind === "decision") {
			const parts = [entry.outcome?.replace("-", " "), entry.quality ? `${entry.quality} decision` : null].filter(Boolean);
			return parts.length > 0 ? `reviewed: ${parts.join(", ")}` : "reviewed";
		}
		return entry.result ? `resolved: ${entry.result}` : "resolved";
	}
	const due = entry.due === null ? null : parseDate(entry.due);
	if (!due) return "no review date";
	const label = dueLabel(due, today);
	return daysBetween(today, due) < 0 ? label : `review ${label}`;
}

export function badgeFor(cls: LineClass, today: Date): BadgeInfo {
	if (cls.type !== "entry") return { text: `${cls.kind === "decision" ? "⚖" : "◔"} Track as ${kindName(cls.kind)}`, action: "track", kind: cls.kind };
	const { entry } = cls;
	const open = entry.status === "open";
	const percent = entry.kind !== "prediction" || entry.confidence === null ? null : `${entry.confidence}%`;
	const askProbability = entry.kind === "prediction" && open && entry.confidence === null;
	const parts = [KIND_LABEL[entry.kind], percent, askProbability ? "add a probability" : entryDetail(entry, today)];
	const action = !open ? "none" : entry.due === null ? "track" : "review";
	return { text: parts.filter(Boolean).join(" · "), action, kind: entry.kind };
}
