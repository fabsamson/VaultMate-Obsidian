import { addIcon, debounce, MarkdownView, Plugin, type TFile, type WorkspaceLeaf } from "obsidian";

import { normalizeSettings, type VaultMateSettings } from "./core/settings-model";
import { AiActionsFeature } from "./features/ai-actions/ai-actions";
import { ContextFeature } from "./features/context/context";
import { JournalFeature } from "./features/journal/journal";
import { LocationFeature } from "./features/location/location";
import { VaultMateSettingTab } from "./settings";
import { HUB_VIEW_TYPE, HubView, type HubPage } from "./ui/hub-view";
import { CAT_ICON_ID, CAT_ICON_SVG } from "./ui/icon";

export default class VaultMatePlugin extends Plugin {
	public settings: VaultMateSettings = normalizeSettings(undefined);
	private readonly journal = new JournalFeature(this);
	private readonly aiActions = new AiActionsFeature(this);
	private readonly location = new LocationFeature(this);
	/** New connections (the Related notes page). Public: `app.plugins.plugins.vaultmate.context.connections(file)` for measuring and for the hub. */
	public readonly context = new ContextFeature(this);
	private readonly hubPages = new Map<string, HubPage>();

	public async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
		this.addSettingTab(new VaultMateSettingTab(this));
		addIcon(CAT_ICON_ID, CAT_ICON_SVG);
		this.registerView(HUB_VIEW_TYPE, (leaf) => new HubView(leaf, () => this.sortedHubPages()));
		this.addRibbonIcon(CAT_ICON_ID, "Open VaultMate", () => void this.openHub());
		this.addCommand({
			id: "open-panel",
			name: "Open panel",
			icon: CAT_ICON_ID,
			callback: () => void this.openHub(),
		});
		this.journal.register();
		this.aiActions.register();
		this.location.register();
		this.context.register();
		// The pages name the note they work on, so redraw when another note opens.
		this.registerEvent(this.app.workspace.on("file-open", debounce(() => this.refreshHubs(), 300, true)));
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
		this.aiActions.onSettingsChanged();
		this.refreshHubs();
	}

	/** Adds or replaces (same `id`) a page of the hub, then redraws the open hubs. */
	public registerHubPage(page: HubPage): void {
		this.hubPages.set(page.id, page);
		this.refreshHubs();
	}

	/** Redraws every open hub, or only the hubs showing page `onlyPage`; call it when the data behind a page changed. */
	public refreshHubs(onlyPage?: string): void {
		for (const leaf of this.app.workspace.getLeavesOfType(HUB_VIEW_TYPE)) {
			if (leaf.view instanceof HubView && (onlyPage === undefined || leaf.view.showsPage(onlyPage))) leaf.view.render();
		}
	}

	private sortedHubPages(): HubPage[] {
		return [...this.hubPages.values()].sort((a, b) => a.order - b.order);
	}

	/** The active Markdown note, else the most recent one, or null. */
	public contextFile(): TFile | null {
		const { workspace, vault } = this.app;
		const active = workspace.getActiveViewOfType(MarkdownView)?.file ?? workspace.getActiveFile();
		if (active?.extension === "md") return active;
		for (const path of workspace.getLastOpenFiles()) {
			const file = vault.getFileByPath(path);
			if (file?.extension === "md") return file;
		}
		return null;
	}

	/** Opens the hub in the side panel, on the page `page` when given. */
	public async openHub(page?: string): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(HUB_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: HUB_VIEW_TYPE, active: true });
		}
		if (!leaf) return;
		await workspace.revealLeaf(leaf);
		if (page !== undefined && leaf.view instanceof HubView) leaf.view.showPage(page);
	}
}
