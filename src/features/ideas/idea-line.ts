// The idea line model (plan §2 and §10). Pure: no Obsidian import, so Vitest tests it.
//
//   - [ ] Prepare a sprint like a kitchen mise en place #idea ➕ 2026-10-13
//   - [x] Prepare a sprint like a kitchen mise en place #idea [result: added] ➕ 2026-10-13 ✅ 2026-10-15
//
// An idea is a task line with the idea tag, anywhere in the vault. A line with the tag that is not a task
// is an open idea too; it becomes a task when it is processed. Every transform takes a line and returns
// the new line text; characters it does not need to change stay as they were.
import { daysBetween, parseDate } from "../../core/dates";
import {
	checkboxState,
	ensureTag,
	getDescription,
	getInlineField,
	getTaskDate,
	hasTag,
	parseTaskLine,
	replaceTag,
	serializeTaskLine,
	setInlineField,
	setTaskDate,
	setTaskStatus,
	toTaskLine,
} from "../../core/task-line";
import { getChildren } from "../journal/journal-note";

export const IDEA_RESULTS = ["dropped", "new-note", "added", "track", "decision", "prediction"] as const;
export type IdeaResult = (typeof IDEA_RESULTS)[number];
export type IdeaStatus = "open" | "done" | "cancelled";

export interface IdeaEntry {
	status: IdeaStatus;
	/** The description without tags, inline fields and emojis. */
	statement: string;
	/** `YYYY-MM-DD` texts (➕ and ✅), or null. */
	created: string | null;
	done: string | null;
	/** Null when absent or not an allowed value. */
	result: IdeaResult | null;
}

/** What a line is, as far as ideas are concerned. */
export type IdeaClass =
	| { type: "task"; entry: IdeaEntry }
	/** Not a task, but it carries the tag: an open idea. */
	| { type: "plain"; statement: string }
	/** A quick-capture prose line ("Idea: …") without the tag: it can be converted. */
	| { type: "prose"; statement: string };

// "Idea:", "Idée :", "Idee：" (ASCII or full-width colon); followed by the statement.
const PROSE_RE = /^(?:idea|idée|idee)[ \t]*[:：][ \t]*/iu;
const HEADING_RE = /^#{1,6}[ \t]/;

function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | null {
	const lower = value?.toLowerCase() ?? "";
	return allowed.find((item) => item === lower) ?? null;
}

/** Classifies one line; null when ideas have nothing to do with it (a heading, a line without the tag). */
export function classifyIdeaLine(line: string, tag: string): IdeaClass | null {
	const { status, body } = parseTaskLine(line);
	const tagged = hasTag(body, tag);
	if (status !== null) {
		if (tagged) return { type: "task", entry: buildEntry(status, body) };
	} else if (HEADING_RE.test(body)) {
		return null;
	}
	const prose = PROSE_RE.exec(body);
	if (tagged) return { type: "plain", statement: getDescription(prose ? body.slice(prose[0].length) : body) };
	return prose ? { type: "prose", statement: body.slice(prose[0].length).trim() } : null;
}

function buildEntry(statusChar: string, body: string): IdeaEntry {
	return {
		status: checkboxState(statusChar),
		statement: getDescription(body),
		created: getTaskDate(body, "created"),
		done: getTaskDate(body, "done"),
		result: oneOf(IDEA_RESULTS, getInlineField(body, "result")),
	};
}

// ---- Transforms -----------------------------------------------------------------------------------

/**
 * Turns a quick-capture prose line, a plain tagged line, a plain line or a tagged task without ➕ into an
 * open idea task. An empty statement leaves two spaces before the tag, so the user can type between them
 * (see `statementOffset` in `core/task-line`).
 */
export function convertToIdea(line: string, tag: string, today: string): string {
	const text = line.trimEnd();
	let parsed = parseTaskLine(text);
	if (classifyIdeaLine(text, tag)?.type !== "task") {
		const prose = PROSE_RE.exec(parsed.body);
		// The statement starts a sentence once the label is gone: capitalize a lowercase first letter.
		if (prose) parsed = { ...parsed, body: parsed.body.slice(prose[0].length).replace(/^\p{Ll}/u, (c) => c.toUpperCase()) };
	}
	const task = toTaskLine(parsed);
	let { body } = task;
	body = ensureTag(body, tag);
	if (!getTaskDate(body, "created")) body = setTaskDate(body, "created", today);
	if (getDescription(body) === "") body = ` ${body}`;
	return serializeTaskLine({ ...task, body });
}

/**
 * Closes an idea: `[x]`, `[result: …]` and ✅ today. A line that is not yet an idea task is converted
 * first; `created` is the ➕ date it then gets (the idea's own date, see `ideaDate`; default today).
 */
export function closeIdea(line: string, tag: string, result: IdeaResult, today: string, created: string = today): string {
	const parsed = setTaskStatus(parseTaskLine(convertToIdea(line, tag, created)), "x");
	const body = setInlineField(parsed.body, "result", result);
	return serializeTaskLine({ ...parsed, body: setTaskDate(body, "done", today) });
}

/**
 * The result sub-item, without list marker: `New note: [[X]]`, `Added to [[X]]`, `Track in [[P]]: <short
 * name>`, `Dropped: <note>`, with an optional note appended (`Added to [[X]]: why`; for a track the "note"
 * is the short name). Null when there is nothing to write: a drop without a note, a missing link, and
 * decisions and predictions (their sub-item is the journal line itself).
 */
export function resultItemText(result: IdeaResult, linkText: string | null, note: string): string | null {
	const text = note.replace(/\s+/g, " ").trim();
	if (result === "dropped") return text ? `Dropped: ${text}` : null;
	if (!linkText || (result !== "new-note" && result !== "added" && result !== "track")) return null;
	const head = `${result === "added" ? "Added to" : result === "track" ? "Track in" : "New note:"} [[${linkText}]]`;
	return text ? `${head}: ${text}` : head;
}

/** The note an idea was sent to: the first wikilink of a `New note:`, `Added to` or `Track in` sub-item, without alias, heading or block. */
export function resultLinkTarget(children: readonly string[]): string | null {
	for (const child of children) {
		if (!/^(?:New note:|Added to|Track in)/i.test(child)) continue;
		const link = /\[\[([^\]]+)\]\]/.exec(child)?.[1];
		const target = link?.split("|")[0]?.split(/[#^]/)[0]?.trim();
		if (target) return target;
	}
	return null;
}

/** Whether a line is a project seed: its tag is `<ideaTag>/<subtag>` or a sub-tag of it. Never with an empty sub-tag. */
export function isProjectSeed(line: string, ideaTag: string, subtag: string): boolean {
	return subtag !== "" && hasTag(parseTaskLine(line).body, `${ideaTag.replace(/^#/, "")}/${subtag}`);
}

/**
 * The line of an open idea with its idea tag turned into `#<ideaTag>/<subtag>`: the line is otherwise
 * unchanged and stays open. Null when there is nothing to do: no sub-tag, not an open idea, or already a seed.
 */
export function retagAsSeed(line: string, ideaTag: string, subtag: string): string | null {
	const idea = classifyIdeaLine(line, ideaTag);
	if (subtag === "" || (idea?.type !== "plain" && (idea?.type !== "task" || idea.entry.status !== "open")) || isProjectSeed(line, ideaTag, subtag)) return null;
	const parsed = parseTaskLine(line);
	const body = replaceTag(parsed.body, ideaTag, `${ideaTag.replace(/^#/, "")}/${subtag}`);
	return body === null ? null : serializeTaskLine({ ...parsed, body });
}

// ---- Capture ----------------------------------------------------------------------------------------

const TAG_AT_END_RE = /(?:^|\s)#([^\s#]+) $/;

/** Whether the cursor line (cursor at its end) invites planting an idea: the whole tag and a space typed, or an empty "Idea: " line. */
export function ideaCapture(line: string, tag: string): "tagged" | "prose" | null {
	// Cheap exits first: this runs on every cursor move.
	if (!line.endsWith(" ") || (!line.includes("#") && !/[:：]/.test(line))) return null;
	const cls = classifyIdeaLine(line, tag);
	if (!cls) return null;
	if (cls.type === "prose") return cls.statement === "" ? "prose" : null;
	if (cls.type === "task" && (cls.entry.status !== "open" || cls.entry.created !== null)) return null;
	const name = TAG_AT_END_RE.exec(line)?.[1]?.toLowerCase();
	const wanted = tag.replace(/^#/, "").toLowerCase();
	return name !== undefined && (name === wanted || name.startsWith(`${wanted}/`)) ? "tagged" : null;
}

/** Whether the command "Track this line as an idea" applies: a line with text, not a heading, not already an idea task. */
export function canTrackAsIdea(line: string, tag: string): boolean {
	if (line.trim() === "" || HEADING_RE.test(parseTaskLine(line).body)) return false;
	return classifyIdeaLine(line, tag)?.type !== "task";
}

// ---- Dates and age ----------------------------------------------------------------------------------

export type AgeGroup = "fresh" | "waiting" | "wilting";

/** Fresh: up to this many days old (the window of the Gardening review). */
export const FRESH_MAX_DAYS = 2;
/** Waiting: up to this many days old; older ideas are wilting. */
export const WAITING_MAX_DAYS = 14;

/**
 * The date of an idea (`YYYY-MM-DD`): its ➕ date, else a date in the note's name, else `fallback` (the
 * note's creation date, given by the caller).
 */
export function ideaDate(entry: Pick<IdeaEntry, "created"> | null, basename: string, fallback: string): string {
	if (entry?.created && parseDate(entry.created)) return entry.created;
	for (const match of basename.matchAll(/\d{4}-\d{2}-\d{2}/g)) {
		if (parseDate(match[0])) return match[0];
	}
	return fallback;
}

/** Whole days since `date`; negative for a future date, null when `date` is not a real `YYYY-MM-DD`. */
export function ideaAge(date: string, today: Date): number | null {
	const parsed = parseDate(date);
	return parsed ? daysBetween(parsed, today) : null;
}

/** Fresh (0 to 2 days old), waiting (3 to 14) or wilting (more). A future or unreadable date counts as fresh. */
export function ageGroup(date: string, today: Date): AgeGroup {
	const age = ideaAge(date, today);
	if (age === null || age <= FRESH_MAX_DAYS) return "fresh";
	return age <= WAITING_MAX_DAYS ? "waiting" : "wilting";
}

// ---- Titles -----------------------------------------------------------------------------------------

const MAX_TITLE_LENGTH = 60;
// Not allowed in file names or links: \ / : * ? " < > | # ^ [ ]
const FORBIDDEN_RE = /[\\/:*?"<>|#^[\]]/g;

/** A default note title for an idea: at most 60 characters, cut at a word boundary, without characters that file names or links forbid. */
export function titleFromIdea(statement: string): string {
	const clean = statement.replace(FORBIDDEN_RE, "").replace(/\s+/g, " ").trim();
	if (clean === "") return statement.trim() === "" ? "" : "Idea";
	const chars = Array.from(clean);
	if (chars.length <= MAX_TITLE_LENGTH) return clean;
	const cut = chars.slice(0, MAX_TITLE_LENGTH).join("");
	if (/\s/.test(chars[MAX_TITLE_LENGTH] ?? "")) return cut.trim();
	const space = cut.lastIndexOf(" ");
	return (space > 0 ? cut.slice(0, space) : cut).trim();
}

// ---- Items of the index -----------------------------------------------------------------------------

/** An idea with its place in the vault. */
export interface IdeaItem {
	path: string;
	/** 0-based line number at the time the note was indexed. */
	line: number;
	/** The line as read; a write refuses to touch the note when the line no longer equals this text. */
	raw: string;
	/** A task idea, or a tagged line that is not a task yet (an open idea). */
	idea: Extract<IdeaClass, { type: "task" | "plain" }>;
	/** Text of the sub-items, without list markers. */
	children: string[];
	/** `YYYY-MM-DD`: ➕, else a date in the note's name, else the note's creation date. */
	date: string;
	/** Link text of the note the idea was sent to (`New note:` or `Added to` sub-item), or null. */
	resultTarget: string | null;
}

/** The item for line `line` of a note (`lines` is the whole note), or null when it is not an idea task or tagged line. */
export function buildIdeaItem(path: string, basename: string, createdOn: string, line: number, lines: readonly string[], tag: string): IdeaItem | null {
	const raw = lines[line] ?? "";
	const idea = classifyIdeaLine(raw, tag);
	if (idea?.type !== "task" && idea?.type !== "plain") return null;
	const children = getChildren(lines, line).items;
	return {
		path,
		line,
		raw,
		idea,
		children,
		date: ideaDate(idea.type === "task" ? idea.entry : null, basename, createdOn),
		resultTarget: resultLinkTarget(children),
	};
}
