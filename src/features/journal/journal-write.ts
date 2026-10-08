// Writing a rewritten entry back into its note. The active editor's note is edited through the Editor
// (one transaction); any other note through Vault.process. Both first check that the line is still the
// one that was read, and refuse otherwise.
import { MarkdownView, Notice, type App } from "obsidian";

import { planRewrite, rewriteText } from "./journal-note";

/** Where an entry line was read: the line must still have exactly the text `raw`. */
export interface LineTarget {
	path: string;
	line: number;
	raw: string;
}

const CHANGED = "This line changed since VaultMate read it. Open the note and try again.";

/** Replaces the target line by `newLine` and adds the sub-item after the item's last sub-item. Returns whether it wrote. */
export async function writeEntryLine(app: App, target: LineTarget, newLine: string, subItem: string | null): Promise<boolean> {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (view?.file?.path === target.path) {
		const { editor } = view;
		const lines = Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
		const plan = planRewrite(lines, target.line, target.raw, newLine, subItem);
		if (!plan.ok) {
			new Notice(CHANGED);
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
		const result = rewriteText(text, target.line, target.raw, newLine, subItem);
		written = result.ok;
		return result.ok ? result.text : text;
	});
	if (!written) new Notice(CHANGED);
	return written;
}
