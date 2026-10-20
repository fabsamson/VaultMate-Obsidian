// The decision journal feature: wires the index, capture, badge, review and hub page together.
import { debounce, MarkdownView, normalizePath, Notice, TFile, type Editor, type MarkdownFileInfo } from "obsidian";
import type { EditorView } from "@codemirror/view";

import { formatDate, startOfDay } from "../../core/dates";
import { editorLines } from "../../core/note-edit";
import { openFileAtLine, openNoteAtLine, showLine } from "../../core/open-note";
import { getDescription, getInlineField, parseTaskLine } from "../../core/task-line";
import type VaultMatePlugin from "../../main";
import { SPRITES } from "../../ui/sprites";
import { returnToApp } from "../app-link/app-link";
import { wantsBack } from "../app-link/back-link";
import { CaptureSuggest } from "./capture-suggest";
import { noticeWithButton } from "../ideas/idea-modal";
import { noteCandidates, parseIdeaLink } from "../ideas/idea-link";
import { JournalIndex, type JournalItem } from "./journal-index";
import {
	addOutcome,
	classifyLine,
	closeEntry,
	convertToEntry,
	countDue,
	canTrackAs,
	dueFrom,
	kindName,
	markNotReviewable,
	parseConfidence,
	reviewAgain,
	type JournalKind,
	type JournalTags,
} from "./journal-line";
import { NewEntryModal, ReviewModal, TrackModal, type ReviewInput } from "./journal-modals";
import { getChildren, isEmptyLine, newEntryLines, replaceEmptyLineText, reviewItemText, usesTabs } from "./journal-note";
import { writeEntryLine } from "./journal-write";
import { resolveReviewLine } from "./review-link";
import { createBadgeExtension } from "./line-badge";
import { createJournalPage } from "./journal-page";

/** Per-device storage key of the day of the last "reviews due" notice. */
const NOTICE_DATE_KEY = "vaultmate-last-notice-date";

export class JournalFeature {
	public readonly index: JournalIndex;

	public constructor(private readonly plugin: VaultMatePlugin) {
		this.index = new JournalIndex(plugin);
	}

	public enabled(): boolean {
		return this.plugin.settings.journal.enabled;
	}

	public tags(): JournalTags {
		return this.plugin.settings.journal;
	}

	/** Call from `onload`: registers everything; heavy work waits for the layout. */
	public register(): void {
		const { plugin } = this;
		this.index.registerEvents();
		const refresh = debounce(() => plugin.refreshHubs(), 300, true);
		this.index.onChange(refresh);

		plugin.registerHubPage(
			createJournalPage({
				enabled: () => this.enabled(),
				entries: () => this.index.entries(),
				decisionTag: () => this.tags().decisionTag,
				activeNote: () => plugin.contextFile()?.path ?? null,
				markdownPaths: () => plugin.app.vault.getMarkdownFiles().map((file) => file.path),
				openItem: (item) => void this.openAtLine(item),
				openReview: (item) => this.openReview(item),
				addOutcome: (item) => this.openLateReview(item),
				notReviewable: (item) => void this.markNotReviewable(item),
				track: (item) => this.trackLine(item.path, item.line, item.raw, item.entry.kind),
			}),
		);
		plugin.registerEditorSuggest(new CaptureSuggest(plugin.app, this));
		plugin.registerEditorExtension(
			createBadgeExtension({
				enabled: () => this.enabled(),
				tags: () => this.tags(),
				activate: (view, line, action) => this.activateBadge(view, line, action),
			}),
		);
		this.addCommands();
		plugin.registerObsidianProtocolHandler("vaultmate-review", (params) => void this.onReviewLink(params));

		// The due groups depend on today's date: redraw when the day changes.
		let day = formatDate(startOfDay());
		plugin.registerInterval(
			window.setInterval(() => {
				const now = formatDate(startOfDay());
				if (now === day) return;
				day = now;
				plugin.refreshHubs();
			}, 60_000),
		);

		plugin.app.workspace.onLayoutReady(() => void this.index.sync().then(() => this.showDailyNotice()));
	}

	/** Call after a setting changed: the index follows the tag names and the on/off switch. */
	public onSettingsChanged(): void {
		void this.index.sync();
		this.plugin.app.workspace.updateOptions();
	}

	// ---- Commands -----------------------------------------------------------------------------------

	private addCommands(): void {
		const { plugin } = this;
		const editorCommand = (id: string, name: string, icon: string, available: (editor: Editor) => boolean, run: (editor: Editor, path: string) => void): void => {
			plugin.addCommand({
				id,
				name,
				icon,
				editorCheckCallback: (checking, editor, ctx: MarkdownView | MarkdownFileInfo) => {
					const path = ctx.file?.path;
					if (!path || !this.enabled() || !available(editor)) return false;
					if (!checking) run(editor, path);
					return true;
				},
			});
		};

		for (const kind of ["decision", "prediction"] as const) {
			const icon = kind === "decision" ? "scale" : "dices";
			editorCommand(`new-${kind}`, `New ${kind}`, icon, () => true, (editor) => this.openNewEntry(editor, kind));
			editorCommand(
				`track-${kind}`,
				`Track this line as a ${kind}`,
				icon,
				(editor) => this.canTrack(editor, kind),
				(editor, path) => this.openTrack(editor, path, editor.getCursor().line, kind),
			);
		}
		editorCommand(
			"review-line",
			"Review this line",
			"clipboard-check",
			(editor) => this.openEntryAt(editor, "") !== null,
			(editor, path) => {
				const item = this.openEntryAt(editor, path);
				if (item) this.openReview(item);
			},
		);
	}

	private canTrack(editor: Editor, kind: JournalKind): boolean {
		return canTrackAs(editor.getLine(editor.getCursor().line), kind, this.tags());
	}

	/** The entry on a line of the editor (cursor line by default), or null. */
	private entryAt(editor: Editor, path: string, lineNo = editor.getCursor().line): JournalItem | null {
		const raw = editor.getLine(lineNo);
		const cls = classifyLine(raw, this.tags());
		if (cls?.type !== "entry") return null;
		return { path, line: lineNo, raw, entry: cls.entry, children: getChildren(editorLines(editor), lineNo).items };
	}

	/** The open entry under the cursor, read from the editor, or null. */
	private openEntryAt(editor: Editor, path: string, lineNo = editor.getCursor().line): JournalItem | null {
		const item = this.entryAt(editor, path, lineNo);
		return item?.entry.status === "open" ? item : null;
	}

	// ---- New entry ----------------------------------------------------------------------------------

	private openNewEntry(editor: Editor, kind: JournalKind): void {
		new NewEntryModal(this.plugin.app, kind, (result) => {
			const today = startOfDay();
			const lineNo = editor.getCursor().line;
			const current = editor.getLine(lineNo);
			const lines = newEntryLines({
				kind,
				tags: this.tags(),
				today: formatDate(today),
				due: dueFrom(today, result.interval),
				confidence: result.confidence,
				answer: result.answer,
				statement: result.statement,
				extras: result.extras,
				currentLine: current,
				tabs: usesTabs(editorLines(editor)),
			});
			if (isEmptyLine(current)) {
				const next = lineNo + 1 < editor.lineCount() ? editor.getLine(lineNo + 1) : null;
				editor.replaceRange(replaceEmptyLineText(current, next, lines), { line: lineNo, ch: 0 }, { line: lineNo, ch: current.length });
			} else editor.replaceRange(`\n${lines.join("\n")}`, { line: lineNo, ch: current.length });
			new Notice(`${kind === "decision" ? "Decision" : "Prediction"} added.`);
		}).open();
	}

	// ---- Track a line -------------------------------------------------------------------------------

	private openTrack(editor: Editor, path: string, lineNo: number, kind: JournalKind): void {
		this.trackLine(path, lineNo, editor.getLine(lineNo), kind);
	}

	/** The track form for the line `raw` (as read at `lineNo` of `path`); the write checks the line is unchanged. */
	private trackLine(path: string, lineNo: number, raw: string, kind: JournalKind): void {
		const cls = classifyLine(raw, this.tags());
		const statement = cls ? (cls.type === "entry" ? cls.entry.statement : cls.statement) : getDescription(parseTaskLine(raw).body);
		const confidence = cls?.type === "entry" ? cls.entry.confidence : parseConfidence(getInlineField(parseTaskLine(raw).body, "confidence"));
		const answer = getInlineField(parseTaskLine(raw).body, "answer") || null;
		new TrackModal(this.plugin.app, kind, statement, answer, confidence, (result) => {
			const today = startOfDay();
			const line = convertToEntry(raw, { kind, tags: this.tags(), today: formatDate(today), due: dueFrom(today, result.interval), answer: result.answer, confidence: result.confidence });
			void writeEntryLine(this.plugin.app, { path, line: lineNo, raw }, line, null).then((written) => {
				if (written) new Notice(`Tracking as ${kindName(kind)}.`);
			});
		}).open();
	}

	// ---- Review -------------------------------------------------------------------------------------

	public openReview(item: JournalItem, onClosed?: (result: "done" | "cancel") => void): void {
		const modal = new ReviewModal(this.plugin.app, item, (input) => this.applyReview(item, input));
		modal.onClosed = onClosed;
		modal.open();
	}

	/** The review form for an entry ticked without a review: it only adds what is missing. */
	public openLateReview(item: JournalItem, onClosed?: (result: "done" | "cancel") => void): void {
		const modal = new ReviewModal(this.plugin.app, item, (input) => this.applyReview(item, input, true), true);
		modal.onClosed = onClosed;
		modal.open();
	}

	/** Turns the entry's `[x]` into `[-]`, so it leaves the list and the statistics; the notice offers to undo. */
	private async markNotReviewable(item: JournalItem): Promise<void> {
		const line = markNotReviewable(item.raw);
		if (!(await writeEntryLine(this.plugin.app, item, line, null))) return;
		noticeWithButton("Marked as not reviewable.", "Undo", () => void writeEntryLine(this.plugin.app, { path: item.path, line: item.line, raw: line }, item.raw, null));
	}

	private async applyReview(item: JournalItem, input: ReviewInput, late = false): Promise<boolean> {
		const today = startOfDay();
		const todayText = formatDate(today);
		let line: string;
		let done: string;
		const close = late ? addOutcome : closeEntry;
		if (input.type === "close-decision") {
			line = close(item.raw, { kind: "decision", outcome: input.outcome, quality: input.quality, today: todayText });
			done = late ? "Outcome added." : "Decision closed.";
		} else if (input.type === "close-prediction") {
			line = close(item.raw, { kind: "prediction", result: input.result, today: todayText });
			done = late ? "Outcome added." : "Prediction closed.";
		} else {
			const due = dueFrom(today, input.interval);
			line = reviewAgain(item.raw, due);
			done = `Review date moved to ${due}.`;
		}
		const written = await writeEntryLine(this.plugin.app, item, line, reviewItemText(todayText, input.happened, input.lesson));
		if (written) {
			new Notice(done);
			if (input.type !== "again") this.plugin.stampMoment(SPRITES.stampReview);
		}
		return written;
	}

	// ---- Review link --------------------------------------------------------------------------------

	/**
	 * `obsidian://vaultmate-review?file=&line=` (from the Android app): opens the note at the entry, then its
	 * review form, or "Add the outcome" for an entry ticked without a review. Never writes by itself.
	 */
	private async onReviewLink(params: Record<string, string | undefined>): Promise<void> {
		if (!this.enabled()) {
			new Notice("VaultMate decisions and predictions are turned off. Turn them on in the settings to use this link.");
			return;
		}
		const target = parseIdeaLink(params);
		if (!target) {
			new Notice("This review link is not valid.");
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
		const { editor } = view;
		const lines = editorLines(editor);
		const wanted = Math.min(target.line, Math.max(0, lines.length - 1));
		const found = resolveReviewLine(lines, wanted, this.tags());
		showLine(editor, found.kind === "open" || found.kind === "late" ? found.line : wanted);
		if (found.kind === "reviewed") {
			new Notice("This entry is already reviewed or cancelled.");
		} else if (found.kind === "none") {
			new Notice("No decision or prediction to review on this line.");
		} else {
			const item = this.entryAt(editor, file.path, found.line);
			if (!item) new Notice("No decision or prediction to review on this line.");
			else {
				const onClosed = wantsBack(params) ? (result: "done" | "cancel") => returnToApp("review", result) : undefined;
				if (found.kind === "open") this.openReview(item, onClosed);
				else this.openLateReview(item, onClosed);
			}
		}
	}

	// ---- Badge, hub ---------------------------------------------------------------------------------

	private activateBadge(view: EditorView, line: number, action: "review" | "track"): void {
		const active = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const path = active?.file?.path;
		if (!active || !path || active.editor.getLine(line) !== view.state.doc.line(line + 1).text) return;
		const cls = classifyLine(active.editor.getLine(line), this.tags());
		if (!cls) return;
		if (action === "review") {
			const item = this.openEntryAt(active.editor, path, line);
			if (item) this.openReview(item);
		} else {
			this.openTrack(active.editor, path, line, cls.type === "entry" ? cls.entry.kind : cls.kind);
		}
	}

	private async openAtLine(item: JournalItem): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(item.path);
		if (file instanceof TFile) await openFileAtLine(this.plugin.app.workspace.getLeaf(false), file, item.line);
	}

	/** Once a day at most: "VaultMate: 2 reviews due". The day is kept on this device, not in data.json, which every device shares; it is stored only when the notice shows. */
	private showDailyNotice(): void {
		const today = startOfDay();
		const todayText = formatDate(today);
		if (!this.enabled() || this.plugin.app.loadLocalStorage(NOTICE_DATE_KEY) === todayText) return;
		const due = countDue(this.index.entries(), today);
		if (due === 0) return;
		const notice = new Notice(`VaultMate: ${due} review${due === 1 ? "" : "s"} due. Click to open.`, 8000);
		notice.messageEl.addClass("vaultmate-notice");
		notice.messageEl.addEventListener("click", () => void this.plugin.openHub());
		this.plugin.app.saveLocalStorage(NOTICE_DATE_KEY, todayText);
	}
}
