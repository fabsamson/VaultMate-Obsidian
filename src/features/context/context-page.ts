// The hub's "Related notes" page: the notes most worth reading next to the context note, and why.
import { setIcon, setTooltip, type TFile } from "obsidian";

import { createPanel } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
import { createSprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import type { BuildProgress, ContextStats } from "./context-index";
import { indexingLine, noteFolder, noteTitle, REASON_ICONS, relatedSummary, statsLine } from "./context-labels";
import type { RelatedNote } from "./engine";

export const CONTEXT_PAGE_ID = "related";

const PROGRESS_POLL_MS = 250;

export interface ContextPageHost {
	enabled(): boolean;
	/** The context note, or null. */
	file(): TFile | null;
	/** Progress of the first index build, or null. */
	building(): BuildProgress | null;
	/** Related notes found for the context note last time, or null when not computed yet. */
	lastCount(file: TFile): number | null;
	related(file: TFile): Promise<RelatedNote[]>;
	stats(): ContextStats;
	/** Opens the note; a Ctrl or Cmd click opens it in a new tab. */
	open(path: string, event: MouseEvent): void;
	/** Whether a link can be inserted now: the context note is open in an editor. */
	canInsert(file: TFile): boolean;
	insertLink(file: TFile, targetPath: string): void;
	copyLink(file: TFile, targetPath: string): void;
}

export function createContextPage(host: ContextPageHost): HubPage {
	return {
		id: CONTEXT_PAGE_ID,
		order: 20,
		title: "Related notes",
		sprite: SPRITES.moduleContext,
		enabled: () => host.enabled(),
		summary: () => {
			const file = host.file();
			return relatedSummary({ name: file?.basename ?? null, building: host.building(), count: file ? host.lastCount(file) : null });
		},
		render: async (body) => {
			const file = host.file();
			if (!file) {
				body.createEl("p", { cls: "vaultmate-muted", text: "Open a note first." });
				return;
			}
			body.createEl("p", { cls: "vaultmate-muted", text: `Notes related to ${file.basename}` });
			const status = body.createDiv({ cls: "vaultmate-related-status", attr: { role: "status" } });
			const results = body.createDiv();

			const search = host.related(file);
			const showProgress = (): void => {
				const progress = host.building();
				status.setText(progress ? indexingLine(progress) : "");
			};
			showProgress();
			const timer = body.win.setInterval(() => (body.isConnected ? showProgress() : body.win.clearInterval(timer)), PROGRESS_POLL_MS);
			let notes: RelatedNote[];
			try {
				notes = await search;
			} finally {
				body.win.clearInterval(timer);
			}
			if (!body.isConnected) return; // the page was redrawn meanwhile
			status.empty();
			if (notes.length === 0) renderEmpty(results, file);
			else renderCards(results, host, file, notes);
			const stats = host.stats();
			if (stats.notesTotal > 0) body.createEl("p", { cls: "vaultmate-muted vaultmate-related-footer", text: statsLine(stats) });
		},
	};
}

function renderEmpty(parent: HTMLElement, file: TFile): void {
	const panel = createPanel(parent, "vaultmate-empty");
	createSprite(panel, SPRITES.mascotSleep, 96);
	panel.createEl("p", { cls: "vaultmate-empty-title", text: `No related notes found for ${file.basename}.` });
}

function renderCards(parent: HTMLElement, host: ContextPageHost, file: TFile, notes: RelatedNote[]): void {
	const canInsert = host.canInsert(file);
	const list = parent.createEl("ul", { cls: "vaultmate-related-list" });
	for (const note of notes) {
		const title = noteTitle(note.path);
		const card = createPanel(list.createEl("li"), "vaultmate-related-card");
		const open = card.createEl("button", { cls: "vaultmate-related-title", text: title, attr: { type: "button" } });
		open.addEventListener("click", (event) => host.open(note.path, event));
		const folder = noteFolder(note.path);
		if (folder) card.createEl("p", { cls: "vaultmate-muted vaultmate-related-folder", text: folder });

		const reasons = card.createEl("ul", { cls: "vaultmate-related-reasons" });
		for (const reason of note.reasons) {
			const item = reasons.createEl("li");
			setIcon(item.createSpan({ cls: "vaultmate-related-icon", attr: { "aria-hidden": "true" } }), REASON_ICONS[reason.kind]);
			item.createSpan({ text: reason.text });
		}

		const actions = card.createDiv({ cls: "vaultmate-related-actions" });
		const insert = actions.createEl("button", { cls: "vaultmate-button", text: "Insert link", attr: { type: "button", "aria-label": `Insert link to ${title}` } });
		if (canInsert) {
			insert.addEventListener("click", () => host.insertLink(file, note.path));
		} else {
			// Not `disabled`, so that the tooltip and screen readers still reach the button.
			insert.setAttribute("aria-disabled", "true");
			setTooltip(insert, "Open the note to insert a link");
		}
		const copy = actions.createEl("button", { cls: "vaultmate-button", text: "Copy link", attr: { type: "button", "aria-label": `Copy link to ${title}` } });
		copy.addEventListener("click", () => host.copyLink(file, note.path));
	}
}
