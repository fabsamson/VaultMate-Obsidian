// "Open AI actions": a filterable list of the actions found in the actions folder.
import { Notice, SuggestModal, type App } from "obsidian";

import type { ActionDefinition, ActionEntry } from "./definition";
import { createActionIcon } from "./run-modal";

function entryName(entry: ActionEntry): string {
	return entry.ok ? entry.action.name : entry.name;
}

export class CatalogueModal extends SuggestModal<ActionEntry> {
	public constructor(
		app: App,
		private readonly entries: ActionEntry[],
		private readonly run: (action: ActionDefinition) => void,
	) {
		super(app);
		this.setPlaceholder("Search AI actions");
		this.emptyStateText = "No AI action found. Create the default actions in the VaultMate settings.";
	}

	public getSuggestions(query: string): ActionEntry[] {
		const needle = query.trim().toLowerCase();
		// Runnable actions first; invalid ones stay listed, below, with their message.
		return this.entries
			.filter((entry) => {
				const text = entry.ok ? `${entry.action.name} ${entry.action.description}` : `${entry.name} ${entry.message}`;
				return text.toLowerCase().includes(needle);
			})
			.sort((a, b) => Number(b.ok) - Number(a.ok));
	}

	public renderSuggestion(entry: ActionEntry, el: HTMLElement): void {
		el.addClass("vaultmate-action-item");
		if (!entry.ok) el.addClass("is-invalid");
		createActionIcon(el, entry.ok ? entry.action.icon : "circle-alert");
		const text = el.createDiv({ cls: "vaultmate-action-text" });
		text.createDiv({ cls: "vaultmate-action-name", text: entryName(entry) });
		const detail = entry.ok ? entry.action.description : `Unavailable: ${entry.message}`;
		if (detail) text.createDiv({ cls: "vaultmate-muted", text: detail });
	}

	public onChooseSuggestion(entry: ActionEntry): void {
		if (entry.ok) this.run(entry.action);
		else new Notice(`${entry.name}: ${entry.message}`);
	}
}
