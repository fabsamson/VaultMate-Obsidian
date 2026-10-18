// Opening a note at a line for the protocol links (idea link, review link).
import { MarkdownView, Notice, Platform, type App, type Editor, type TFile, type WorkspaceLeaf } from "obsidian";

/** Lines shown above the target line in reading view on mobile. */
const PREVIEW_LEAD_LINES = 3;

/** Opens `file` in `leaf` at `line`. On mobile, reading view would put the line under the status bar and the floating header buttons, so it starts a few lines earlier there; source mode is unchanged. */
export async function openFileAtLine(leaf: WorkspaceLeaf, file: TFile, line: number): Promise<void> {
	await leaf.openFile(file, { eState: { line } });
	const { view } = leaf;
	if (Platform.isMobile && view instanceof MarkdownView && view.getMode() === "preview") view.setEphemeralState({ line: Math.max(0, line - PREVIEW_LEAD_LINES) });
}

/** Opens the note in a leaf already showing it, else in the current leaf; resolves with its view once the editor has the text. */
export async function openNoteAtLine(app: App, file: TFile, line: number): Promise<MarkdownView | null> {
	const { workspace } = app;
	const shown: WorkspaceLeaf | undefined = workspace.getLeavesOfType("markdown").find((leaf) => leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path);
	const leaf = shown ?? workspace.getLeaf(false);
	await openFileAtLine(leaf, file, line);
	await workspace.revealLeaf(leaf);
	const { view } = leaf;
	if (!(view instanceof MarkdownView) || view.file?.path !== file.path) {
		new Notice("VaultMate could not open this note.");
		return null;
	}
	// On mobile the editor may still be loading the text when `openFile` resolves.
	for (let wait = 0; wait < 20 && view.editor.getValue() === "" && file.stat.size > 0; wait++) {
		await new Promise((resolve) => window.setTimeout(resolve, 50));
	}
	return view;
}

/** Puts the cursor at the start of `line` and scrolls to it. */
export function showLine(editor: Editor, line: number): void {
	const from = { line, ch: 0 };
	editor.setCursor(from);
	editor.scrollIntoView({ from, to: { line, ch: editor.getLine(line).length } }, true);
}
