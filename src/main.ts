import { addIcon, Plugin, type WorkspaceLeaf } from "obsidian";

import { normalizeSettings, type VaultMateSettings } from "./core/settings-model";
import { JournalFeature } from "./features/journal/journal";
import { VaultMateSettingTab } from "./settings";
import { HUB_VIEW_TYPE, HubView, type HubSection } from "./ui/hub-view";
import { CAT_ICON_ID, CAT_ICON_SVG } from "./ui/icon";

export default class VaultMatePlugin extends Plugin {
	public settings: VaultMateSettings = normalizeSettings(undefined);
	private readonly journal = new JournalFeature(this);
	private readonly hubSections = new Map<string, HubSection>();

	public async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
		this.addSettingTab(new VaultMateSettingTab(this));
		addIcon(CAT_ICON_ID, CAT_ICON_SVG);
		this.registerView(HUB_VIEW_TYPE, (leaf) => new HubView(leaf, () => this.sortedHubSections()));
		this.addRibbonIcon(CAT_ICON_ID, "Open VaultMate", () => void this.openHub());
		this.addCommand({
			id: "open-panel",
			name: "Open panel",
			icon: CAT_ICON_ID,
			callback: () => void this.openHub(),
		});
		this.journal.register();
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Called after a setting changed. Features read `this.settings` when they run, so the only thing
	 * left to refresh is what is already on screen.
	 */
	public onSettingsChanged(): void {
		this.journal.onSettingsChanged();
		this.refreshHubs();
	}

	/** Adds or replaces (same `id`) a section of the hub, then redraws the open hubs. */
	public registerHubSection(section: HubSection): void {
		this.hubSections.set(section.id, section);
		this.refreshHubs();
	}

	/** Redraws every open hub; call it when the data behind a section changed. */
	public refreshHubs(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(HUB_VIEW_TYPE)) {
			if (leaf.view instanceof HubView) leaf.view.render();
		}
	}

	private sortedHubSections(): HubSection[] {
		return [...this.hubSections.values()].sort((a, b) => a.order - b.order);
	}

	public async openHub(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(HUB_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: HUB_VIEW_TYPE, active: true });
		}
		if (leaf) await workspace.revealLeaf(leaf);
	}
}
