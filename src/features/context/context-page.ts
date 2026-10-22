// The hub's "New connections" page: the notes not connected yet with the context note whose ideas could
// work with it, each with the words both use, where it is, a passage from both notes and the reasons.
import { setIcon, type TFile } from "obsidian";

import { createIconButton, createInfoPanel, createPanel } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
import { SPRITES } from "../../ui/sprites";
import { setQuickTooltip } from "../../ui/tooltip";
import type { BuildProgress, ContextStats } from "./context-index";
import { aboutParts, connectionsSummary, indexingLine, locationLine, noteTitle, REASON_ICONS, statsLine } from "./context-labels";
import type { Connection } from "./engine";
import { excerptParts, type Excerpt } from "./excerpt";

export const CONTEXT_PAGE_ID = "connections";

const PROGRESS_POLL_MS = 250;

export interface ContextPageHost {
	enabled(): boolean;
	/** The context note, or null. */
	file(): TFile | null;
	/** Progress of the first index build, or null. */
	building(): BuildProgress | null;
	/** Connections found for the context note last time, or null when not computed yet. */
	lastCount(file: TFile): number | null;
	connections(file: TFile): Promise<Connection[]>;
	/** The passages of the context note and of the connection around their shared words. */
	excerpts(file: TFile, connection: Connection): Promise<{ own: Excerpt; other: Excerpt }>;
	stats(): ContextStats;
	/** Opens the note; a Ctrl or Cmd click opens it in a new tab. */
	open(path: string, event: MouseEvent): void;
	/** Whether a link can be inserted now: the context note is open in an editor. */
	canInsert(file: TFile): boolean;
	insertLink(file: TFile, targetPath: string): void;
	copyLink(file: TFile, targetPath: string): void;
	/** Marks the pair as not useful (hidden for good, in both directions) and redraws the page. */
	dismiss(file: TFile, targetPath: string): void;
}

export function createContextPage(host: ContextPageHost): HubPage {
	return {
		id: CONTEXT_PAGE_ID,
		order: 40,
		title: "New connections",
		sprite: SPRITES.moduleContext,
		enabled: () => host.enabled(),
		summary: () => {
			const file = host.file();
			return connectionsSummary({ name: file?.basename ?? null, building: host.building(), count: file ? host.lastCount(file) : null });
		},
		render: async (body, ctx) => {
			ctx.setGuide("connections");
			const file = host.file();
			if (!file) {
				createInfoPanel(body, { sprite: SPRITES.mascotSleep, title: "Open a note first", compact: true });
				return;
			}
			body.createEl("p", { cls: "vaultmate-muted", text: `New connections for ${file.basename}` });
			const status = body.createDiv({ cls: "vaultmate-related-status", attr: { role: "status" } });
			const results = body.createDiv();

			const search = host.connections(file);
			const showProgress = (): void => {
				const progress = host.building();
				status.setText(progress ? indexingLine(progress) : "");
			};
			showProgress();
			const timer = body.win.setInterval(() => (body.isConnected ? showProgress() : body.win.clearInterval(timer)), PROGRESS_POLL_MS);
			let connections: Connection[];
			try {
				connections = await search;
			} finally {
				body.win.clearInterval(timer);
			}
			if (!body.isConnected) return; // the page was redrawn meanwhile
			status.empty();
			if (connections.length === 0) renderEmpty(results);
			else renderCards(results, host, file, connections);
			const stats = host.stats();
			if (stats.notesTotal > 0) body.createEl("p", { cls: "vaultmate-muted vaultmate-related-footer", text: statsLine(stats) });
		},
	};
}

function renderEmpty(parent: HTMLElement): void {
	createInfoPanel(parent, { sprite: SPRITES.mascotSleep, title: "No new connection for this note yet" });
}

/** The passage with its hits in emphasis, under a small label. */
function renderExcerpt(parent: HTMLElement, label: string, found: Excerpt): void {
	if (found.text === "") return;
	const block = parent.createEl("p", { cls: "vaultmate-related-excerpt" });
	block.createSpan({ cls: "vaultmate-related-excerpt-label", text: label });
	for (const part of excerptParts(found)) {
		if (part.hit) block.createEl("mark", { cls: "vaultmate-related-hit", text: part.text });
		else block.appendText(part.text);
	}
}

function renderCards(parent: HTMLElement, host: ContextPageHost, file: TFile, connections: Connection[]): void {
	const canInsert = host.canInsert(file);
	const list = parent.createEl("ul", { cls: "vaultmate-related-list" });
	for (const connection of connections) {
		const title = noteTitle(connection.path);
		const item = list.createEl("li");
		const card = createPanel(item, "vaultmate-related-card");
		const open = card.createEl("button", { cls: "vaultmate-related-title", text: title, attr: { type: "button" } });
		open.addEventListener("click", (event) => host.open(connection.path, event));

		const about = aboutParts(connection.terms);
		if (about.length > 0) {
			const line = card.createEl("p", { cls: "vaultmate-related-about" });
			for (const part of about) {
				if (part.term) line.createEl("em", { text: part.text });
				else line.appendText(part.text);
			}
		}
		card.createEl("p", { cls: "vaultmate-muted vaultmate-related-folder", text: locationLine(connection.path, file.path) });

		const excerpts = card.createDiv({ cls: "vaultmate-related-excerpts" });
		void host.excerpts(file, connection).then(
			({ own, other }) => {
				if (!excerpts.isConnected) return;
				renderExcerpt(excerpts, "This note", own);
				renderExcerpt(excerpts, title, other);
			},
			() => undefined, // a passage is a nicety: the card works without it
		);

		if (connection.reasons.length > 0) {
			const reasons = card.createEl("ul", { cls: "vaultmate-related-reasons" });
			for (const reason of connection.reasons) {
				const row = reasons.createEl("li");
				setIcon(row.createSpan({ cls: "vaultmate-related-icon", attr: { "aria-hidden": "true" } }), REASON_ICONS[reason.kind]);
				row.createSpan({ text: reason.text });
			}
		}

		const actions = card.createDiv({ cls: "vaultmate-related-actions vaultmate-icon-actions" });
		const insert = createIconButton(actions, SPRITES.actionLink, "Insert link", () => {
			if (canInsert) host.insertLink(file, connection.path);
		}, { describedBy: open });
		if (!canInsert) {
			// Not `disabled`, so that the tooltip and screen readers still reach the button.
			insert.setAttribute("aria-disabled", "true");
			setQuickTooltip(insert, "Insert link: open the note first");
		}
		createIconButton(actions, SPRITES.actionCopy, "Copy link", () => host.copyLink(file, connection.path), { describedBy: open });
		createIconButton(actions, SPRITES.actionDismiss, "Not useful: never propose this pair again", () => {
			item.remove();
			host.dismiss(file, connection.path);
		}, { describedBy: open });
	}
}
