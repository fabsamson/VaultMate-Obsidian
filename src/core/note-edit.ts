// The pure half of the write gateway (`note-write`): edits as splices of a note's lines, applied to a list
// of lines, to a text (keeping its line breaks) or to an Editor. No runtime `obsidian` import.
import type { Editor } from "obsidian";

/** A splice of the note's lines: `remove` lines from index `at` are replaced by `lines` (`at` may equal the line count). */
export interface NoteEdit {
	at: number;
	remove: number;
	lines: string[];
}

/** What a caller's plan says about the note's current lines: the edits to make, or why it refuses. */
export type NotePlan<R> = { ok: true; edits: NoteEdit[] } | { ok: false; reason: R };

/** Applies edits one after the other, in the order given (a plan orders them from the end of the note). */
export function applyEdits(lines: string[], edits: readonly NoteEdit[]): string[] {
	const next = [...lines];
	for (const edit of edits) next.splice(edit.at, edit.remove, ...edit.lines);
	return next;
}

export function textLines(text: string): string[] {
	return text.split(/\r?\n/);
}

/** The line break of a text: CRLF as soon as it has one. */
export function eolOf(text: string): string {
	return text.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Plans from the lines of `text` and applies the plan, keeping the line breaks (a final line break stays,
 * a missing one stays missing). Returns the new text, or the plan's refusal.
 */
export function planText<R>(text: string, plan: (lines: string[]) => NotePlan<R>): { ok: true; text: string } | { ok: false; reason: R } {
	const lines = textLines(text);
	const made = plan(lines);
	return made.ok ? { ok: true, text: applyEdits(lines, made.edits).join(eolOf(text)) } : made;
}

export function editorLines(editor: Editor): string[] {
	return Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
}

/**
 * Applies edits to an editor, each as one change (Obsidian groups them in one undo step). A pure removal
 * takes the line break with the lines, so no blank line is left.
 */
export function applyEditsToEditor(editor: Editor, edits: readonly NoteEdit[]): void {
	for (const edit of edits) {
		const count = editor.lineCount();
		const text = edit.lines.join("\n");
		if (edit.lines.length === 0 && edit.remove > 0) {
			if (edit.at + edit.remove < count) {
				editor.replaceRange("", { line: edit.at, ch: 0 }, { line: edit.at + edit.remove, ch: 0 });
			} else {
				// The removed lines run to the end of the note: take the line break before them.
				const last = count - 1;
				const from = edit.at > 0 ? { line: edit.at - 1, ch: editor.getLine(edit.at - 1).length } : { line: 0, ch: 0 };
				editor.replaceRange("", from, { line: last, ch: editor.getLine(last).length });
			}
		} else if (edit.at >= count) {
			const last = count - 1;
			editor.replaceRange(`\n${text}`, { line: last, ch: editor.getLine(last).length });
		} else if (edit.remove === 0) {
			editor.replaceRange(`${text}\n`, { line: edit.at, ch: 0 });
		} else {
			const lastLine = edit.at + edit.remove - 1;
			editor.replaceRange(text, { line: edit.at, ch: 0 }, { line: lastLine, ch: editor.getLine(lastLine).length });
		}
	}
}
