// The related notes feature (the context finder). L5.A: the engine, the index and a temporary command;
// the hub page replaces the modal in L5.B.
//
// For other code: `plugin.context.related(file, limit)` returns `RelatedNote[]`, `plugin.context.building`
// is the build progress while the first query indexes the vault, and `plugin.context.stats` has the
// numbers for measuring (see `ContextStats`).
import { MarkdownView, Modal, type App, type TFile } from "obsidian";

import type VaultMatePlugin from "../../main";
import { createPanel, createSectionHeader } from "../../ui/components";
import { ContextIndex, type BuildProgress, type ContextStats } from "./context-index";
import type { RelatedNote } from "./engine";

export type { RelatedNote, RelatedReason, ReasonKind } from "./engine";
export type { BuildProgress, ContextStats } from "./context-index";

/** Default number of notes `related` returns. */
export const DEFAULT_RELATED_LIMIT = 8;

export class ContextFeature {
	private readonly index: ContextIndex;

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
		return this.index.related(file, limit);
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
				const file = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file;
				if (!file || !this.enabled()) return false;
				if (!checking) new RelatedModal(plugin.app, file, this).open();
				return true;
			},
		});
	}
}

/** Temporary list of the related notes of a note; click a note to open it. */
class RelatedModal extends Modal {
	public constructor(
		app: App,
		private readonly file: TFile,
		private readonly feature: ContextFeature,
	) {
		super(app);
		this.modalEl.addClass("vaultmate");
	}

	public onOpen(): void {
		const { contentEl } = this;
		createSectionHeader(contentEl, "Related notes");
		const body = contentEl.createDiv();
		body.createEl("p", { cls: "vaultmate-muted", text: "Looking for related notes. The first search indexes the vault and can take a few seconds." });
		void this.feature
			.related(this.file)
			.then((notes) => this.render(body, notes))
			.catch((error: unknown) => {
				body.empty();
				body.createEl("p", { cls: "vaultmate-muted", text: `Unable to find related notes: ${error instanceof Error ? error.message : String(error)}` });
			});
	}

	private render(body: HTMLElement, notes: RelatedNote[]): void {
		body.empty();
		if (notes.length === 0) {
			body.createEl("p", { cls: "vaultmate-muted", text: "No related notes found for this note." });
			return;
		}
		for (const note of notes) {
			const item = createPanel(body, "vaultmate-related-item");
			const title = item.createEl("a", { cls: "vaultmate-related-title", text: note.path.replace(/\.md$/, ""), attr: { href: "#" } });
			title.addEventListener("click", (event) => {
				event.preventDefault();
				this.close();
				void this.app.workspace.openLinkText(note.path, this.file.path);
			});
			const reasons = item.createEl("ul", { cls: "vaultmate-related-reasons" });
			for (const reason of note.reasons) reasons.createEl("li", { text: reason.text });
		}
	}

	public onClose(): void {
		this.contentEl.empty();
	}
}
