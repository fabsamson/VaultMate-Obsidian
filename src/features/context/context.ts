// The new connections feature (the connections finder): the engine, the index, the hub page and its command.
//
// For other code: `plugin.context.connections(file, limit)` returns `Connection[]`, `plugin.context.building`
// is the build progress while the first query indexes the vault, and `plugin.context.stats` has the
// numbers for measuring (see `ContextStats`).
import { debounce, Keymap, MarkdownView, Notice, type Editor, type TFile } from "obsidian";

import type VaultMatePlugin from "../../main";
import { ContextIndex, type BuildProgress, type ContextStats } from "./context-index";
import { CONTEXT_PAGE_ID, createContextPage } from "./context-page";
import { addPair, hasPair, removePair, renamePath } from "./dismissed";
import type { Connection } from "./engine";
import { excerpt, type Excerpt } from "./excerpt";
import { noteTitle } from "./context-labels";

export type { Connection, ConnectionReason, ReasonKind } from "./engine";
export type { BuildProgress, ContextStats } from "./context-index";

/** Wait after the context note changed before redrawing the page. */
const REFRESH_DELAY_MS = 2000;

export class ContextFeature {
	private readonly index: ContextIndex;
	/** How many connections the last query found, for the tile of the hub. */
	private last: { path: string; count: number } | null = null;

	public constructor(private readonly plugin: VaultMatePlugin) {
		this.index = new ContextIndex(plugin);
	}

	public enabled(): boolean {
		return this.plugin.settings.context.enabled;
	}

	/** Progress of the index build, or null when idle. The first `connections` call builds the index. */
	public get building(): BuildProgress | null {
		return this.index.building;
	}

	/** Build and query timings, for measurement. */
	public get stats(): ContextStats {
		return this.index.stats;
	}

	/**
	 * The notes not connected with `file` yet whose ideas could work with it (at most three), best first,
	 * each with its shared terms and reasons. Empty when nothing new was found, the feature is off or the
	 * file is not a Markdown note. The first call builds the text index
	 * (see `building`); later calls take a fraction of a second.
	 */
	public async connections(file: TFile, limit = this.plugin.settings.context.maxConnections): Promise<Connection[]> {
		if (!this.enabled() || file.extension !== "md") return [];
		const pairs = this.plugin.settings.contextState.notUseful;
		const found = await this.index.connections(file, limit, (path) => hasPair(pairs, file.path, path));
		this.last = { path: file.path, count: found.length };
		return found;
	}

	/** Call from `onload`. Nothing is built until the first query. */
	public register(): void {
		const { plugin } = this;
		this.index.registerEvents();
		plugin.addCommand({
			id: "show-new-connections",
			name: "Show new connections",
			icon: "link-2",
			checkCallback: (checking) => {
				if (!this.enabled()) return false;
				if (!checking) void plugin.openHub(CONTEXT_PAGE_ID);
				return true;
			},
		});
		plugin.registerHubPage(
			createContextPage({
				enabled: () => this.enabled(),
				file: () => plugin.contextFile(),
				building: () => this.building,
				lastCount: (file) => (this.last?.path === file.path ? this.last.count : null),
				connections: (file) => this.connections(file),
				excerpts: (file, connection) => this.excerpts(file, connection),
				dismiss: (file, path) => void this.dismiss(file, path),
				stats: () => this.stats,
				open: (path, event) => {
					const target = plugin.app.vault.getFileByPath(path);
					if (target) void plugin.app.workspace.getLeaf(Keymap.isModEvent(event)).openFile(target);
				},
				canInsert: (file) => this.editorOf(file) !== null,
				insertLink: (file, path) => {
					const editor = this.editorOf(file);
					const link = this.linkTo(file, path);
					if (editor && link) editor.replaceSelection(link);
					else new Notice("Open the note to insert a link.");
				},
				copyLink: (file, path) => {
					const link = this.linkTo(file, path);
					if (!link) return;
					plugin.app.workspace.containerEl.win.navigator.clipboard.writeText(link).then(
						() => new Notice("Link copied."),
						() => new Notice("Unable to copy the link."),
					);
				},
			}),
		);
		// A renamed note keeps the pairs marked not useful.
		plugin.registerEvent(
			plugin.app.vault.on("rename", (file, oldPath) => {
				const { contextState } = plugin.settings;
				if (!contextState.notUseful.some((pair) => pair.includes(oldPath))) return;
				contextState.notUseful = renamePath(contextState.notUseful, oldPath, file.path);
				void plugin.saveSettings();
			}),
		);
		// The page lists notes for the context note: redraw it, without disturbing the other pages, once that note changed.
		const refresh = debounce(() => plugin.refreshHubs(CONTEXT_PAGE_ID), REFRESH_DELAY_MS, true);
		plugin.registerEvent(
			plugin.app.metadataCache.on("changed", (file) => {
				if (this.enabled() && file.path === plugin.contextFile()?.path) refresh();
			}),
		);
	}

	/** The passages of the context note and of the connection around their shared words and names. */
	private async excerpts(file: TFile, connection: Connection): Promise<{ own: Excerpt; other: Excerpt }> {
		const { vault } = this.plugin.app;
		const target = vault.getFileByPath(connection.path);
		const ownText = await vault.cachedRead(file);
		const otherText = target ? await vault.cachedRead(target) : "";
		return {
			own: excerpt(ownText, connection.terms, [noteTitle(connection.path)]),
			other: excerpt(otherText, connection.terms, [file.basename]),
		};
	}

	/** Hides the pair for good, in both directions, and offers to undo. */
	private async dismiss(file: TFile, targetPath: string): Promise<void> {
		const { plugin } = this;
		const { contextState } = plugin.settings;
		contextState.notUseful = addPair(contextState.notUseful, file.path, targetPath);
		await plugin.saveSettings();
		const notice = new Notice(
			createFragment((fragment) => {
				fragment.createSpan({ text: "Marked as not useful. " });
				fragment.createEl("button", { text: "Undo" }).addEventListener("click", () => {
					plugin.settings.contextState.notUseful = removePair(plugin.settings.contextState.notUseful, file.path, targetPath);
					void plugin.saveSettings();
					plugin.refreshHubs(CONTEXT_PAGE_ID);
					notice.hide();
				});
			}),
			8000,
		);
		plugin.refreshHubs(CONTEXT_PAGE_ID);
	}

	/** The editor (source mode) showing `file`, or null. The hub has focus, so the active editor is not the place to look. */
	private editorOf(file: TFile): Editor | null {
		for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
			const { view } = leaf;
			if (view instanceof MarkdownView && view.file?.path === file.path && view.getMode() === "source") return view.editor;
		}
		return null;
	}

	private linkTo(source: TFile, targetPath: string): string | null {
		const target = this.plugin.app.vault.getFileByPath(targetPath);
		return target ? this.plugin.app.fileManager.generateMarkdownLink(target, source.path) : null;
	}
}
