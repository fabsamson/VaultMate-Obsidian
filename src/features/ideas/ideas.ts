// The ideas feature: wires the idea index, the capture, the badge, the portal, Tend mode, the commands and the hub page.
import { debounce, MarkdownView, normalizePath, Notice, type Editor, type MarkdownFileInfo, type TFile } from "obsidian";
import type { EditorView } from "@codemirror/view";

import { formatDate, startOfDay } from "../../core/dates";
import type VaultMatePlugin from "../../main";
import { editorLines } from "../../core/note-edit";
import { openFileAtLine, openNoteAtLine, showLine } from "../../core/open-note";
import { IdeaCaptureSuggest, plantIdea } from "./capture-suggest";
import { returnToApp } from "../app-link/app-link";
import { wantsBack } from "../app-link/back-link";
import { createIdeaBadgeExtension } from "./idea-badge";
import { IdeaIndex } from "./idea-index";
import { noteCandidates, parseIdeaLink, resolveIdeaLine } from "./idea-link";
import { buildIdeaItem, canTrackAsIdea, type IdeaItem } from "./idea-line";
import { SPRITES } from "../../ui/sprites";
import { IdeaModal, noticeWithButton, type IdeaPortalHost } from "./idea-modal";
import { dropIdea, locateIdea, undoDrop } from "./idea-write";
import { createIdeasPage, IDEAS_PAGE_ID } from "./ideas-page";
import { isOpenIdea, tendQueue } from "./ideas-model";

export class IdeasFeature {
	public readonly index: IdeaIndex;

	public constructor(private readonly plugin: VaultMatePlugin) {
		this.index = new IdeaIndex(plugin);
	}

	public enabled(): boolean {
		return this.plugin.settings.ideas.enabled;
	}

	public tag(): string {
		return this.plugin.settings.ideas.tag;
	}

	/** The project seed sub-tag, without `#`; empty when seeds are off. */
	public seedSubtag(): string {
		return this.plugin.settings.ideas.seedSubtag;
	}

	/**
	 * Per note path, how many result sub-items (`Added to [[X]]`, `New note: [[X]]`, `Track in [[P]]: name`) point to each resolved
	 * target path. Those links only record where an idea went: the context finder does not count them as
	 * citations. Empty when the feature is off.
	 */
	public traceLinks(): Map<string, Map<string, number>> {
		const traces = new Map<string, Map<string, number>>();
		if (!this.enabled()) return traces;
		const { metadataCache } = this.plugin.app;
		for (const item of this.index.items()) {
			const target = item.resultTarget === null ? null : metadataCache.getFirstLinkpathDest(item.resultTarget, item.path);
			if (!target) continue;
			let counts = traces.get(item.path);
			if (!counts) traces.set(item.path, (counts = new Map<string, number>()));
			counts.set(target.path, (counts.get(target.path) ?? 0) + 1);
		}
		return traces;
	}

	/** Call from `onload`: registers the index events; the first pass waits for the layout. */
	public register(): void {
		this.index.registerEvents();
		this.plugin.registerEditorSuggest(new IdeaCaptureSuggest(this.plugin.app, this));
		this.plugin.registerEditorExtension(
			createIdeaBadgeExtension({
				enabled: () => this.enabled(),
				tag: () => this.tag(),
				activate: (view, line, action) => this.activateBadge(view, line, action),
			}),
		);
		this.registerPage();
		this.addCommands();
		this.plugin.registerObsidianProtocolHandler("vaultmate-idea", (params) => void this.onIdeaLink(params));
		this.plugin.app.workspace.onLayoutReady(() => void this.index.sync());
	}

	/** Call after a setting changed: the index follows the tag and the on/off switch. */
	public onSettingsChanged(): void {
		void this.index.sync();
		this.plugin.app.workspace.updateOptions();
	}

	// ---- Hub page -----------------------------------------------------------------------------------

	private registerPage(): void {
		const { plugin } = this;
		this.index.onChange(debounce(() => plugin.refreshHubs(), 300, true));
		plugin.registerHubPage(
			createIdeasPage({
				enabled: () => this.enabled(),
				tag: () => this.tag().replace(/^#/, ""),
				seedSubtag: () => this.seedSubtag(),
				items: () => this.index.items(),
				activeNote: () => plugin.contextFile()?.path ?? null,
				markdownPaths: () => plugin.app.vault.getMarkdownFiles().map((file) => file.path),
				openItem: (item) => this.portalHost().openAtLine(item.path, item.line),
				openTarget: (item) => this.openTarget(item),
				process: (item) => this.openPortal(item),
				drop: (item) => void this.dropWithUndo(item),
				tend: (items) => this.tend(items),
			}),
		);
	}

	// ---- Commands -----------------------------------------------------------------------------------

	private addCommands(): void {
		const { plugin } = this;
		plugin.addCommand({
			id: "track-idea",
			name: "Track this line as an idea",
			icon: "lightbulb",
			editorCheckCallback: (checking, editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				const lineNo = editor.getCursor().line;
				if (!ctx.file || !this.enabled() || !canTrackAsIdea(editor.getLine(lineNo), this.tag())) return false;
				if (!checking) plantIdea(editor, lineNo, this.tag());
				return true;
			},
		});
		plugin.addCommand({
			id: "process-idea",
			name: "Process idea on this line",
			icon: "lightbulb",
			editorCheckCallback: (checking, editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				const file = ctx.file;
				const item = file && this.enabled() ? this.itemAt(editor, file, editor.getCursor().line) : null;
				if (!item || !isOpenIdea(item.idea)) return false;
				if (!checking) this.openPortal(item);
				return true;
			},
		});
		plugin.addCommand({
			id: "tend-ideas",
			name: "Tend fresh ideas",
			icon: "lightbulb",
			checkCallback: (checking) => {
				if (!this.enabled()) return false;
				if (!checking) this.tend();
				return true;
			},
		});
		plugin.addCommand({
			id: "open-ideas",
			name: "Open ideas",
			icon: "lightbulb",
			checkCallback: (checking) => {
				if (!this.enabled()) return false;
				if (!checking) void plugin.openHub(IDEAS_PAGE_ID);
				return true;
			},
		});
	}

	// ---- Idea link ----------------------------------------------------------------------------------

	/** `obsidian://vaultmate-idea?file=&line=`: opens the note at the line, then the portal. Never writes. */
	private async onIdeaLink(params: Record<string, string | undefined>): Promise<void> {
		if (!this.enabled()) {
			new Notice("VaultMate ideas are turned off. Turn them on in the settings to use this link.");
			return;
		}
		const target = parseIdeaLink(params);
		if (!target) {
			new Notice("This idea link is not valid.");
			return;
		}
		const { vault } = this.plugin.app;
		let file: TFile | null = null;
		for (const path of noteCandidates(target.file)) file = file ?? vault.getFileByPath(normalizePath(path));
		if (!file) {
			new Notice("VaultMate could not find this note.");
			return;
		}
		const view = await openNoteAtLine(this.plugin.app, file, target.line);
		if (!view) return;
		const editor = view.editor;
		const lines = editorLines(editor);
		const last = Math.max(0, lines.length - 1);
		const wanted = Math.min(target.line, last);
		const found = resolveIdeaLine(lines, wanted, this.tag());
		const line = found.kind === "open" ? found.line : wanted;
		showLine(editor, line);
		if (found.kind === "processed") new Notice("This idea is already processed.");
		else if (found.kind === "none") new Notice("This idea is no longer on this line.");
		else {
			const item = this.itemAt(editor, file, line);
			if (item && isOpenIdea(item.idea)) this.openPortal(item, wantsBack(params) ? (result) => returnToApp("idea", result) : undefined);
			else new Notice("This idea is no longer on this line.");
		}
	}

	// ---- Portal and Tend mode -----------------------------------------------------------------------

	private portalHost(): IdeaPortalHost {
		const { plugin } = this;
		return {
			app: plugin.app,
			settings: plugin.settings,
			openAtLine: (path, line) => {
				const file = plugin.app.vault.getFileByPath(path);
				if (file) void openFileAtLine(plugin.app.workspace.getLeaf(false), file, line);
			},
			projectsEnabled: () => plugin.projects.enabled(),
			stampDone: () => plugin.stampMoment(SPRITES.stampDone),
			projectNotes: () => (plugin.projects.enabled() ? plugin.projects.index.notes().map((note) => ({ path: note.path, name: note.name })) : []),
			trackTitles: async (path) => (await plugin.projects.index.read(path))?.model.tracks.map((track) => track.title) ?? [],
		};
	}

	public openPortal(item: IdeaItem, onClosed?: (result: "done" | "cancel") => void): void {
		const modal = new IdeaModal(this.plugin.app, this.portalHost(), [item]);
		modal.onClosed = onClosed;
		modal.open();
	}

	/** Tend mode over `items`, else over every fresh idea of the vault, oldest first. */
	public tend(items: IdeaItem[] = tendQueue(this.index.items(), startOfDay(), { tag: this.tag().replace(/^#/, ""), subtag: this.seedSubtag() })): void {
		if (items.length === 0) {
			new Notice("No fresh ideas to tend.");
			return;
		}
		new IdeaModal(this.plugin.app, this.portalHost(), items, true).open();
	}

	/** Drops the idea without a note, then offers Undo for a few seconds. */
	private async dropWithUndo(item: IdeaItem): Promise<void> {
		const host = this.portalHost();
		const located = await locateIdea(host, item);
		if (!located) return;
		const closed = await dropIdea(host, located, "");
		if (closed === null) return;
		noticeWithButton("Idea dropped.", "Undo", () => {
			// The dropped line is now `closed`: find it again, then put the original back.
			void locateIdea(host, { ...located, raw: closed }).then((at) => (at ? undoDrop(host, { ...located, line: at.line }, closed) : false));
		});
	}

	private openTarget(item: IdeaItem): void {
		if (item.resultTarget !== null) void this.plugin.app.workspace.openLinkText(item.resultTarget, item.path);
	}

	// ---- Badge --------------------------------------------------------------------------------------

	/** The idea on a line of an editor, or null. */
	private itemAt(editor: Editor, file: TFile, line: number): IdeaItem | null {
		return buildIdeaItem(file.path, file.basename, formatDate(new Date(file.stat.ctime)), line, editorLines(editor), this.tag());
	}

	private activateBadge(view: EditorView, line: number, action: "portal" | "note"): void {
		const active = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const file = active?.file;
		if (!active || !file || active.editor.getLine(line) !== view.state.doc.line(line + 1).text) return;
		const item = this.itemAt(active.editor, file, line);
		if (!item) return;
		if (action === "note") this.openTarget(item);
		else if (isOpenIdea(item.idea)) this.openPortal(item);
	}
}
