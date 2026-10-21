import { addIcon, debounce, MarkdownView, Plugin, type TFile, type WorkspaceLeaf } from "obsidian";

import { normalizeSettings, type VaultMateSettings } from "./core/settings-model";
import { AiActionsFeature } from "./features/ai-actions/ai-actions";
import { registerDailyLink } from "./features/app-link/app-link";
import { ContextFeature } from "./features/context/context";
import { IdeasFeature } from "./features/ideas/ideas";
import { JournalFeature } from "./features/journal/journal";
import { LocationFeature } from "./features/location/location";
import { ProjectsFeature } from "./features/projects/projects";
import { registerWeeklyReview } from "./features/weekly-review/weekly-command";
import { VaultMateSettingTab } from "./settings";
import { watchInput } from "./ui/focus";
import { runTagCheck } from "./ui/tag-check-modal";
import { GuideModal, type GuideHost } from "./ui/guide/guide-modal";
import { shouldAutoOpen, withSeen } from "./ui/guide/auto-open";
import { GUIDES } from "./ui/guide/registry";
import { HUB_VIEW_TYPE, HubView, type HubPage } from "./ui/hub-view";
import type { Sprite } from "./ui/pixel";
import { animationsOn } from "./ui/system-motion";
import { playStampMoment } from "./ui/stamp-moment";
import { CAT_ICON_ID, CAT_ICON_SVG } from "./ui/icon";

export default class VaultMatePlugin extends Plugin {
	public settings: VaultMateSettings = normalizeSettings(undefined);
	/** Public so the Projects page can show the open decisions and predictions written in a project. */
	public readonly journal = new JournalFeature(this);
	/** The idea index is public for live tests and for the coming pages: `app.plugins.plugins.vaultmate.ideas.index`. */
	public readonly ideas = new IdeasFeature(this);
	/** The project-note index is public like the idea index: `app.plugins.plugins.vaultmate.projects.index`. */
	public readonly projects = new ProjectsFeature(this);
	public readonly aiActions = new AiActionsFeature(this);
	private readonly location = new LocationFeature(this);
	/** New connections. Public: `app.plugins.plugins.vaultmate.context.connections(file)` for measuring and for the hub. */
	public readonly context = new ContextFeature(this);
	private readonly hubPages = new Map<string, HubPage>();

	public async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
		this.addSettingTab(new VaultMateSettingTab(this));
		watchInput(this);
		addIcon(CAT_ICON_ID, CAT_ICON_SVG);
		this.registerView(HUB_VIEW_TYPE, (leaf) => new HubView(leaf, () => this.sortedHubPages(), () => animationsOn(this.settings.ui.animations), () => this.settings.ui.banner, { open: (id) => this.openGuide(id), visit: (id, quiet) => this.visitGuide(id, quiet) }));
		this.addRibbonIcon(CAT_ICON_ID, "Open VaultMate", () => void this.openHub());
		this.addCommand({
			id: "open-panel",
			name: "Open panel",
			icon: CAT_ICON_ID,
			callback: () => void this.openHub(),
		});
		this.journal.register();
		this.ideas.register();
		this.projects.register();
		this.aiActions.register();
		this.location.register();
		registerDailyLink(this);
		this.context.register();
		registerWeeklyReview(this);
		this.app.workspace.onLayoutReady(() => void runTagCheck(this));
		// The pages name the note they work on, so redraw when another note opens.
		this.registerEvent(this.app.workspace.on("file-open", debounce(() => this.refreshHubs(), 300, true)));
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** data.json was changed outside Obsidian (Syncthing from another device): read it again and refresh what depends on it. */
	public async onExternalSettingsChange(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
		this.onSettingsChanged();
	}

	/**
	 * Called after a setting changed. Features read `this.settings` when they run, so the only thing
	 * left to refresh is what is already on screen.
	 */
	public onSettingsChanged(): void {
		this.journal.onSettingsChanged();
		this.ideas.onSettingsChanged();
		this.projects.onSettingsChanged();
		this.aiActions.onSettingsChanged();
		this.refreshHubs();
	}

	/** The stamp moment, centred over the window; nothing when animations are off or the system reduces motion. */
	public stampMoment(sprite: Sprite): void {
		if (animationsOn(this.settings.ui.animations)) playStampMoment(sprite);
	}

	/** Remembers a guide as seen, saving once. */
	private markGuideSeen(id: string): void {
		const seen = withSeen(this.settings.guides.seen, id);
		if (!seen) return;
		this.settings.guides.seen = seen;
		void this.saveSettings();
	}

	/** Opens a page guide (the sheet can move on to the other chapters) and remembers it as seen. */
	public openGuide(id: string): void {
		if (!GUIDES.has(id)) return;
		const host: GuideHost = {
			guide: (chapter) => GUIDES.get(chapter),
			markSeen: (chapter) => this.markGuideSeen(chapter),
			openPage: (chapter) => void this.openHub(chapter.pageId ?? undefined, chapter.id === "project" ? this.projects.index.notes()[0]?.path : undefined, true),
		};
		new GuideModal(this.app, id, id, animationsOn(this.settings.ui.animations), host).open();
	}

	/** A page with a guide has drawn: the guide opens by itself on the first visit. */
	private visitGuide(id: string, quiet: boolean): void {
		const { guides } = this.settings;
		const modalOpen = activeDocument.querySelector(".modal-container") !== null;
		if (shouldAutoOpen({ id, seen: guides.seen, autoOpen: guides.autoOpen, modalOpen, quiet })) this.openGuide(id);
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

	/**
	 * Opens the hub in the side panel, on the page `page` when given (and, on the Projects page, on the project `project`).
	 * `quiet`: the page guide does not open by itself (the Weekly review uses it).
	 */
	public async openHub(page?: string, project?: string, quiet = false): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(HUB_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: HUB_VIEW_TYPE, active: true });
		}
		if (!leaf) return;
		await workspace.revealLeaf(leaf);
		if (page !== undefined && leaf.view instanceof HubView) leaf.view.showPage(page, project, quiet);
	}
}
