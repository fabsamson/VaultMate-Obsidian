// The result cards of the `suggestions` output. Everything shown has passed the guard.
import { createIconButton, createPanel } from "../../ui/components";
import { createSprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import { setQuickTooltip } from "../../ui/tooltip";
import type { RatedTitle } from "./collection-profile";
import { becauseLine, type Suggestion } from "./suggestions";

export interface SuggestionActions {
	search(suggestion: Suggestion): void;
	copyTitle(suggestion: Suggestion): void;
	/** Adds (true) or removes (false) the title from the Not interested list. */
	setNotInterested(suggestion: Suggestion, rejected: boolean): void;
}

export function renderSuggestionCards(parent: HTMLElement, suggestions: Suggestion[], rated: readonly RatedTitle[], actions: SuggestionActions): void {
	const list = createPanel(parent, "vaultmate-suggestions");
	for (const suggestion of suggestions) {
		const card = list.createDiv({ cls: "vaultmate-suggestion" });
		const head = card.createDiv({ cls: "vaultmate-suggestion-head" });
		const titleEl = head.createSpan({ cls: "vaultmate-suggestion-title", text: suggestion.title });
		const details = [suggestion.year, suggestion.creator].filter((part) => part).join(" · ");
		if (details) head.createSpan({ cls: "vaultmate-muted", text: details });
		const because = becauseLine(suggestion, rated);
		if (because) card.createDiv({ cls: "vaultmate-suggestion-because", text: because });
		if (suggestion.why) card.createDiv({ text: suggestion.why });

		const buttons = card.createDiv({ cls: "vaultmate-suggestion-actions vaultmate-icon-actions" });
		createIconButton(buttons, SPRITES.actionSearch, "Search", () => actions.search(suggestion), { describedBy: titleEl });
		createIconButton(buttons, SPRITES.actionCopy, "Copy title", () => actions.copyTitle(suggestion), { describedBy: titleEl });
		let rejected = false;
		const toggle = createIconButton(buttons, SPRITES.actionDismiss, "Not interested", () => {
			rejected = !rejected;
			toggle.replaceChildren();
			createSprite(toggle, rejected ? SPRITES.actionUndo : SPRITES.actionDismiss, 32);
			setQuickTooltip(toggle, rejected ? "Undo" : "Not interested");
			toggle.setAttribute("aria-pressed", String(rejected));
			card.toggleClass("is-dimmed", rejected);
			actions.setNotInterested(suggestion, rejected);
		}, { describedBy: titleEl });
	}
	parent.createEl("p", { cls: "vaultmate-muted", text: "AI suggestions can be wrong: a title may not exist or be credited to the wrong person." });
}
