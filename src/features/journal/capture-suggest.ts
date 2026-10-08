// Inline capture: after "… #decision " or "Decision: ", offer the review dates and convert the line.
import { EditorSuggest, type App, type Editor, type EditorPosition, type EditorSuggestContext, type EditorSuggestTriggerInfo } from "obsidian";

import { addInterval, formatDate, INTERVAL_LABELS, REVIEW_INTERVALS, startOfDay, type ReviewInterval } from "../../core/dates";
import { classifyLine, convertToEntry, statementOffset, tagOf, type JournalKind, type JournalTags } from "./journal-line";

interface Suggestion {
	kind: JournalKind;
	interval: ReviewInterval;
	/** `YYYY-MM-DD` */
	due: string;
}

export interface CaptureHost {
	enabled(): boolean;
	tags(): JournalTags;
}

const TAG_AT_END_RE = /(?:^|\s)#([^\s#]+) $/;

export class CaptureSuggest extends EditorSuggest<Suggestion> {
	public constructor(
		app: App,
		private readonly host: CaptureHost,
	) {
		super(app);
		this.setInstructions([{ command: "↵", purpose: "to set the review date" }]);
	}

	public onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
		if (!this.host.enabled()) return null;
		const line = editor.getLine(cursor.line);
		// Cheap exits first: this runs on every cursor move.
		if (cursor.ch !== line.length || !line.endsWith(" ") || line.includes("📅")) return null;
		if (!line.includes("#") && !/[:：]/.test(line)) return null;

		const tags = this.host.tags();
		const cls = classifyLine(line, tags);
		if (!cls || (cls.type === "entry" && cls.entry.status !== "open")) return null;
		if (cls.type === "prose") {
			if (cls.statement !== "") return null;
		} else if (!this.endsWithTag(line, tags, cls.type === "entry" ? cls.entry.kind : cls.kind)) {
			return null;
		}
		const kind = cls.type === "entry" ? cls.entry.kind : cls.kind;
		return { start: { line: cursor.line, ch: line.length }, end: cursor, query: kind };
	}

	public getSuggestions(context: EditorSuggestContext): Suggestion[] {
		const kind: JournalKind = context.query === "prediction" ? "prediction" : "decision";
		const today = startOfDay();
		return REVIEW_INTERVALS.map((interval) => ({ kind, interval, due: formatDate(addInterval(today, interval)) }));
	}

	public renderSuggestion(suggestion: Suggestion, el: HTMLElement): void {
		el.addClass("vaultmate-suggestion");
		el.createSpan({ text: `Review in ${INTERVAL_LABELS[suggestion.interval]}` });
		el.createSpan({ cls: "vaultmate-suggestion-date", text: suggestion.due });
	}

	public selectSuggestion(suggestion: Suggestion): void {
		const context = this.context;
		if (!context) return;
		const { editor } = context;
		const lineNo = context.start.line;
		const line = editor.getLine(lineNo);
		const converted = convertToEntry(line, { kind: suggestion.kind, tags: this.host.tags(), today: formatDate(startOfDay()), due: suggestion.due, confidence: null });
		editor.setLine(lineNo, converted);
		// Prose lines have no statement yet: the cursor goes where it is typed.
		const wasProse = classifyLine(line, this.host.tags())?.type === "prose";
		editor.setCursor({ line: lineNo, ch: wasProse ? statementOffset(converted) : converted.length });
		this.close();
	}

	/** The text before the cursor ends with the whole tag followed by a space ("… #decision "). */
	private endsWithTag(line: string, tags: JournalTags, kind: JournalKind): boolean {
		const name = TAG_AT_END_RE.exec(line)?.[1]?.toLowerCase();
		const wanted = tagOf(kind, tags).toLowerCase();
		return name !== undefined && (name === wanted || name.startsWith(`${wanted}/`));
	}
}
