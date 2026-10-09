// The decision journal feature: wires the index, capture, badge, review and hub page together.
import { debounce, MarkdownView, Notice, TFile, type Editor, type MarkdownFileInfo } from "obsidian";
import type { EditorView } from "@codemirror/view";

import { formatDate, startOfDay } from "../../core/dates";
import { getDescription, getInlineField, parseTaskLine } from "../../core/task-line";
import type VaultMatePlugin from "../../main";
import { CaptureSuggest } from "./capture-suggest";
import { JournalIndex, type JournalItem } from "./journal-index";
import {
	classifyLine,
	closeEntry,
	convertToEntry,
	countDue,
	dueFrom,
	kindName,
	parseConfidence,
	reviewAgain,
	type JournalKind,
	type JournalTags,
} from "./journal-line";
import { NewEntryModal, ReviewModal, TrackModal, type ReviewInput } from "./journal-modals";
import { getChildren, isEmptyLine, newEntryLines, replaceEmptyLineText, reviewItemText, usesTabs } from "./journal-note";
import { writeEntryLine } from "./journal-write";
import { createBadgeExtension } from "./line-badge";
import { createJournalPage } from "./journal-page";

function editorLines(editor: Editor): string[] {
	return Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
}

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
		const line = editor.getLine(editor.getCursor().line);
		if (line.trim() === "") return false;
		const cls = classifyLine(line, this.tags());
		return cls?.type !== "entry" || (cls.entry.status === "open" && cls.entry.due === null && cls.entry.kind === kind);
	}

	/** The open entry under the cursor, read from the editor, or null. */
	private openEntryAt(editor: Editor, path: string, lineNo = editor.getCursor().line): JournalItem | null {
		const raw = editor.getLine(lineNo);
		const cls = classifyLine(raw, this.tags());
		if (cls?.type !== "entry" || cls.entry.status !== "open") return null;
		return { path, line: lineNo, raw, entry: cls.entry, children: getChildren(editorLines(editor), lineNo).items };
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
		const raw = editor.getLine(lineNo);
		const cls = classifyLine(raw, this.tags());
		const statement = cls ? (cls.type === "entry" ? cls.entry.statement : cls.statement) : getDescription(parseTaskLine(raw).body);
		const confidence = cls?.type === "entry" ? cls.entry.confidence : parseConfidence(getInlineField(parseTaskLine(raw).body, "confidence"));
		new TrackModal(this.plugin.app, kind, statement, confidence, (result) => {
			const today = startOfDay();
			const line = convertToEntry(raw, { kind, tags: this.tags(), today: formatDate(today), due: dueFrom(today, result.interval), confidence: result.confidence });
			void writeEntryLine(this.plugin.app, { path, line: lineNo, raw }, line, null).then((written) => {
				if (written) new Notice(`Tracking as ${kindName(kind)}.`);
			});
		}).open();
	}

	// ---- Review -------------------------------------------------------------------------------------

	public openReview(item: JournalItem): void {
		new ReviewModal(this.plugin.app, item, (input) => this.applyReview(item, input)).open();
	}

	private async applyReview(item: JournalItem, input: ReviewInput): Promise<boolean> {
		const today = startOfDay();
		const todayText = formatDate(today);
		let line: string;
		let done: string;
		if (input.type === "close-decision") {
			line = closeEntry(item.raw, { kind: "decision", outcome: input.outcome, quality: input.quality, today: todayText });
			done = "Decision closed.";
		} else if (input.type === "close-prediction") {
			line = closeEntry(item.raw, { kind: "prediction", result: input.result, today: todayText });
			done = "Prediction closed.";
		} else {
			const due = dueFrom(today, input.interval);
			line = reviewAgain(item.raw, due);
			done = `Review date moved to ${due}.`;
		}
		const written = await writeEntryLine(this.plugin.app, item, line, reviewItemText(todayText, input.happened, input.lesson));
		if (written) new Notice(done);
		return written;
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
		if (file instanceof TFile) await this.plugin.app.workspace.getLeaf(false).openFile(file, { eState: { line: item.line } });
	}

	/** Once a day at most: "VaultMate: 2 reviews due". The day is stored only when the notice shows. */
	private showDailyNotice(): void {
		const today = startOfDay();
		const todayText = formatDate(today);
		if (!this.enabled() || this.plugin.settings.journalState.lastNoticeDate === todayText) return;
		const due = countDue(this.index.entries(), today);
		if (due === 0) return;
		const notice = new Notice(`VaultMate: ${due} review${due === 1 ? "" : "s"} due. Click to open.`, 8000);
		notice.messageEl.addClass("vaultmate-notice");
		notice.messageEl.addEventListener("click", () => void this.plugin.openHub());
		this.plugin.settings.journalState.lastNoticeDate = todayText;
		void this.plugin.saveSettings();
	}
}
