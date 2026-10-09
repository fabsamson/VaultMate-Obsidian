import { ItemView, type WorkspaceLeaf } from "obsidian";

import { createPanel, createSectionHeader } from "./components";
import { CAT_ICON_ID } from "./icon";
import { createSprite } from "./pixel";
import { SPRITES } from "./sprites";

export const HUB_VIEW_TYPE = "vaultmate-hub";

/** A block of the hub that a feature contributes (register it with `plugin.registerHubSection`). */
export interface HubSection {
	/** Unique; registering the same id again replaces the section. */
	id: string;
	/** Sections are shown in ascending order. */
	order: number;
	/** Header text, in sentence case. */
	label: string;
	/** Checked on every redraw, so turning a feature off hides its section without a reload. */
	enabled: () => boolean;
	/** Fills the empty `body`; it may be async. Add a panel with `createPanel(body)` when you need one. */
	render: (body: HTMLElement) => void | Promise<void>;
}

/** Side panel that hosts the sections contributed by the features. */
export class HubView extends ItemView {
	public constructor(leaf: WorkspaceLeaf, private readonly getSections: () => HubSection[]) {
		super(leaf);
	}

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
		this.render();
		return Promise.resolve();
	}

	/** Redraws the whole hub from the current sections. */
	public render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("vaultmate", "vaultmate-hub");
		root.createDiv({ cls: "vaultmate-pattern-band" }).setCssProps({ "--vaultmate-pattern": `url("${SPRITES.patternSeigaiha.src}")` });

		const sections = this.getSections().filter((section) => section.enabled());
		if (sections.length === 0) {
			this.renderEmpty(root);
			return;
		}
		for (const section of sections) {
			createSectionHeader(root, section.label);
			void this.fill(section, root.createDiv({ cls: "vaultmate-hub-section" }));
		}
	}

	private async fill(section: HubSection, body: HTMLElement): Promise<void> {
		try {
			await section.render(body);
		} catch (error) {
			console.error(`VaultMate: the "${section.id}" section failed`, error);
			body.empty();
			body.createEl("p", { cls: "vaultmate-muted", text: "This section could not be shown." });
		}
	}

	private renderEmpty(root: HTMLElement): void {
		createSectionHeader(root, "Today");
		const panel = createPanel(root, "vaultmate-empty");
		createSprite(panel, SPRITES.mascotTea, 96);
		panel.createEl("p", { cls: "vaultmate-empty-title", text: "Nothing to review yet" });
		panel.createEl("p", { cls: "vaultmate-muted", text: "Decisions, predictions, related notes and recommendations will appear here." });
	}
}
