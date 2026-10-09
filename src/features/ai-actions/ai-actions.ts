// The AI actions feature: wires the catalogue, the hub page, the commands and the run window.
import { MarkdownView, Notice, type Editor, type TFile } from "obsidian";

import { configurationProblem } from "../../core/ai/client";
import type VaultMatePlugin from "../../main";
import { createAiPage } from "./ai-page";
import { ActionCatalogue } from "./catalogue";
import { CatalogueModal } from "./catalogue-modal";
import type { ActionDefinition } from "./definition";
import { RunModal, type RunContext } from "./run-modal";

export class AiActionsFeature {
	private readonly catalogue: ActionCatalogue;

	public constructor(private readonly plugin: VaultMatePlugin) {
		this.catalogue = new ActionCatalogue(plugin, (action) => void this.run(action));
	}

	public enabled(): boolean {
		return this.plugin.settings.ai.enabled;
	}

	/** Call from `onload`. The only startup work is listing the action files, once the layout is ready. */
	public register(): void {
		const { plugin } = this;
		plugin.addCommand({
			id: "open-ai-actions",
			name: "Open AI actions",
			icon: "sparkles",
			checkCallback: (checking) => {
				if (!this.enabled()) return false;
				if (!checking) new CatalogueModal(plugin.app, this.catalogue.entries(), (action) => void this.run(action)).open();
				return true;
			},
		});
		plugin.registerHubPage(
			createAiPage({
				enabled: () => this.enabled(),
				entries: () => this.catalogue.entries(),
				folder: () => this.catalogue.folder(),
				contextName: () => plugin.contextFile()?.basename ?? null,
				configurationProblem: () => configurationProblem(plugin.app, plugin.settings.ai),
				run: (action) => void this.run(action),
			}),
		);
		this.catalogue.onChange(() => plugin.refreshHubs());
		plugin.app.workspace.onLayoutReady(() => {
			this.catalogue.registerEvents();
			void this.catalogue.reload();
		});
	}

	/** Call after a setting changed: the folder or the on/off switch may have changed. */
	public onSettingsChanged(): void {
		void this.catalogue.reload();
	}

	// ---- Running ------------------------------------------------------------------------------------

	private editorOf(path: string): Editor | null {
		for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) return leaf.view.editor;
		}
		return null;
	}

	/** Reads the note and the selection now: this is what the preview shows and what is sent. */
	private async readContext(file: TFile): Promise<RunContext> {
		const { vault, metadataCache } = this.plugin.app;
		const editor = this.editorOf(file.path);
		return {
			path: file.path,
			title: file.basename,
			raw: editor ? editor.getValue() : await vault.read(file),
			selection: editor ? editor.getSelection() : "",
			frontmatter: metadataCache.getFileCache(file)?.frontmatter,
		};
	}

	public async run(action: ActionDefinition): Promise<void> {
		const file = this.plugin.contextFile();
		if (!file) {
			new Notice("Open a note first.");
			return;
		}
		new RunModal(this.plugin.app, this.plugin, action, await this.readContext(file)).open();
	}
}
