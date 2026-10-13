// The scope dropdown shared by the hub pages that cover the vault, one note, or a folder note's tree.
import type { HubPageContext } from "../../ui/hub-view";
import { folderNoteFolder, scopePaths, type JournalScope } from "./scope";

const SCOPE_LABEL: Record<JournalScope, string> = { vault: "Whole vault", note: "This note", tree: "This note and sub-notes" };

function noteName(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

/**
 * Adds the scope dropdown and its hint to `parent` and returns the paths the scope covers (null: the whole
 * vault). A scope that does not apply to the current note shows the whole vault and comes back with a
 * fitting note. `onChange` gets the new paths when the user picks another scope.
 */
export function addScopeControls(
	parent: HTMLElement,
	ctx: HubPageContext,
	notePath: string | null,
	markdownPaths: readonly string[],
	onChange: (allowed: Set<string> | null) => void,
): Set<string> | null {
	const isFolderNote = notePath !== null && folderNoteFolder(notePath, markdownPaths) !== null;
	const available: Record<JournalScope, boolean> = { vault: true, note: notePath !== null, tree: isFolderNote };
	let scope: JournalScope = available[ctx.state.scope] ? ctx.state.scope : "vault";

	const select = parent.createEl("select", { cls: "dropdown vaultmate-scope", attr: { "aria-label": "Scope" } });
	const reasons: Record<JournalScope, string> = { vault: "", note: " (no note open)", tree: notePath === null ? " (no note open)" : " (not a folder note)" };
	for (const value of ["vault", "note", "tree"] as const) {
		const option = select.createEl("option", { value, text: SCOPE_LABEL[value] + (available[value] ? "" : reasons[value]) });
		option.disabled = !available[value];
	}
	select.value = scope;
	const hint = parent.createEl("p", { cls: "vaultmate-muted" });
	const renderHint = (): void => {
		hint.setText(scope !== "vault" && notePath ? `In ${noteName(notePath)}${scope === "tree" ? " and its sub-notes" : ""}` : ctx.state.scope !== "vault" ? "Showing the whole vault: this scope does not apply to the current note." : "");
		hint.toggle(hint.getText() !== "");
	};
	select.addEventListener("change", () => {
		scope = select.value as JournalScope;
		ctx.state.scope = scope;
		ctx.save();
		renderHint();
		onChange(scopePaths(scope, notePath, markdownPaths));
	});
	renderHint();
	return scopePaths(scope, notePath, markdownPaths);
}
