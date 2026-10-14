// Applying a project write plan to a note. The note open in the active editor is edited through the Editor
// (one undoable change, from the editor's own lines, so unsaved text counts); any other note through
// Vault.process. The plan itself checks that the targeted line still has the expected text.
import { MarkdownView, Notice, type App, type Editor } from "obsidian";

import { editorLines } from "../journal/journal-write";
import { applyToEditor } from "../ai-actions/insert-write";
import { applyEdits, refusalMessage, type Edit, type WritePlan } from "./project-write";

/** The editor showing `path` in the active Markdown view, or null. */
export function editorFor(app: App, path: string): Editor | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	return view?.file?.path === path ? view.editor : null;
}

/** The lines of a note: the editor's when the note is open there, else the file's. Null when the note is gone. */
export async function readNoteLines(app: App, path: string): Promise<string[] | null> {
	const editor = editorFor(app, path);
	if (editor) return editorLines(editor);
	const file = app.vault.getFileByPath(path);
	return file ? (await app.vault.read(file)).split(/\r?\n/) : null;
}

/** Applies edits (ordered from the end of the note) to an editor; a pure removal deletes the lines, blank line included. */
export function applyEditsToEditor(editor: Editor, edits: readonly Edit[]): void {
	for (const edit of edits) {
		const count = editor.lineCount();
		if (edit.lines.length > 0 || edit.remove === 0) {
			applyToEditor(editor, edit);
		} else if (edit.at + edit.remove < count) {
			editor.replaceRange("", { line: edit.at, ch: 0 }, { line: edit.at + edit.remove, ch: 0 });
		} else {
			// The removed lines run to the end of the note: take the line break before them.
			const last = count - 1;
			const from = edit.at > 0 ? { line: edit.at - 1, ch: editor.getLine(edit.at - 1).length } : { line: 0, ch: 0 };
			editor.replaceRange("", from, { line: last, ch: editor.getLine(last).length });
		}
	}
}

/**
 * Plans a write from the note's current lines and applies it. A refusal shows a notice and writes nothing.
 * Returns whether the plan was applied (an empty plan counts: there was nothing to change).
 */
export async function writeProject(app: App, path: string, plan: (lines: string[]) => WritePlan): Promise<boolean> {
	const editor = editorFor(app, path);
	if (editor) {
		const made = plan(editorLines(editor));
		if (!made.ok) {
			new Notice(refusalMessage(made.reason));
			return false;
		}
		applyEditsToEditor(editor, made.edits);
		return true;
	}
	const file = app.vault.getFileByPath(path);
	if (!file) {
		new Notice("VaultMate could not find this note.");
		return false;
	}
	let made: WritePlan | null = null;
	await app.vault.process(file, (text) => {
		const lines = text.split(/\r?\n/);
		made = plan(lines);
		return made.ok ? applyEdits(lines, made.edits).join(text.includes("\r\n") ? "\r\n" : "\n") : text;
	});
	const result = made as WritePlan | null;
	if (result && !result.ok) {
		new Notice(refusalMessage(result.reason));
		return false;
	}
	return true;
}
