// Planning what processing an idea writes: the closed line and its result sub-item, the decision
// sub-task, the text sent to a note or to a new note. Pure: no runtime Obsidian import, so Vitest tests it.
import { formatDate } from "../../core/dates";
import { cleanFolderPath } from "../../core/settings-model";
import { findHeadings, lastNonBlank, planHeadingInsert, type Heading, type InsertPlan } from "../ai-actions/insertion";
import { dueFrom, type JournalKind, type JournalTags } from "../journal/journal-line";
import type { NewEntryResult } from "../journal/journal-modals";
import { getChildren, newEntryLines, splitLine, usesTabs, width, type AppendedLines } from "../journal/journal-note";
import { closeIdea, resultItemText, type IdeaItem, type IdeaResult } from "./idea-line";


/** The idea line closed with `result`, and the result sub-item to add under it (null when there is none). */
export function closeParts(item: IdeaItem, tag: string, result: IdeaResult, today: string, linkText: string | null, note: string): { line: string; subItem: string | null } {
	// The idea's own date: a plain tagged line gets its real ➕ date, not today's.
	return { line: closeIdea(item.raw, tag, result, today, item.date), subItem: resultItemText(result, linkText, note) };
}

/**
 * The journal lines of a decision or a prediction made from an idea: the F1 line and its sub-items, as a
 * sub-task of the idea. They start at the idea's child prefix, their sub-items one indent unit deeper.
 */
export function trackedLines(kind: JournalKind, entry: NewEntryResult, tags: JournalTags, today: Date): AppendedLines {
	return (prefix, unit) =>
		newEntryLines({
			kind,
			tags,
			today: formatDate(today),
			due: dueFrom(today, entry.interval),
			confidence: entry.confidence,
			statement: entry.statement,
			extras: entry.extras,
			currentLine: prefix,
			tabs: unit === "\t",
		});
}

// ---- Sending an idea to a note ------------------------------------------------------------------------

/** A sub-item line of an idea, relative to the idea: nesting level (0 for its direct sub-items) and the text with its list marker. */
export interface ChildLine {
	level: number;
	text: string;
}

/**
 * The sub-items of the idea on line `index`, without the idea's indentation and quote prefix. The nesting
 * level counts the distinct indentations, whatever indent unit the note uses.
 */
export function ideaChildren(lines: readonly string[], index: number): ChildLine[] {
	const own = splitLine(lines[index] ?? "");
	const end = getChildren(lines, index).end;
	const parts = lines.slice(index + 1, end + 1).map((line) => {
		const { indent, content } = splitLine(line);
		return { depth: width(indent) - width(own.indent), content };
	});
	const depths = [...new Set(parts.map((part) => part.depth))].sort((a, b) => a - b);
	return parts.map((part) => ({ level: depths.indexOf(part.depth), text: part.content }));
}

/** The indent unit of a note: a tab when its lists use tabs, else four spaces (the journal's rule). */
export function indentUnit(lines: readonly string[]): string {
	return usesTabs(lines) ? "\t" : "    ";
}

/** Sub-items as lines, each level indented by `unit` from `base` levels deep. */
export function childLines(children: readonly ChildLine[], unit: string, base = 0): string[] {
	return children.map((child) => `${unit.repeat(base + child.level)}${child.text}`);
}

/** Headings of a note outside the frontmatter and fenced code, in order. */
export function listHeadings(lines: string[]): Heading[] {
	return findHeadings(lines);
}

function fold(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[*_~=`]/g, "");
}

/**
 * The heading the ideas of a note usually go under: the first one whose text contains `idea` or `idee`
 * (case, accents and markup ignored), else null, which means the end of the note.
 */
export function defaultIdeaHeading(headings: ReadonlyArray<Pick<Heading, "text">>): string | null {
	return headings.find((heading) => /idea|idee/.test(fold(heading.text)))?.text ?? null;
}

/**
 * Where `- <statement>` and the idea's sub-items go in the target note: the end of the section under
 * `heading` (exact text as listed), or the end of the note when `heading` is null.
 */
export function planAddIdea(lines: string[], heading: string | null, statement: string, children: readonly ChildLine[]): InsertPlan {
	const rendered = [`- ${statement}`, ...childLines(children, indentUnit(lines), 1)];
	if (heading !== null) {
		const plan = planHeadingInsert(lines, heading, rendered, false);
		if (plan) return plan;
	}
	return { at: lastNonBlank(lines, 0, lines.length) + 1, remove: 0, lines: rendered };
}

// ---- A new note from an idea --------------------------------------------------------------------------

// The characters `titleFromIdea` removes, except `/`, which separates folders in a typed path.
const FORBIDDEN_IN_SEGMENT_RE = /[\\:*?"<>|#^[\]]/g;

/**
 * The vault path of a note created from `name`, or null when the name is empty. A name with `/` is a vault
 * path; any other goes in `folderSetting`, else in `defaultParent` (where Obsidian puts new notes). A
 * trailing `.md` is dropped, then added back; characters forbidden in file names are removed.
 */
export function newNotePath(name: string, folderSetting: string, defaultParent: string): string | null {
	const typed = name.trim().replace(/\.md$/i, "");
	const segments = typed
		.split("/")
		.map((segment) => segment.replace(FORBIDDEN_IN_SEGMENT_RE, "").replace(/\s+/g, " ").trim())
		.filter((segment) => segment !== "" && segment !== "." && segment !== "..");
	if (segments.length === 0) return null;
	const folder = typed.includes("/") ? "" : cleanFolderPath(folderSetting === "" ? defaultParent : folderSetting);
	return `${[folder, ...segments].filter((part) => part !== "").join("/")}.md`;
}

export interface NewNoteValues {
	/** The new note's basename. */
	title: string;
	/** The idea as plain text: the statement, then its sub-bullets. */
	idea: string;
	/** A wikilink to the note the idea comes from. */
	source: string;
	/** Today, `YYYY-MM-DD`. */
	date: string;
}

/** Content of a new note without a template. */
export const DEFAULT_NEW_NOTE = "{{idea}}\n\nSource: {{source}}\n";

/** Fills `{{title}}`, `{{idea}}`, `{{source}}` and `{{date}}`; any other `{{…}}` and Templater `<% %>` stay as written. */
export function renderNewNote(template: string, values: NewNoteValues): string {
	return template.replace(/\{\{(title|idea|source|date)\}\}/g, (_, key: keyof NewNoteValues) => values[key]);
}

/** The idea as plain text for a note: the statement, then its sub-bullets de-indented. */
export function ideaText(statement: string, children: readonly ChildLine[], unit: string): string {
	return [statement, ...childLines(children, unit)].join("\n");
}
