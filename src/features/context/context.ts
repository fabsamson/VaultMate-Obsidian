// The related notes feature (the context finder): the engine, the index, the hub page and its command.
//
// For other code: `plugin.context.related(file, limit)` returns `RelatedNote[]`, `plugin.context.building`
// is the build progress while the first query indexes the vault, and `plugin.context.stats` has the
// numbers for measuring (see `ContextStats`).
import { debounce, Keymap, MarkdownView, Notice, type Editor, type TFile } from "obsidian";

import type VaultMatePlugin from "../../main";
import { ContextIndex, type BuildProgress, type ContextStats } from "./context-index";
import { CONTEXT_PAGE_ID, createContextPage } from "./context-page";
import type { RelatedNote } from "./engine";

export type { RelatedNote, RelatedReason, ReasonKind } from "./engine";
export type { BuildProgress, ContextStats } from "./context-index";

/** Default number of notes `related` returns. */
export const DEFAULT_RELATED_LIMIT = 8;
/** Wait after the context note changed before redrawing the page. */
const REFRESH_DELAY_MS = 2000;

export class ContextFeature {
	private readonly index: ContextIndex;
	/** How many notes the last query found, for the tile of the hub. */
	private last: { path: string; count: number } | null = null;

	public constructor(private readonly plugin: VaultMatePlugin) {
		this.index = new ContextIndex(plugin);
	}

	public enabled(): boolean {
		return this.plugin.settings.context.enabled;
	}

	/** Progress of the index build, or null when idle. The first `related` call builds the index. */
	public get building(): BuildProgress | null {
		return this.index.building;
	}

	/** Build and query timings, for measurement. */
	public get stats(): ContextStats {
		return this.index.stats;
	}

	/**
	 * The notes most worth reading next to `file`, best first, each with its reasons. Empty when the
	 * feature is off or the file is not a Markdown note. The first call builds the text index
	 * (see `building`); later calls take a fraction of a second.
	 */
	public async related(file: TFile, limit = DEFAULT_RELATED_LIMIT): Promise<RelatedNote[]> {
		if (!this.enabled() || file.extension !== "md") return [];
		const found = await this.index.related(file, limit);
		this.last = { path: file.path, count: found.length };
		return found;
	}

	/** Call from `onload`. Nothing is built until the first query. */
	public register(): void {
		const { plugin } = this;
		this.index.registerEvents();
		plugin.addCommand({
			id: "show-related-notes",
			name: "Show related notes",
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
				related: (file) => this.related(file),
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
		// The page lists notes for the context note: redraw it, without disturbing the other pages, once that note changed.
		const refresh = debounce(() => plugin.refreshHubs(CONTEXT_PAGE_ID), REFRESH_DELAY_MS, true);
		plugin.registerEvent(
			plugin.app.metadataCache.on("changed", (file) => {
				if (this.enabled() && file.path === plugin.contextFile()?.path) refresh();
			}),
		);
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
