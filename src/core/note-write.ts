// The one gateway that rewrites lines of a note. A note shown in a Markdown view in source mode is edited
// through that view's Editor (one undoable change, and unsaved text counts); any other note through
// Vault.process. Reading view is left out on purpose: it keeps its own copy of the text, and an edit
// through its hidden editor is never saved.
//
// The caller's plan gets the note's current lines and either returns the edits or refuses (it checks that
// the lines it targets still have the text it read). A refusal writes nothing.
import type { App, Editor, MarkdownView } from "obsidian";

import { applyEditsToEditor, editorLines, planText, textLines, type NotePlan } from "./note-edit";

export type WriteResult<R> = { status: "written" } | { status: "refused"; reason: R } | { status: "missing" };

function isSourceView(view: unknown): view is MarkdownView {
	const candidate = view as Partial<MarkdownView>;
	return typeof candidate.getMode === "function" && candidate.getMode() === "source" && !!candidate.editor;
}

/** The editor of a Markdown view showing `path` in source mode (the focused one first), or null. */
export function editorFor(app: App, path: string): Editor | null {
	const { workspace } = app;
	const views = workspace
		.getLeavesOfType("markdown")
		.map((leaf) => leaf.view)
		.filter((view): view is MarkdownView => isSourceView(view) && view.file?.path === path);
	return (views.find((view) => view.editor === workspace.activeEditor?.editor) ?? views[0])?.editor ?? null;
}

/** The lines of a note: the editor's when the note is open there, else the file's. Null when the note is gone. */
export async function readNoteLines(app: App, path: string): Promise<string[] | null> {
	const editor = editorFor(app, path);
	if (editor) return editorLines(editor);
	const file = app.vault.getFileByPath(path);
	return file ? textLines(await app.vault.read(file)) : null;
}

/** Plans from the note's current lines and applies the edits. An empty list of edits writes nothing and counts as written. */
export async function writeNote<R>(app: App, path: string, plan: (lines: string[]) => NotePlan<R>): Promise<WriteResult<R>> {
	const editor = editorFor(app, path);
	if (editor) {
		const made = plan(editorLines(editor));
		if (!made.ok) return { status: "refused", reason: made.reason };
		applyEditsToEditor(editor, made.edits);
		return { status: "written" };
	}
	const file = app.vault.getFileByPath(path);
	if (!file) return { status: "missing" };
	let result: WriteResult<R> = { status: "written" };
	await app.vault.process(file, (text) => {
		const made = planText(text, plan);
		if (made.ok) return made.text;
		result = { status: "refused", reason: made.reason };
		return text;
	});
	return result;
}
