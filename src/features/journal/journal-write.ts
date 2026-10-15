// Writing a rewritten entry back into its note. The active editor's note is edited through the Editor
// (one transaction); any other note through Vault.process. Both first check that the line is still the
// one that was read, and refuse otherwise.
import { MarkdownView, Notice, type App, type Editor } from "obsidian";

import { planRewrite, rewriteText, type AppendedLines } from "./journal-note";

/** Where an entry line was read: the line must still have exactly the text `raw`. */
export interface LineTarget {
	path: string;
	line: number;
	raw: string;
}

export function editorLines(editor: Editor): string[] {
	return Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
}

export const CHANGED = "This line changed since VaultMate read it. Open the note and try again.";

/**
 * Replaces the target line by `newLine` and adds the sub-item, then the `appended` lines, after the item's last
 * sub-item. Returns whether it wrote. When the line changed, a notice says `refusal` (none when null: the
 * caller says it in its own words).
 */
export async function writeEntryLine(
	app: App,
	target: LineTarget,
	newLine: string,
	subItem: string | null,
	appended?: AppendedLines,
	refusal: string | null = CHANGED,
): Promise<boolean> {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	// Reading view keeps its own copy of the text: an edit through its hidden editor would never be saved.
	if (view?.file?.path === target.path && view.getMode() === "source") {
		const { editor } = view;
		const lines = editorLines(editor);
		const plan = planRewrite(lines, target.line, target.raw, newLine, subItem, appended);
		if (!plan.ok) {
			if (refusal !== null) new Notice(refusal);
			return false;
		}
		editor.transaction({
			changes: [{ from: { line: plan.from, ch: 0 }, to: { line: plan.to, ch: lines[plan.to]?.length ?? 0 }, text: plan.replacement.join("\n") }],
		});
		return true;
	}
	const file = app.vault.getFileByPath(target.path);
	if (!file) {
		new Notice("VaultMate could not find this note.");
		return false;
	}
	let written = false;
	await app.vault.process(file, (text) => {
		const result = rewriteText(text, target.line, target.raw, newLine, subItem, appended);
		written = result.ok;
		return result.ok ? result.text : text;
	});
	if (!written && refusal !== null) new Notice(refusal);
	return written;
}
