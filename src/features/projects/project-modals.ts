// The small forms of the projects feature: the first or next task of a track, and the status picker.
import { SuggestModal, type App } from "obsidian";

import { parseDate } from "../../core/dates";
import { createSectionHeader } from "../../ui/components";
import { JournalModal, textField } from "../journal/journal-modals";
import { STATUS_INFO, type TrackStatus } from "./project-note";

export interface TaskFormResult {
	text: string;
	/** `YYYY-MM-DD`, or empty for none. */
	due: string;
}

/** Whether a due date as typed is empty or a real `YYYY-MM-DD` date. */
export function validDue(due: string): boolean {
	return due === "" || parseDate(due) !== null;
}

export interface TaskFormOptions {
	title: string;
	submitLabel: string;
	/** Start may leave the task out; Add task needs one. */
	textRequired: boolean;
	onSubmit: (result: TaskFormResult) => void;
}

/** A task text and an optional due date. */
export class TaskModal extends JournalModal {
	public constructor(
		app: App,
		private readonly options: TaskFormOptions,
	) {
		super(app);
	}

	public onOpen(): void {
		const { contentEl, options } = this;
		createSectionHeader(contentEl, options.title);
		const text = textField(contentEl, options.textRequired ? "Task" : "First task (optional)", { placeholder: "What is the next step?" });
		const dueRow = contentEl.createEl("label", { cls: "vaultmate-field" });
		dueRow.createSpan({ cls: "vaultmate-field-label", text: "Due date (optional)" });
		const due = dueRow.createEl("input", { cls: "vaultmate-input", attr: { type: "date" } });

		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		const valid = (): boolean => (!options.textRequired || text.value.trim() !== "") && validDue(due.value);
		const submit = (): void => {
			if (!valid()) return;
			options.onSubmit({ text: text.value.trim(), due: due.value });
			this.close();
		};
		const send = this.button(actions, options.submitLabel, true, submit);
		this.button(actions, "Cancel", false, () => this.close());
		const update = (): void => {
			send.disabled = !valid();
		};
		for (const input of [text, due]) input.addEventListener("input", update);
		this.submitOnEnter(text, submit);
		update();
		text.focus();
	}
}

/** Picks a status, for the Move and Promote commands. */
export class StatusModal extends SuggestModal<TrackStatus> {
	public constructor(
		app: App,
		private readonly statuses: readonly TrackStatus[],
		placeholder: string,
		private readonly onChoose: (status: TrackStatus) => void,
	) {
		super(app);
		this.setPlaceholder(placeholder);
	}

	public getSuggestions(query: string): TrackStatus[] {
		const text = query.trim().toLowerCase();
		return this.statuses.filter((status) => STATUS_INFO[status].label.toLowerCase().includes(text));
	}

	public renderSuggestion(status: TrackStatus, el: HTMLElement): void {
		el.setText(`${STATUS_INFO[status].marker} ${STATUS_INFO[status].label}`);
	}

	public onChooseSuggestion(status: TrackStatus): void {
		this.onChoose(status);
	}
}
