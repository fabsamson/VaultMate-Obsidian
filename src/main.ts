import { addIcon, Plugin, type WorkspaceLeaf } from "obsidian";

import { normalizeSettings, type VaultMateSettings } from "./core/settings-model";
import { VaultMateSettingTab } from "./settings";
import { HUB_VIEW_TYPE, HubView } from "./ui/hub-view";
import { CAT_ICON_ID, CAT_ICON_SVG } from "./ui/icon";

export default class VaultMatePlugin extends Plugin {
	public settings: VaultMateSettings = normalizeSettings(undefined);

	public async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
		this.addSettingTab(new VaultMateSettingTab(this));
		addIcon(CAT_ICON_ID, CAT_ICON_SVG);
		this.registerView(HUB_VIEW_TYPE, (leaf) => new HubView(leaf));
		this.addRibbonIcon(CAT_ICON_ID, "Open VaultMate", () => void this.openHub());
		this.addCommand({
			id: "open-panel",
			name: "Open panel",
			icon: CAT_ICON_ID,
			callback: () => void this.openHub(),
		});
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	public onSettingsChanged(): void {
		// Nothing is cached yet; features read this.settings when they run.
	}

	private async openHub(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(HUB_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: HUB_VIEW_TYPE, active: true });
		}
		if (leaf) await workspace.revealLeaf(leaf);
	}
}
