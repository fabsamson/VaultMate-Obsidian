// Writing what processing an idea produces. The note the idea lives in is rewritten through the journal's
// checked rewrite (Editor for the active note, Vault.process otherwise): the line must still be the one
// the index read, else the write is refused with a notice. Planning is in `idea-note`.
import { MarkdownView, Notice, type App, type Editor, type TFile } from "obsidian";

import { formatDate, startOfDay } from "../../core/dates";
import type { VaultMateSettings } from "../../core/settings-model";
import { applyPlan, type InsertPlan } from "../ai-actions/insertion";
import { applyToEditor } from "../ai-actions/insert-write";
import type { JournalKind } from "../journal/journal-line";
import type { NewEntryResult } from "../journal/journal-modals";
import { CHANGED, editorLines, writeEntryLine } from "../journal/journal-write";
import type { IdeaItem } from "./idea-line";
import { closeParts, ideaChildren, planAddIdea, trackedLines } from "./idea-note";

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

// ---- Sending an idea to a note ------------------------------------------------------------------------

/** The statement of an idea, as the index read it. */
function statementOf(item: IdeaItem): string {
	return item.idea.type === "task" ? item.idea.entry.statement : item.idea.statement;
}

function activeEditor(app: App, path: string): Editor | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	return view?.file?.path === path ? view.editor : null;
}

/** The lines of a note, from the editor when it is open there. */
async function readLines(app: App, path: string): Promise<string[] | null> {
	const editor = activeEditor(app, path);
	if (editor) return editorLines(editor);
	const file = app.vault.getFileByPath(path);
	return file ? (await app.vault.read(file)).split(/\r?\n/) : null;
}

/** The lines of the idea's note when the idea line is still the one that was read, else null after a notice. */
async function readSource(app: App, item: IdeaItem): Promise<string[] | null> {
	const lines = await readLines(app, item.path);
	if (!lines) {
		new Notice("VaultMate could not find this note.");
		return null;
	}
	if (lines[item.line] !== item.raw) {
		new Notice(CHANGED);
		return null;
	}
	return lines;
}

/** Applies a plan made from the note's current lines: through the Editor when the note is open there, else `Vault.process`. */
async function insertInto(app: App, file: TFile, plan: (lines: string[]) => InsertPlan): Promise<void> {
	const editor = activeEditor(app, file.path);
	if (editor) {
		applyToEditor(editor, plan(editorLines(editor)));
		return;
	}
	await app.vault.process(file, (text) => {
		const lines = text.split(/\r?\n/);
		return applyPlan(lines, plan(lines)).join(text.includes("\r\n") ? "\r\n" : "\n");
	});
}

/**
 * Sends the idea to `target` as plain text (`- <statement>` and its sub-bullets, no tag, checkbox, fields
 * or emojis), under `heading` or at the end of the note, then closes it as `added` with an `Added to
 * [[…]]` sub-item. The target is written first. Returns whether the idea was closed; when the target was
 * written but the idea line changed in between, it says so in a notice and returns false.
 */
export async function addIdeaToNote(host: IdeaWriteHost, item: IdeaItem, target: TFile, heading: string | null, note: string): Promise<boolean> {
	const { app } = host;
	if (target.path === item.path) {
		new Notice("Pick another note: the idea is already in this one.");
		return false;
	}
	const statement = statementOf(item);
	if (statement === "") {
		new Notice("This idea has no text yet.");
		return false;
	}
	const source = await readSource(app, item);
	if (!source) return false;
	const children = ideaChildren(source, item.line);
	await insertInto(app, target, (lines) => planAddIdea(lines, heading, statement, children));

	const linkText = app.metadataCache.fileToLinktext(target, item.path, true);
	const { line, subItem } = closeParts(item, host.settings.ideas.tag, "added", formatDate(startOfDay()), linkText, note);
	if (await writeEntryLine(app, item, line, subItem)) return true;
	new Notice(`Added to ${linkText}, but the idea line changed: mark it yourself.`);
	return false;
}
