// The scope chips shared by the hub pages that cover the vault, one note, or a folder note's tree.
import { createChipRow, type Choice } from "../../ui/components";
import type { HubPageContext } from "../../ui/hub-view";
import type { Sprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import { folderNoteFolder, scopePaths, type JournalScope } from "./scope";

const SCOPE_LABEL: Record<JournalScope, string> = { vault: "Whole vault", note: "This note", tree: "With sub-notes" };

const SCOPE_SHORT_LABEL: Record<JournalScope, string> = { vault: "Vault", note: "Note", tree: "Sub-notes" };

const SCOPE_SPRITE: Record<JournalScope, Sprite> = { vault: SPRITES.stateScopeVault, note: SPRITES.stateScopeNote, tree: SPRITES.stateScopeTree };

function noteName(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

/**
 * Adds the scope chips and their hint to `parent` and returns the paths the scope covers (null: the whole
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

	const reasons: Record<JournalScope, string> = { vault: "", note: "No note open", tree: notePath === null ? "No note open" : "Not a folder note" };
	const choices = (["vault", "note", "tree"] as const).map((value): Choice<JournalScope> => ({ value, label: SCOPE_LABEL[value], shortLabel: SCOPE_SHORT_LABEL[value], sprite: SCOPE_SPRITE[value], disabled: available[value] ? undefined : reasons[value] }));
	const row = createChipRow(parent, {
		label: "Scope",
		choices,
		value: scope,
		onChange: (value) => {
			scope = value;
			ctx.state.scope = scope;
			ctx.save();
			renderHint();
			onChange(scopePaths(scope, notePath, markdownPaths));
		},
	});
	row.el.addClass("vaultmate-scope-chips");
	const hint = parent.createEl("p", { cls: "vaultmate-muted" });
	const renderHint = (): void => {
		hint.setText(scope !== "vault" && notePath ? `In ${noteName(notePath)}${scope === "tree" ? " and its sub-notes" : ""}` : ctx.state.scope !== "vault" ? "Showing the whole vault: this scope does not apply to the current note." : "");
		hint.toggle(hint.getText() !== "");
	};
	renderHint();
	return scopePaths(scope, notePath, markdownPaths);
}
