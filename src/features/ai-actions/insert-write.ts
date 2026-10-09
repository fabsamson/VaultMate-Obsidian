// Writing the chosen questions into the note the action was started from. The active editor's note is
// edited through the Editor, any other note through Vault.process.
import { MarkdownView, type App, type Editor } from "obsidian";

import type { InsertTarget } from "./definition";
import { applyPlan, planCursorInsert, planHeadingInsert, renderLine, type InsertPlan } from "./insertion";

export type InsertResult = "inserted" | "already-there" | "needs-cursor" | "missing";

function editorLines(editor: Editor): string[] {
	return Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
}

function applyToEditor(editor: Editor, plan: InsertPlan): void {
	const count = editor.lineCount();
	const text = plan.lines.join("\n");
	if (plan.at >= count) {
		const last = count - 1;
		editor.replaceRange(`\n${text}`, { line: last, ch: editor.getLine(last).length });
	} else if (plan.remove === 0) {
		editor.replaceRange(`${text}\n`, { line: plan.at, ch: 0 });
	} else {
		const lastLine = plan.at + plan.remove - 1;
		editor.replaceRange(text, { line: plan.at, ch: 0 }, { line: lastLine, ch: editor.getLine(lastLine).length });
	}
}

/** Inserts the questions (rendered with the target's line template) and says what happened. */
export async function insertQuestions(app: App, path: string, target: InsertTarget, questions: string[]): Promise<InsertResult> {
	const rendered = questions.map((question) => renderLine(target.line, question));
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const editor = view?.file?.path === path ? view.editor : null;

	const plan = (lines: string[], cursorLine: number): InsertPlan | null =>
		target.type === "heading" ? planHeadingInsert(lines, target.heading, rendered) : planCursorInsert(lines, cursorLine, rendered);

	if (editor) {
		const found = plan(editorLines(editor), editor.getCursor().line);
		if (!found) return "already-there";
		applyToEditor(editor, found);
		return "inserted";
	}
	if (target.type === "cursor") return "needs-cursor";

	const file = app.vault.getFileByPath(path);
	if (!file) return "missing";
	let result: InsertResult = "already-there";
	await app.vault.process(file, (text) => {
		const eol = text.includes("\r\n") ? "\r\n" : "\n";
		const lines = text.split(/\r?\n/);
		const found = plan(lines, 0);
		if (!found) return text;
		result = "inserted";
		return applyPlan(lines, found).join(eol);
	});
	return result;
}
