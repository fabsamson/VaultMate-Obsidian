// Inline capture: after "… #idea " or on an empty "Idea: " line, offer to plant the idea.
import { EditorSuggest, type App, type Editor, type EditorPosition, type EditorSuggestContext, type EditorSuggestTriggerInfo } from "obsidian";

import { formatDate, startOfDay } from "../../core/dates";
import { statementOffset } from "../../core/task-line";
import { classifyIdeaLine, convertToIdea, ideaCapture } from "./idea-line";

interface Suggestion {
	/** `YYYY-MM-DD`, the date the idea gets. */
	date: string;
}

export interface IdeaCaptureHost {
	enabled(): boolean;
	tag(): string;
}

/** Converts the line to an idea task. The cursor goes where the statement is typed (empty prose line), else to the end. */
export function plantIdea(editor: Editor, lineNo: number, tag: string): void {
	const line = editor.getLine(lineNo);
	const converted = convertToIdea(line, tag, formatDate(startOfDay()));
	editor.setLine(lineNo, converted);
	const cls = classifyIdeaLine(line, tag);
	editor.setCursor({ line: lineNo, ch: cls?.type === "prose" && cls.statement === "" ? statementOffset(converted) : converted.length });
}

export class IdeaCaptureSuggest extends EditorSuggest<Suggestion> {
	public constructor(
		app: App,
		private readonly host: IdeaCaptureHost,
	) {
		super(app);
		this.setInstructions([{ command: "↵", purpose: "to plant the idea" }]);
	}

	public onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
		if (!this.host.enabled()) return null;
		const line = editor.getLine(cursor.line);
		if (cursor.ch !== line.length || ideaCapture(line, this.host.tag()) === null) return null;
		return { start: { line: cursor.line, ch: line.length }, end: cursor, query: "" };
	}

	public getSuggestions(): Suggestion[] {
		return [{ date: formatDate(startOfDay()) }];
	}

	public renderSuggestion(suggestion: Suggestion, el: HTMLElement): void {
		el.addClass("vaultmate-suggestion");
		el.createSpan({ text: "Plant idea" });
		el.createSpan({ cls: "vaultmate-suggestion-date", text: suggestion.date });
	}

	public selectSuggestion(): void {
		const context: EditorSuggestContext | null = this.context;
		if (!context) return;
		plantIdea(context.editor, context.start.line, this.host.tag());
		this.close();
	}
}
