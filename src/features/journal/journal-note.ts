// Working on the lines of a note around a journal entry: its sub-items, the review sub-item, the checked
// rewrite and the lines of a new entry. Pure: no Obsidian import, so Vitest tests it.
//
// Lines are given without their line break. `rewriteText` handles LF and CRLF files.
import { convertToEntry, type JournalKind, type JournalTags } from "./journal-line";

const QUOTE_RE = /^(?:[ \t]*>[ \t]?)*/;
const CHILD_MARKER_RE = /^(?:[-*+]|\d{1,9}[.)])[ \t]+/;

interface LineParts {
	/** Blockquote or callout markers ("> ", "> > "), as written. */
	quote: string;
	indent: string;
	content: string;
}

function splitLine(line: string): LineParts {
	const quote = QUOTE_RE.exec(line)?.[0] ?? "";
	const rest = line.slice(quote.length);
	const indent = /^[ \t]*/.exec(rest)?.[0] ?? "";
	return { quote, indent, content: rest.slice(indent.length) };
}

function quoteDepth(quote: string): number {
	return quote.split(">").length - 1;
}

/** Indentation width in columns, a tab counting as four. */
function width(indent: string): number {
	let columns = 0;
	for (const char of indent) columns += char === "\t" ? 4 : 1;
	return columns;
}

export interface Children {
	/** Index of the last line of the item (its own line when it has no sub-items). */
	end: number;
	/** Indentation of the first sub-item, or null when there is none. */
	indent: string | null;
	/** Text of each sub-item line, without quote, indentation and list marker. */
	items: string[];
}

/**
 * Sub-items of the item on line `index`: the following lines with the same quote depth and a deeper
 * indentation. A blank line or a line that is not deeper ends the item.
 */
export function getChildren(lines: readonly string[], index: number): Children {
	const own = splitLine(lines[index] ?? "");
	const children: Children = { end: index, indent: null, items: [] };
	for (let i = index + 1; i < lines.length; i++) {
		const next = splitLine(lines[i] ?? "");
		if (next.content.trim() === "" || quoteDepth(next.quote) !== quoteDepth(own.quote) || width(next.indent) <= width(own.indent)) break;
		children.end = i;
		children.indent ??= next.indent;
		children.items.push(next.content.replace(CHILD_MARKER_RE, "").trim());
	}
	return children;
}

/** Whether the note indents its lists with tabs. */
export function usesTabs(lines: readonly string[]): boolean {
	return lines.some((line) => splitLine(line).indent.startsWith("\t"));
}

function endsWithPunctuation(text: string): boolean {
	return /[.!?…。！？]$/.test(text);
}

/** `Review <date>: <what happened> Lesson: <lesson>`; null when both parts are empty. */
export function reviewItemText(date: string, happened: string, lesson: string): string | null {
	const what = happened.replace(/\s+/g, " ").trim();
	const learned = lesson.replace(/\s+/g, " ").trim();
	if (!what && !learned) return null;
	const head = what ? `Review ${date}: ${what}` : `Review ${date}:`;
	if (!learned) return head;
	return `${head}${what && !endsWithPunctuation(what) ? "." : ""} Lesson: ${learned}`;
}

export type RewritePlan = { ok: true; from: number; to: number; replacement: string[] } | { ok: false };

/**
 * Replaces line `index` by `newLine` and adds the review sub-item after the item's last sub-item. The
 * plan replaces lines `from` to `to` (inclusive). It refuses (`ok: false`) when the line is not the one
 * that was read, so a note edited in the meantime is never overwritten.
 */
export function planRewrite(lines: readonly string[], index: number, expected: string, newLine: string, subItem: string | null): RewritePlan {
	if (lines[index] !== expected) return { ok: false };
	if (subItem === null) return { ok: true, from: index, to: index, replacement: [newLine] };
	const children = getChildren(lines, index);
	const own = splitLine(expected);
	const indent = children.indent ?? own.indent + (usesTabs(lines) ? "\t" : "    ");
	const sub = `${own.quote}${indent}- ${subItem}`;
	return { ok: true, from: index, to: children.end, replacement: [newLine, ...lines.slice(index + 1, children.end + 1), sub] };
}

export type RewriteResult = { ok: true; text: string } | { ok: false };

/** `planRewrite` applied to the whole text of a note, keeping its line breaks. */
export function rewriteText(text: string, index: number, expected: string, newLine: string, subItem: string | null): RewriteResult {
	const eol = text.includes("\r\n") ? "\r\n" : "\n";
	const lines = text.split(/\r?\n/);
	const plan = planRewrite(lines, index, expected, newLine, subItem);
	if (!plan.ok) return plan;
	lines.splice(plan.from, plan.to - plan.from + 1, ...plan.replacement);
	return { ok: true, text: lines.join(eol) };
}

// ---- New entries ------------------------------------------------------------------------------------

/** Quote markers and indentation of a line, to start new lines at the same place. */
export function linePrefix(line: string): string {
	const { quote, indent } = splitLine(line);
	return `${quote && !/\s$/.test(quote) ? `${quote} ` : quote}${indent}`;
}

export interface NewEntryInput {
	kind: JournalKind;
	tags: JournalTags;
	today: string;
	due: string;
	confidence: number | null;
	statement: string;
	/** Optional sub-items as [label, value]; empty values are skipped ("Why", "Expected"…). */
	extras: ReadonlyArray<readonly [string, string]>;
	/** The line the entry is inserted at or below: its quote markers and indentation are kept. */
	currentLine: string;
	tabs: boolean;
}

/** The entry line followed by its sub-items, ready to insert. */
export function newEntryLines(input: NewEntryInput): string[] {
	const prefix = linePrefix(input.currentLine);
	const statement = input.statement.replace(/\s+/g, " ").trim();
	const line = convertToEntry(`${prefix}- ${statement}`, input);
	const unit = input.tabs ? "\t" : "    ";
	const items = input.extras.flatMap(([label, value]) => {
		const text = value.replace(/\s+/g, " ").trim();
		return text ? [`${prefix}${unit}- ${label}: ${text}`] : [];
	});
	return [line, ...items];
}
