// Writing the chosen questions into the note the action was started from, through the write gateway
// (`core/note-write`).
import type { App } from "obsidian";

import { editorFor, writeNote } from "../../core/note-write";
import type { InsertTarget } from "./definition";
import { planCursorInsert, planHeadingInsert, renderLine } from "./insertion";

export type InsertResult = "inserted" | "already-there" | "needs-cursor" | "missing";

/** Inserts the questions (rendered with the target's line template) and says what happened. */
export async function insertQuestions(app: App, path: string, target: InsertTarget, questions: string[]): Promise<InsertResult> {
	const rendered = questions.map((question) => renderLine(target.line, question));
	// The cursor is the editor's: a note that is not being edited has none.
	const cursorLine = editorFor(app, path)?.getCursor().line;
	if (target.type === "cursor" && cursorLine === undefined) return "needs-cursor";

	const result = await writeNote(app, path, (lines) => {
		const found = target.type === "heading" ? planHeadingInsert(lines, target.heading, rendered) : planCursorInsert(lines, cursorLine ?? 0, rendered);
		return found ? { ok: true, edits: [found] } : { ok: false, reason: null };
	});
	if (result.status === "missing") return "missing";
	return result.status === "written" ? "inserted" : "already-there";
}
