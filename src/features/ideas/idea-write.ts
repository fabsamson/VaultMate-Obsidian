// Writing what processing an idea produces. The note the idea lives in is rewritten through the journal's
// checked rewrite (Editor for the active note, Vault.process otherwise): the line must still be the one
// the index read, else the write is refused with a notice. Planning is in `idea-note`.
import { normalizePath, Notice, type App, type TFile } from "obsidian";

import { formatDate, startOfDay } from "../../core/dates";
import { readNoteLines, writeNote } from "../../core/note-write";
import type { VaultMateSettings } from "../../core/settings-model";
import { baseName } from "../context/note-meta";
import type { InsertPlan } from "../ai-actions/insertion";
import { writeProject } from "../projects/project-apply";
import type { TrackStatus } from "../projects/project-note";
import { newTrackInNote, promoteIdea, refusalMessage } from "../projects/project-write";
import { hasProjectTag } from "../projects/project-tag";
import { projectTags } from "../projects/projects-model";
import type { JournalKind } from "../journal/journal-line";
import type { NewEntryResult } from "../journal/journal-modals";
import { CHANGED, writeEntryLine } from "../journal/journal-write";
import { retagAsSeed, type IdeaItem } from "./idea-line";
import { closeParts, DEFAULT_NEW_NOTE, ideaChildren, ideaText, indentUnit, nearestLine, newNotePath, planAddIdea, renderNewNote, trackedLines } from "./idea-note";

/** What the writers need: the Obsidian app and the settings (`VaultMatePlugin` fits). */
export interface IdeaWriteHost {
	app: App;
	settings: Pick<VaultMateSettings, "ideas" | "journal" | "projects">;
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
 * Makes the idea a project seed: its tag becomes `#<tag>/<seed sub-tag>` and the line stays open. The
 * line must still be the one that was read. Returns whether it wrote.
 */
export function makeProjectSeed(host: IdeaWriteHost, item: IdeaItem): Promise<boolean> {
	const { tag, seedSubtag } = host.settings.ideas;
	const line = retagAsSeed(item.raw, tag, seedSubtag);
	if (line === null) {
		new Notice("This idea cannot become a project seed.");
		return Promise.resolve(false);
	}
	return writeEntryLine(host.app, item, line, null);
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

/**
 * The idea with `line` set to where its text is now: the line equal to `item.raw` nearest to `item.line`.
 * Call it right before a writer, since an earlier write can move the line. Null after a notice when the
 * note or the line is gone.
 */
export async function locateIdea(host: Pick<IdeaWriteHost, "app">, item: IdeaItem): Promise<IdeaItem | null> {
	const lines = await readNoteLines(host.app, item.path);
	if (!lines) {
		new Notice("VaultMate could not find this note.");
		return null;
	}
	const line = nearestLine(lines, item.raw, item.line);
	if (line === null) {
		new Notice(CHANGED);
		return null;
	}
	return line === item.line ? item : { ...item, line };
}

/** The lines of the idea's note when the idea line is still the one that was read, else null after a notice. */
async function readSource(app: App, item: IdeaItem): Promise<string[] | null> {
	const lines = await readNoteLines(app, item.path);
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

/**
 * Applies a plan made from the note's current lines through the write gateway. A plan that returns null
 * writes nothing; the result says whether anything was written.
 */
async function insertInto(app: App, file: TFile, plan: (lines: string[]) => InsertPlan | null): Promise<boolean> {
	const result = await writeNote(app, file.path, (lines) => {
		const made = plan(lines);
		return made ? { ok: true, edits: [made] } : { ok: false, reason: null };
	});
	return result.status === "written";
}

/**
 * Sends the idea to `target` as plain text (`- <statement>` and its sub-bullets, no tag, checkbox, fields
 * or emojis), under `heading` or at the end of the note, then closes it as `added` with an `Added to
 * [[…]]` sub-item. The target is written first; a `heading` that is no longer in it refuses the write
 * (nothing is created). Returns whether the idea was closed; when the target was written but the idea line
 * changed in between, it says so in a notice and returns false.
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
	if (!(await insertInto(app, target, (lines) => planAddIdea(lines, heading, statement, children)))) {
		new Notice(`The heading is no longer in ${target.basename}. Nothing was written.`);
		return false;
	}

	const linkText = app.metadataCache.fileToLinktext(target, item.path, true);
	const { line, subItem } = closeParts(item, host.settings.ideas.tag, "added", formatDate(startOfDay()), linkText, note);
	if (await writeEntryLine(app, item, line, subItem, undefined, null)) return true;
	new Notice(`Added to ${linkText}, but the idea line changed: mark it yourself.`);
	return false;
}

// ---- A new track from an idea -------------------------------------------------------------------------

export interface NewTrackChoice {
	status: TrackStatus;
	/** The heading, cleaned with `shortName`. */
	shortName: string;
	/** Added as the first task when the status is In progress; `due` is `YYYY-MM-DD` or empty. */
	firstTask?: { text: string; due: string };
}

/**
 * Turns the idea into a track of the project note `project` (a note with the project tag).
 *
 * In the idea's own note the idea is moved (one edit: the line and its sub-items go, the track is appended).
 * In another project note the track is written first (refused when that note no longer has the
 * project tag), then the idea is closed as `track` with a `Track in [[…]]: <name>` sub-item; its sub-items are
 * copied. Returns whether everything was written; when the track was written but the idea line changed in
 * between, a notice asks to mark the idea by hand and it returns false.
 */
export async function newTrackFromIdea(host: IdeaWriteHost, item: IdeaItem, project: TFile, choice: NewTrackChoice): Promise<boolean> {
	const { app, settings } = host;
	const statement = statementOf(item);
	if (statement === "") {
		new Notice("This idea has no text yet.");
		return false;
	}
	const today = formatDate(startOfDay());
	const firstTask = choice.firstTask ? { text: choice.firstTask.text, today, ...(choice.firstTask.due ? { due: choice.firstTask.due } : {}) } : undefined;
	const tracksTitle = settings.projects.tracksTitle;
	if (project.path === item.path) {
		return writeProject(app, item.path, (lines) =>
			promoteIdea(lines, item, { status: choice.status, shortName: choice.shortName, tracksTitle, tags: projectTags(settings), ...(firstTask ? { firstTask } : {}) }),
		);
	}
	const source = await readSource(app, item);
	if (!source) return false;
	const children = ideaChildren(source, item.line);
	const track = { name: choice.shortName, status: choice.status, text: statement, children, ...(firstTask ? { firstTask } : {}) };
	// The target was a project when it was chosen; refuse, rather than write, if it lost the project tag since.
	if (!hasProjectTag(app.metadataCache.getFileCache(project)?.frontmatter, settings.projects.tag)) {
		new Notice(refusalMessage("not-a-project"));
		return false;
	}
	if (!(await writeProject(app, project.path, (lines) => newTrackInNote(lines, track, { tracksTitle })))) return false;

	const linkText = app.metadataCache.fileToLinktext(project, item.path, true);
	const { line, subItem } = closeParts(item, settings.ideas.tag, "track", today, linkText, choice.shortName);
	if (await writeEntryLine(app, item, line, subItem, undefined, null)) return true;
	new Notice(`Track added to ${linkText}, but the idea line changed: mark it yourself.`);
	return false;
}

// ---- A new note from an idea --------------------------------------------------------------------------

export type NewNoteResult =
	/** The note was created; the idea is closed unless a notice said its line changed. */
	| { status: "created"; file: TFile }
	/** A note with that path exists: nothing was written (the UI can offer to add the idea to it). */
	| { status: "exists"; file: TFile }
	| { status: "failed" };

/** The template's text, or the default when no template is set or it cannot be found (with a notice in that case). */
async function newNoteTemplate(app: App, setting: string): Promise<string> {
	if (setting.trim() === "") return DEFAULT_NEW_NOTE;
	const path = normalizePath(setting.trim());
	const file = app.vault.getFileByPath(path) ?? app.vault.getFileByPath(`${path}.md`);
	if (file) return app.vault.read(file);
	new Notice(`VaultMate could not find the template ${path}. Using the default.`);
	return DEFAULT_NEW_NOTE;
}

export async function createFolders(app: App, path: string): Promise<void> {
	const parts = path.split("/").slice(0, -1);
	for (let i = 1; i <= parts.length; i++) {
		const folder = parts.slice(0, i).join("/");
		if (!app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
	}
}

/**
 * Creates a note from the idea (the template of the settings, else the idea and a link to its note), then
 * closes the idea as `new-note` with a `New note: [[…]]` sub-item. Never overwrites: an existing path is
 * reported as `exists`. `name` is a title or a vault path (see `newNotePath`).
 */
export async function createNoteFromIdea(host: IdeaWriteHost, item: IdeaItem, name: string, note: string): Promise<NewNoteResult> {
	const { app } = host;
	const { newNoteFolder, newNoteTemplate: templatePath } = host.settings.ideas;
	const statement = statementOf(item);
	if (statement === "") {
		new Notice("This idea has no text yet.");
		return { status: "failed" };
	}
	const path = newNotePath(name, newNoteFolder, app.fileManager.getNewFileParent(item.path).path);
	if (path === null) {
		new Notice("Enter a name for the note.");
		return { status: "failed" };
	}
	const notePath = normalizePath(path);
	const existing = app.vault.getFileByPath(notePath);
	if (existing) return { status: "exists", file: existing };
	const sourceFile = app.vault.getFileByPath(item.path);
	const source = await readSource(app, item);
	if (!sourceFile || !source) return { status: "failed" };

	const template = await newNoteTemplate(app, templatePath);
	const content = renderNewNote(template, {
		title: baseName(notePath),
		idea: ideaText(statement, ideaChildren(source, item.line), indentUnit(source)),
		source: `[[${app.metadataCache.fileToLinktext(sourceFile, notePath, true)}]]`,
		date: formatDate(startOfDay()),
	});
	let file: TFile;
	try {
		await createFolders(app, notePath);
		file = await app.vault.create(notePath, content);
	} catch (error) {
		console.error("VaultMate could not create the note", error);
		new Notice("VaultMate could not create the note.");
		return { status: "failed" };
	}

	await closeAsNewNote(host, item, file, note);
	return { status: "created", file };
}

/**
 * Closes the idea as `new-note` with a `New note: [[file]]` sub-item (a launched project seed closes the same
 * way). The idea line must still be the one that was read; else a notice asks to mark it by hand. Returns
 * whether the idea was closed.
 */
export async function closeAsNewNote(host: IdeaWriteHost, item: IdeaItem, file: TFile, note: string): Promise<boolean> {
	const { app, settings } = host;
	const linkText = app.metadataCache.fileToLinktext(file, item.path, true);
	const { line, subItem } = closeParts(item, settings.ideas.tag, "new-note", formatDate(startOfDay()), linkText, note);
	if (await writeEntryLine(app, item, line, subItem, undefined, null)) return true;
	new Notice(`Created ${linkText}, but the idea line changed: mark it yourself.`);
	return false;
}
