// Writing what processing an idea produces. The note the idea lives in is rewritten through the journal's
// checked rewrite (Editor for the active note, Vault.process otherwise): the line must still be the one
// the index read, else the write is refused with a notice. Planning is in `idea-note`.
import { Notice, type App } from "obsidian";

import { formatDate, startOfDay } from "../../core/dates";
import type { VaultMateSettings } from "../../core/settings-model";
import type { JournalKind } from "../journal/journal-line";
import type { NewEntryResult } from "../journal/journal-modals";
import { writeEntryLine } from "../journal/journal-write";
import type { IdeaItem } from "./idea-line";
import { closeParts, trackedLines } from "./idea-note";

/** What the writers need: the Obsidian app and the settings (`VaultMatePlugin` fits). */
export interface IdeaWriteHost {
	app: App;
	settings: Pick<VaultMateSettings, "ideas" | "journal">;
}

/**
 * Closes the idea as dropped; a sub-item `Dropped: <note>` only when a note was typed. Returns the closed
 * line when it wrote (to offer `undoDrop`), null when it refused.
 */
export async function dropIdea(host: IdeaWriteHost, item: IdeaItem, note: string): Promise<string | null> {
	const { line, subItem } = closeParts(item, host.settings.ideas.tag, "dropped", formatDate(startOfDay()), null, note);
	return (await writeEntryLine(host.app, item, line, subItem)) ? line : null;
}

/** Puts the original line back after a drop without note, if the line still equals `closedLine`. Returns whether it wrote. */
export function undoDrop(host: IdeaWriteHost, item: IdeaItem, closedLine: string): Promise<boolean> {
	return writeEntryLine(host.app, { path: item.path, line: item.line, raw: closedLine }, item.raw, null);
}

/**
 * Closes the idea as a decision or a prediction and writes the journal line (with its sub-items) as a
 * sub-task of the idea, in one rewrite. Returns whether it wrote.
 */
export async function trackIdeaAs(host: IdeaWriteHost, item: IdeaItem, kind: JournalKind, entry: NewEntryResult): Promise<boolean> {
	if (entry.statement.trim() === "") {
		new Notice(`Write the ${kind} first.`);
		return false;
	}
	const today = startOfDay();
	const { line, subItem } = closeParts(item, host.settings.ideas.tag, kind, formatDate(today), null, "");
	return writeEntryLine(host.app, item, line, subItem, trackedLines(kind, entry, host.settings.journal, today));
}
