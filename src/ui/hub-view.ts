import { ItemView, setIcon, type ViewStateResult, type WorkspaceLeaf } from "obsidian";

import type { JournalKind } from "../features/journal/journal-line";
import { SCOPES, type JournalScope } from "../features/journal/scope";
import { createIconButton, createInfoPanel, createSectionHeader } from "./components";
import { focusFromInput } from "./focus";
import { CAT_ICON_ID } from "./icon";
import { createSprite, type Sprite } from "./pixel";
import { SceneBanner } from "./scene-banner";
import { SPRITES } from "./sprites";

export const HUB_VIEW_TYPE = "vaultmate-hub";

/** What the hub asks of the page guides (the plugin owns the settings and the window). */
export interface HubGuides {
	/** Opens a guide with the "?" button. */
	open(id: string): void;
	/** The page showing guide `id` has drawn: opens it when it is the first visit (see `shouldAutoOpen`). `quiet`: the page was opened by the Weekly review. */
	visit(id: string, quiet: boolean): void;
}

/** Wait after a page has drawn before its guide opens by itself, so the page is seen first. */
const GUIDE_DELAY_MS = 500;

const BACK_TO_HUB = "Back to VaultMate";

/** What the hub remembers with the workspace layout (not in data.json). */
export interface HubState {
	/** Id of the open page, or null for the landing page. */
	page: string | null;
	/** Journal page: decisions or predictions. */
	kind: JournalKind;
	/** Journal page: which notes it covers. */
	scope: JournalScope;
	/** Journal page: whether the "Tidy up" section is open. */
	tidy: boolean;
	/** Projects page: path of the open project note, or null for the dashboard. */
	project: string | null;
}

export interface HubPageContext {
	/** The view's live state; change it, then call `save`. */
	state: HubState;
	/** Asks Obsidian to store the state with the workspace layout. */
	save(): void;
	/**
	 * Tells the hub that the page has a level above its current one: the back arrow then runs `up` and
	 * says `HubPage.upLabel`. Call it on every redraw of the page; null when the arrow leaves the page.
	 */
	setUp(up: (() => void) | null): void;
	/**
	 * Says which page guide the "?" button opens: the guide `id` (see `ui/guide/registry`), or null for none.
	 * Call it on every redraw, like `setUp`: a page with levels has one guide per level.
	 */
	setGuide(id: string | null): void;
}

/** A page of the hub that a feature contributes (register it with `plugin.registerHubPage`). */
export interface HubPage {
	/** Unique; registering the same id again replaces the page. */
	id: string;
	/** Tiles are shown in ascending order. */
	order: number;
	/** Tile label and page title, in sentence case. */
	title: string;
	sprite: Sprite;
	/** Checked on every redraw, so turning a feature off removes its tile without a reload. */
	enabled: () => boolean;
	/** One line under the tile label; read on every redraw. */
	summary: () => string;
	/** Back arrow label while the page has a level above (see `HubPageContext.setUp`), e.g. "Back to all projects". */
	upLabel?: string;
	/** Fills the empty `body` of the page; it may be async. */
	render: (body: HTMLElement, ctx: HubPageContext) => void | Promise<void>;
}

/** Side panel: a landing page of tiles, one per enabled feature, and a page for each. */
export class HubView extends ItemView {
	private state: HubState = { page: null, kind: "decision", scope: "vault", tidy: false, project: null };
	private banner: SceneBanner | null = null;
	/** What the back arrow does instead of going to the landing page; set by the open page. */
	private up: (() => void) | null = null;
	/** The page was opened quietly (Weekly review): its guide does not open by itself until the next navigation. */
	private quiet = false;
	private guideTimer: number | null = null;

	/** `animationsOn` and `bannerOn` are read at each redraw: the Animations setting with the system's reduced-motion preference, and the Scene banner setting. */
	public constructor(leaf: WorkspaceLeaf, private readonly getPages: () => HubPage[], private readonly animationsOn: () => boolean, private readonly bannerOn: () => boolean, private readonly guides: HubGuides) {
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

	public getState(): Record<string, unknown> {
		return { ...super.getState(), ...this.state };
	}

	public async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const saved = (state ?? {}) as Partial<HubState>;
		this.state = {
			page: typeof saved.page === "string" ? saved.page : null,
			kind: saved.kind === "prediction" ? "prediction" : "decision",
			scope: SCOPES.find((scope) => scope === saved.scope) ?? "vault",
			tidy: saved.tidy === true,
			project: typeof saved.project === "string" ? saved.project : null,
		};
		this.render();
		await super.setState(state, result);
	}

	protected onOpen(): Promise<void> {
		this.render();
		return Promise.resolve();
	}

	protected onClose(): Promise<void> {
		this.clearGuideTimer();
		this.banner?.destroy();
		this.banner = null;
		return Promise.resolve();
	}

	/** Whether the hub shows this page now. */
	public showsPage(id: string): boolean {
		return this.state.page === id;
	}

	/** Opens a page from code (a command); `project` is the project page the Projects page shows (null: the dashboard). */
	public showPage(id: string | null, project?: string | null, quiet = false): void {
		if (project !== undefined) this.state.project = project;
		this.go(id, quiet);
	}

	private go(page: string | null, quiet = false): void {
		this.quiet = quiet;
		const from = this.state.page;
		this.state.page = page;
		this.app.workspace.requestSaveLayout();
		this.render(page ?? from);
	}

	/**
	 * Redraws the current page. After a navigation `focus` names where keyboard focus goes: the page
	 * title when a page opened, the tile of the page left when going back.
	 */
	public render(focus: string | null = null): void {
		const root = this.contentEl;
		this.clearGuideTimer();
		this.banner?.destroy();
		this.banner = null;
		root.empty();
		root.addClass("vaultmate", "vaultmate-hub");
		root.createDiv({ cls: "vaultmate-pattern-band" }).setCssProps({ "--vaultmate-pattern": `url("${SPRITES.patternSeigaiha.src}")` });

		const pages = this.getPages().filter((page) => page.enabled());
		const page = pages.find((candidate) => candidate.id === this.state.page);
		if (page) this.renderPage(root, page, focus !== null);
		else this.renderLanding(root, pages, focus);
	}

	private clearGuideTimer(): void {
		if (this.guideTimer !== null) window.clearTimeout(this.guideTimer);
		this.guideTimer = null;
	}

	private renderLanding(root: HTMLElement, pages: HubPage[], focusId: string | null): void {
		if (this.bannerOn()) this.banner = new SceneBanner(root, { animate: this.animationsOn(), onSceneChange: () => this.render() });
		const bar = root.createDiv({ cls: "vaultmate-topbar" });
		bar.createEl("h1", { cls: "vaultmate-hub-title", text: "VaultMate" });
		this.guideSetter(bar)("home");
		if (pages.length === 0) {
			this.renderEmpty(root);
			return;
		}
		const tiles = root.createDiv({ cls: "vaultmate-tiles" });
		for (const page of pages) {
			const tile = tiles.createEl("button", { cls: "vaultmate-tile", attr: { type: "button" } });
			createSprite(tile, page.sprite, 48);
			const text = tile.createDiv({ cls: "vaultmate-tile-text" });
			text.createSpan({ cls: "vaultmate-tile-label", text: page.title });
			text.createSpan({ cls: "vaultmate-muted", text: page.summary() });
			tile.addEventListener("click", () => this.go(page.id));
			if (page.id === focusId) focusFromInput(tile);
		}
	}

	private renderPage(root: HTMLElement, page: HubPage, focusTitle: boolean): void {
		const bar = root.createDiv({ cls: "vaultmate-topbar" });
		const back = bar.createEl("button", { cls: "vaultmate-back", attr: { type: "button", "aria-label": BACK_TO_HUB } });
		setIcon(back, "arrow-left");
		this.up = null;
		back.addEventListener("click", () => (this.up ? this.up() : this.go(null)));
		const title = bar.createEl("h1", { cls: "vaultmate-hub-title", text: page.title, attr: { tabindex: "-1" } });
		if (focusTitle) focusFromInput(title);
		void this.fill(page, root.createDiv({ cls: "vaultmate-hub-section" }), back, bar);
	}

	/** The `setGuide` of a bar: its "?" button opens guide `id`, and the first visit opens it by itself. */
	private guideSetter(bar: HTMLElement): (id: string | null) => void {
		let help: { id: string; button: HTMLElement } | null = null;
		return (id) => {
			// A redraw that was overtaken by a newer one must not start a timer for its page.
			if (!bar.isConnected) return;
			this.clearGuideTimer();
			if (help?.id !== id) {
				help?.button.remove();
				help = id === null ? null : { id, button: createIconButton(bar, SPRITES.actionHelp, "How this page works", () => this.guides.open(id)) };
			}
			if (id === null) return;
			// Only a page the user can see: a hub in a collapsed side panel stays quiet.
			this.guideTimer = window.setTimeout(() => {
				this.guideTimer = null;
				if (this.contentEl.isShown()) this.guides.visit(id, this.quiet);
			}, GUIDE_DELAY_MS);
		};
	}

	private async fill(page: HubPage, body: HTMLElement, back: HTMLElement, bar: HTMLElement): Promise<void> {
		const setUp = (up: (() => void) | null): void => {
			this.up = up;
			back.setAttr("aria-label", up ? (page.upLabel ?? BACK_TO_HUB) : BACK_TO_HUB);
		};
		const setGuide = this.guideSetter(bar);
		try {
			await page.render(body, { state: this.state, save: () => this.app.workspace.requestSaveLayout(), setUp, setGuide });
		} catch (error) {
			console.error(`VaultMate: the "${page.id}" page failed`, error);
			body.empty();
			createInfoPanel(body, { sprite: SPRITES.mascotSleep, title: "This page could not be shown", compact: true });
		}
	}

	private renderEmpty(root: HTMLElement): void {
		createSectionHeader(root, "Today");
		createInfoPanel(root, { sprite: SPRITES.mascotTea, title: "Nothing to review yet", text: "Turn on a feature in the VaultMate settings." });
	}
}
