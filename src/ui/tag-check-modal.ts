// The first-run check of the idea and project tags: once per vault, after the metadata cache is ready, a
// small dialog tells the user what VaultMate will read when the vault already uses those tags a lot.
import { Notice, type App, type TFile } from "obsidian";

import { countTagUse, needsTagNotice, type CachedNote, type TagCheckCounts } from "../core/tag-check";
import { JournalModal } from "../features/journal/journal-modals";
import type VaultMatePlugin from "../main";
import { createSectionHeader } from "./components";

class TagCheckModal extends JournalModal {
	public constructor(
		app: App,
		private readonly counts: TagCheckCounts,
		private readonly tags: { idea: string; decision: string; prediction: string; project: string },
	) {
		super(app);
	}

	public onOpen(): void {
		const { contentEl, counts, tags } = this;
		const many = (count: number, one: string, other: string): string => `${count} ${count === 1 ? one : other}`;
		createSectionHeader(contentEl, "Tags VaultMate reads");
		contentEl.createEl("p", { text: "VaultMate looks for these tags in your vault. Check that they mean what you expect." });
		const list = contentEl.createEl("ul");
		if (counts.ideaLines !== null) list.createEl("li", { text: `Ideas: ${many(counts.ideaLines, "line", "lines")} tagged #${tags.idea} that ${counts.ideaLines === 1 ? "is" : "are"} not tasks. They appear as ideas to process.` });
		if (counts.decisionLines !== null) list.createEl("li", { text: `Decisions: ${many(counts.decisionLines, "line", "lines")} tagged #${tags.decision} that ${counts.decisionLines === 1 ? "is" : "are"} not tasks. ${counts.decisionLines === 1 ? "It appears" : "They appear"} under Not tracked yet in Reviews, ready to track.` });
		if (counts.predictionLines !== null) list.createEl("li", { text: `Predictions: ${many(counts.predictionLines, "line", "lines")} tagged #${tags.prediction} that ${counts.predictionLines === 1 ? "is" : "are"} not tasks. ${counts.predictionLines === 1 ? "It appears" : "They appear"} under Not tracked yet in Reviews, ready to track.` });
		if (counts.projectNotes !== null) list.createEl("li", { text: `Projects: ${many(counts.projectNotes, "note", "notes")} with #${tags.project} in the tags property. They appear on the Projects page.` });
		contentEl.createEl("p", { cls: "vaultmate-muted", text: "To use other tags, change the idea tag or the project tag in the VaultMate settings." });
		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		this.button(actions, "Keep these tags", true, () => this.close());
	}
}

/** Runs the check once per vault: the saved flag is set whatever the result. */
export async function runTagCheck(plugin: VaultMatePlugin): Promise<void> {
	const { app, settings } = plugin;
	if (settings.firstRun.tagCheckDone) return;
	const files = (): TFile[] => app.vault.getMarkdownFiles();
	// Wait until every note has a cache entry (the cache may still be filling when the layout is ready).
	if (files().some((file) => !app.metadataCache.getFileCache(file))) {
		const ref = app.metadataCache.on("resolved", () => {
			if (files().some((file) => !app.metadataCache.getFileCache(file))) return;
			app.metadataCache.offref(ref);
			void runTagCheck(plugin);
		});
		plugin.registerEvent(ref);
		return;
	}
	const counts = countTagUse(
		files().map((file) => app.metadataCache.getFileCache(file) as CachedNote | null),
		{ ideasOn: settings.ideas.enabled, ideaTag: settings.ideas.tag, journalOn: settings.journal.enabled, decisionTag: settings.journal.decisionTag, predictionTag: settings.journal.predictionTag, projectsOn: settings.projects.enabled, projectTag: settings.projects.tag },
	);
	settings.firstRun.tagCheckDone = true;
	try {
		await plugin.saveSettings();
	} catch {
		new Notice("VaultMate could not save its settings.");
	}
	if (needsTagNotice(counts)) new TagCheckModal(app, counts, { idea: settings.ideas.tag, decision: settings.journal.decisionTag, prediction: settings.journal.predictionTag, project: settings.projects.tag }).open();
}
