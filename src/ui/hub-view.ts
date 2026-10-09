import { ItemView, setIcon, type ViewStateResult, type WorkspaceLeaf } from "obsidian";

import type { JournalKind } from "../features/journal/journal-line";
import { SCOPES, type JournalScope } from "../features/journal/scope";
import { createPanel, createSectionHeader } from "./components";
import { CAT_ICON_ID } from "./icon";
import { createSprite, type Sprite } from "./pixel";
import { SPRITES } from "./sprites";

export const HUB_VIEW_TYPE = "vaultmate-hub";

/** What the hub remembers with the workspace layout (not in data.json). */
export interface HubState {
	/** Id of the open page, or null for the landing page. */
	page: string | null;
	/** Journal page: decisions or predictions. */
	kind: JournalKind;
	/** Journal page: which notes it covers. */
	scope: JournalScope;
}

export interface HubPageContext {
	/** The view's live state; change it, then call `save`. */
	state: HubState;
	/** Asks Obsidian to store the state with the workspace layout. */
	save(): void;
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
	/** Fills the empty `body` of the page; it may be async. */
	render: (body: HTMLElement, ctx: HubPageContext) => void | Promise<void>;
}

/** Side panel: a landing page of tiles, one per enabled feature, and a page for each. */
export class HubView extends ItemView {
	private state: HubState = { page: null, kind: "decision", scope: "vault" };

	public constructor(leaf: WorkspaceLeaf, private readonly getPages: () => HubPage[]) {
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
		};
		this.render();
		await super.setState(state, result);
	}

	protected onOpen(): Promise<void> {
		this.render();
		return Promise.resolve();
	}

	/** Whether the hub shows this page now. */
	public showsPage(id: string): boolean {
		return this.state.page === id;
	}

	/** Opens a page from code (a command). */
	public showPage(id: string): void {
		this.go(id);
	}

	private go(page: string | null): void {
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
		root.empty();
		root.addClass("vaultmate", "vaultmate-hub");
		root.createDiv({ cls: "vaultmate-pattern-band" }).setCssProps({ "--vaultmate-pattern": `url("${SPRITES.patternSeigaiha.src}")` });

		const pages = this.getPages().filter((page) => page.enabled());
		const page = pages.find((candidate) => candidate.id === this.state.page);
		if (page) this.renderPage(root, page, focus !== null);
		else this.renderLanding(root, pages, focus);
	}

	private renderLanding(root: HTMLElement, pages: HubPage[], focusId: string | null): void {
		root.createEl("h1", { cls: "vaultmate-hub-title", text: "VaultMate" });
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
			if (page.id === focusId) tile.focus();
		}
	}

	private renderPage(root: HTMLElement, page: HubPage, focusTitle: boolean): void {
		const bar = root.createDiv({ cls: "vaultmate-topbar" });
		const back = bar.createEl("button", { cls: "vaultmate-back", attr: { type: "button", "aria-label": "Back to VaultMate" } });
		setIcon(back, "arrow-left");
		back.addEventListener("click", () => this.go(null));
		const title = bar.createEl("h1", { cls: "vaultmate-hub-title", text: page.title, attr: { tabindex: "-1" } });
		if (focusTitle) title.focus();
		void this.fill(page, root.createDiv({ cls: "vaultmate-hub-section" }));
	}

	private async fill(page: HubPage, body: HTMLElement): Promise<void> {
		try {
			await page.render(body, { state: this.state, save: () => this.app.workspace.requestSaveLayout() });
		} catch (error) {
			console.error(`VaultMate: the "${page.id}" page failed`, error);
			body.empty();
			body.createEl("p", { cls: "vaultmate-muted", text: "This page could not be shown." });
		}
	}

	private renderEmpty(root: HTMLElement): void {
		createSectionHeader(root, "Today");
		const panel = createPanel(root, "vaultmate-empty");
		createSprite(panel, SPRITES.mascotTea, 96);
		panel.createEl("p", { cls: "vaultmate-empty-title", text: "Nothing to review yet" });
		panel.createEl("p", { cls: "vaultmate-muted", text: "Turn on a feature in the VaultMate settings." });
	}
}
