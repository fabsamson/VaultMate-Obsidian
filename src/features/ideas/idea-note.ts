// Planning what processing an idea writes: the closed line and its result sub-item, the decision
// sub-task, the text sent to a note or to a new note. Pure: no runtime Obsidian import, so Vitest tests it.
import { formatDate } from "../../core/dates";
import { dueFrom, type JournalKind, type JournalTags } from "../journal/journal-line";
import type { NewEntryResult } from "../journal/journal-modals";
import { newEntryLines, type AppendedLines } from "../journal/journal-note";
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
