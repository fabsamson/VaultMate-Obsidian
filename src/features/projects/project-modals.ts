// The small forms of the projects feature: the first or next task of a track, and the status picker.
import { SuggestModal, type App } from "obsidian";

import { parseDate } from "../../core/dates";
import { createChipRow, createSectionHeader } from "../../ui/components";
import { createSmallSprite } from "../../ui/pixel";
import { JournalModal, textField } from "../journal/journal-modals";
import { STATUS_INFO, TRACK_STATUSES, type TrackStatus } from "./project-note";
import { TRACK_SEALS } from "./track-seals";
import { prefillName, trackFormState } from "./track-form";

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

export interface TrackFields {
	status(): TrackStatus;
	/** The short name as typed. */
	typedName(): string;
	/** The first task, only when the status is In progress and a text is typed. */
	firstTask(): TaskFormResult | undefined;
	/** Whether the due date is empty or real. */
	dueValid(): boolean;
	/** Shows or hides the warning that a track already has this name. */
	warnDuplicate(show: boolean): void;
	focusName(): void;
}

export interface TrackFieldsOptions {
	/** Prefills the short name. */
	prefill: string;
	/** Called after the status, the name or the task changed. */
	onChange: () => void;
	/** Enter in the short name or the task. */
	onEnter: () => void;
}

/** The status chips, the short name and the optional first task: the fields Promote and New track share. */
export function addTrackFields(parent: HTMLElement, options: TrackFieldsOptions): TrackFields {
	let status: TrackStatus = "explore";
	const chips = createChipRow(parent, {
		label: "Status",
		choices: TRACK_STATUSES.map((value) => ({ value, label: STATUS_INFO[value].label, sprite: TRACK_SEALS[value] })),
		value: status,
		onChange: (value) => {
			status = value;
			update();
			options.onChange();
		},
	});
	chips.el.addClass("vaultmate-track-status");
	const name = textField(parent, "Short name", { placeholder: "A few words" }) as HTMLInputElement;
	name.value = options.prefill;
	const warning = parent.createEl("p", { cls: "vaultmate-muted", text: "A track with this name already exists in this project." });
	warning.hide();
	const taskBox = parent.createDiv();
	const task = textField(taskBox, "First task (optional)", { placeholder: "What is the next step?" }) as HTMLInputElement;
	const dueRow = taskBox.createEl("label", { cls: "vaultmate-field" });
	dueRow.createSpan({ cls: "vaultmate-field-label", text: "Due date (optional)" });
	const due = dueRow.createEl("input", { cls: "vaultmate-input", attr: { type: "date" } });
	const update = (): void => taskBox.toggle(trackFormState(name.value, status, []).showTask);
	update();
	for (const input of [name, task, due]) input.addEventListener("input", options.onChange);
	const enter = (event: KeyboardEvent): void => {
		if (event.key !== "Enter" || event.isComposing) return;
		event.preventDefault();
		options.onEnter();
	};
	name.addEventListener("keydown", enter);
	task.addEventListener("keydown", enter);
	return {
		status: () => status,
		typedName: () => name.value,
		firstTask: () => (status === "progress" && task.value.trim() !== "" ? { text: task.value.trim(), due: due.value } : undefined),
		dueValid: () => validDue(due.value),
		warnDuplicate: (show) => warning.toggle(show),
		focusName: () => {
			name.focus();
			name.select();
		},
	};
}

export interface PromoteResult {
	status: TrackStatus;
	shortName: string;
	firstTask?: TaskFormResult;
}

/** Promote an idea to a track: status, short name, and a first task when it starts In progress. */
export class PromoteModal extends JournalModal {
	/** `text` is the idea's text; `titles` are the titles of the project's tracks, to warn about a repeat. */
	public constructor(
		app: App,
		private readonly text: string,
		private readonly titles: readonly string[],
		private readonly onSubmit: (result: PromoteResult) => void,
	) {
		super(app);
	}

	public onOpen(): void {
		const { contentEl } = this;
		createSectionHeader(contentEl, "Promote to a track");
		contentEl.createEl("p", { cls: "vaultmate-statement", text: this.text || "(no text yet)" });
		const fields = addTrackFields(contentEl, { prefill: prefillName(this.text), onChange: () => update(), onEnter: () => submit() });
		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		const send = this.button(actions, "Promote", true, () => submit());
		this.button(actions, "Cancel", false, () => this.close());
		const update = (): void => {
			const state = trackFormState(fields.typedName(), fields.status(), this.titles);
			send.disabled = !state.valid || !fields.dueValid();
			fields.warnDuplicate(state.duplicate);
		};
		const submit = (): void => {
			if (send.disabled) return;
			const firstTask = fields.firstTask();
			this.onSubmit({ status: fields.status(), shortName: trackFormState(fields.typedName(), fields.status(), []).name, ...(firstTask ? { firstTask } : {}) });
			this.close();
		};
		update();
		contentEl.win.setTimeout(() => fields.focusName(), 0);
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
		el.addClass("vaultmate-status-choice");
		createSmallSprite(el, TRACK_SEALS[status], 16);
		el.createSpan({ text: STATUS_INFO[status].label });
	}

	public onChooseSuggestion(status: TrackStatus): void {
		this.onChoose(status);
	}
}
