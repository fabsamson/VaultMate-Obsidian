import { ItemView } from "obsidian";

import { CAT_ICON_ID } from "./icon";
import { createSprite } from "./pixel";
import { SPRITES } from "./sprites";

export const HUB_VIEW_TYPE = "vaultmate-hub";

/** Side panel that will host reviews, related notes and recommendations. */
export class HubView extends ItemView {
	public getViewType(): string {
		return HUB_VIEW_TYPE;
	}

	public getDisplayText(): string {
		return "VaultMate";
	}

	public getIcon(): string {
		return CAT_ICON_ID;
	}

	protected onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("vaultmate", "vaultmate-hub");

		root.createDiv({ cls: "vaultmate-pattern-band" }).setCssProps({ "--vaultmate-pattern": `url("${SPRITES.patternSeigaiha.src}")` });

		const header = root.createDiv({ cls: "vaultmate-section-header" });
		header.createSpan({ cls: "vaultmate-section-label", text: "Today" });
		header.createDiv({ cls: "vaultmate-section-rule" });
		header.createSpan({ cls: "vaultmate-section-kanji", text: "今", attr: { "aria-hidden": "true" } });

		const panel = root.createDiv({ cls: "vaultmate-panel vaultmate-empty" });
		createSprite(panel, SPRITES.mascotTea, 96);
		panel.createEl("p", { cls: "vaultmate-empty-title", text: "Nothing to review yet" });
		panel.createEl("p", { cls: "vaultmate-muted", text: "Decisions, predictions, related notes and recommendations will appear here." });
		return Promise.resolve();
	}
}
