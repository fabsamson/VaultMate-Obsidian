// The three forms of the journal: new entry, track an existing line, review an entry.
import { Modal, Platform, type App } from "obsidian";

import { addInterval, formatDate, INTERVAL_LABELS, REVIEW_INTERVALS, startOfDay, type ReviewInterval } from "../../core/dates";
import { createChipRow, createSectionHeader, createSegmentedControl } from "../../ui/components";
import type { JournalItem } from "./journal-index";
import {
	OUTCOMES,
	QUALITIES,
	RESULTS,
	kindName,
	parsePercentInput,
	type JournalEntry,
	type JournalKind,
	type Outcome,
	type PredictionResult,
	type Quality,
} from "./journal-line";

const DEFAULT_INTERVAL: ReviewInterval = "3m";

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

type Field = HTMLInputElement | HTMLTextAreaElement;

export function textField(parent: HTMLElement, label: string, options: { placeholder?: string; multiline?: boolean; numeric?: boolean } = {}): Field {
	const row = parent.createEl("label", { cls: "vaultmate-field" });
	row.createSpan({ cls: "vaultmate-field-label", text: label });
	const placeholder = options.placeholder ?? "";
	if (options.multiline) return row.createEl("textarea", { cls: "vaultmate-input", attr: { rows: "3", placeholder } });
	const input = row.createEl("input", { cls: "vaultmate-input", attr: { type: "text", placeholder } });
	if (options.numeric) input.inputMode = "decimal";
	return input;
}

/** A labelled row that holds a choice group. */
function choiceRow(parent: HTMLElement, label: string): HTMLElement {
	const row = parent.createDiv({ cls: "vaultmate-field" });
	row.createSpan({ cls: "vaultmate-field-label", text: label });
	return row;
}

/** "Review in" chips with the resulting date written under them. */
function intervalField(parent: HTMLElement, label: string): () => ReviewInterval {
	const row = choiceRow(parent, label);
	const hint = row.createDiv({ cls: "vaultmate-muted" });
	const show = (interval: ReviewInterval): void => hint.setText(`On ${formatDate(addInterval(startOfDay(), interval))}`);
	const group = createChipRow(row, {
		label,
		choices: REVIEW_INTERVALS.map((value) => ({ value, label: INTERVAL_LABELS[value] })),
		value: DEFAULT_INTERVAL,
		onChange: show,
	});
	row.insertBefore(group.el, hint);
	show(DEFAULT_INTERVAL);
	return () => group.getValue() ?? DEFAULT_INTERVAL;
}

export abstract class JournalModal extends Modal {
	public constructor(app: App) {
		super(app);
		this.modalEl.addClass("vaultmate");
	}

	public onClose(): void {
		this.contentEl.empty();
	}

	/** Enter in a single-line field runs `submit`. */
	protected submitOnEnter(input: HTMLElement, submit: () => void): void {
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.isComposing) {
				event.preventDefault();
				submit();
			}
		});
	}

	protected button(parent: HTMLElement, text: string, cta: boolean, onClick: () => void): HTMLButtonElement {
		const button = parent.createEl("button", { cls: cta ? "vaultmate-button mod-cta" : "vaultmate-button", text, attr: { type: "button" } });
		button.addEventListener("click", onClick);
		return button;
	}
}

function answerField(parent: HTMLElement, kind: JournalKind): Field {
	return textField(parent, "Answer (optional)", { placeholder: kind === "decision" ? "Your decision, if the line is a question" : "Your answer, if the line is a question" });
}

function confidenceLabel(kind: JournalKind): string {
	return kind === "decision" ? "Confidence in percent (optional)" : "Probability in percent";
}

// ---- New entry --------------------------------------------------------------------------------------

export interface NewEntryResult {
	statement: string;
	answer: string;
	confidence: number | null;
	interval: ReviewInterval;
	/** [label, value] pairs in order; some values are empty. */
	extras: Array<[string, string]>;
}

export class NewEntryModal extends JournalModal {
	public constructor(
		app: App,
		private readonly kind: JournalKind,
		private readonly onSubmit: (result: NewEntryResult) => void,
		/** Prefills the statement, for an entry made from an idea. */
		private readonly initialStatement = "",
	) {
		super(app);
	}

	public onOpen(): void {
		const { contentEl, kind } = this;
		createSectionHeader(contentEl, `New ${kindName(kind)}`);
		const statement = textField(contentEl, capitalize(kindName(kind)), { placeholder: kind === "decision" ? "What did you decide?" : "What do you expect to happen?" });
		statement.value = this.initialStatement;
		const answer = answerField(contentEl, kind);
		const confidence = textField(contentEl, confidenceLabel(kind), { placeholder: "70", numeric: true });
		const interval = intervalField(contentEl, "Review in");
		const labels = kind === "decision" ? ["Why", "Options", "Expected", "Signals"] : ["Why", "Signals"];
		const extras = labels.map((label) => ({ label, input: textField(contentEl, label) }));

		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		const percent = (): number | null => parsePercentInput(confidence.value);
		const valid = (): boolean => statement.value.trim() !== "" && (confidence.value.trim() === "" ? kind === "decision" : percent() !== null);
		const submit = (): void => {
			if (!valid()) return;
			this.onSubmit({ statement: statement.value, answer: answer.value, confidence: percent(), interval: interval(), extras: extras.map(({ label, input }) => [label, input.value]) });
			this.close();
		};
		const add = this.button(actions, `Add ${kindName(kind)}`, true, submit);
		const update = (): void => {
			add.disabled = !valid();
		};
		for (const input of [statement, answer, confidence, ...extras.map((extra) => extra.input)]) {
			input.addEventListener("input", update);
			this.submitOnEnter(input, submit);
		}
		update();
		statement.focus();
	}
}

// ---- Track an existing line -------------------------------------------------------------------------

export interface TrackResult {
	answer: string;
	confidence: number | null;
	interval: ReviewInterval;
}

export class TrackModal extends JournalModal {
	/** `answer` and `confidence` prefill the fields with the values already on the line. */
	public constructor(
		app: App,
		private readonly kind: JournalKind,
		private readonly statement: string,
		private readonly answer: string | null,
		private readonly confidence: number | null,
		private readonly onSubmit: (result: TrackResult) => void,
	) {
		super(app);
	}

	public onOpen(): void {
		const { contentEl, kind } = this;
		createSectionHeader(contentEl, `Track as ${kindName(kind)}`);
		contentEl.createEl("p", { cls: "vaultmate-statement", text: this.statement || "(no text yet)" });
		const answer = answerField(contentEl, kind);
		if (this.answer !== null) answer.value = this.answer;
		const confidence = textField(contentEl, confidenceLabel(kind), { placeholder: "70", numeric: true });
		if (this.confidence !== null) confidence.value = String(this.confidence);
		const interval = intervalField(contentEl, "Review in");

		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		const percent = (): number | null => parsePercentInput(confidence.value);
		const valid = (): boolean => (confidence.value.trim() === "" ? kind === "decision" : percent() !== null);
		const submit = (): void => {
			if (!valid()) return;
			this.onSubmit({ answer: answer.value, confidence: percent(), interval: interval() });
			this.close();
		};
		const track = this.button(actions, `Track ${kindName(kind)}`, true, submit);
		const update = (): void => {
			track.disabled = !valid();
		};
		confidence.addEventListener("input", update);
		this.submitOnEnter(answer, submit);
		this.submitOnEnter(confidence, submit);
		update();
		confidence.focus();
	}
}

// ---- Review -----------------------------------------------------------------------------------------

export type ReviewInput = { happened: string; lesson: string } & (
	| { type: "close-decision"; outcome: Outcome; quality: Quality }
	| { type: "close-prediction"; result: PredictionResult }
	| { type: "again"; interval: ReviewInterval }
);

const OUTCOME_LABELS: Record<Outcome, string> = { better: "Better", "as-expected": "As expected", worse: "Worse" };
const QUALITY_LABELS: Record<Quality, string> = { good: "Good decision", unsure: "Unsure", bad: "Bad decision" };
const RESULT_LABELS: Record<PredictionResult, string> = { yes: "Yes", no: "No", partly: "Partly" };

function summary(entry: JournalEntry): string {
	const parts = [capitalize(kindName(entry.kind))];
	if (entry.created) parts.push(`created ${entry.created}`);
	if (entry.confidence !== null) parts.push(`${entry.kind === "decision" ? "confidence" : "probability"} ${entry.confidence}%`);
	if (entry.due) parts.push(`review ${entry.due}`);
	return parts.join(" · ");
}

export class ReviewModal extends JournalModal {
	/**
	 * `onSubmit` resolves true when the note was written; the modal then closes. In late mode the entry was
	 * ticked without a review: the form is "Add the outcome", prefilled with what the line already has, and
	 * it can only close the entry (no intermediate review).
	 */
	public constructor(
		app: App,
		private readonly item: JournalItem,
		private readonly onSubmit: (input: ReviewInput) => Promise<boolean>,
		private readonly late = false,
	) {
		super(app);
	}

	public onOpen(): void {
		const { contentEl, item, late } = this;
		const { entry } = item;
		const decision = entry.kind === "decision";
		createSectionHeader(contentEl, late ? "Add the outcome" : `Review ${kindName(entry.kind)}`);
		contentEl.createEl("p", { cls: "vaultmate-statement", text: entry.statement || "(no text)" });
		if (entry.answer !== null) contentEl.createEl("p", { cls: "vaultmate-answer", text: `${decision ? "Your decision" : "Your answer"}: ${entry.answer}` });
		contentEl.createEl("p", { cls: "vaultmate-muted", text: summary(entry) });
		if (late) contentEl.createEl("p", { cls: "vaultmate-muted", text: `This ${kindName(entry.kind)} was ticked without a review. Only the missing fields are written.` });
		if (item.children.length > 0) {
			const list = contentEl.createEl("ul", { cls: "vaultmate-context" });
			for (const child of item.children) list.createEl("li", { text: child });
		}

		const buttons: HTMLButtonElement[] = [];
		let closeButton: HTMLButtonElement | undefined;
		let outcome: Outcome | null = late ? entry.outcome : null;
		let quality: Quality | null = late ? entry.quality : null;
		let result: PredictionResult | null = late ? entry.result : null;
		const update = (): void => {
			if (closeButton) closeButton.disabled = decision ? outcome === null || quality === null : result === null;
		};

		const happened = textField(contentEl, decision ? "What happened?" : "Notes", { multiline: true });
		let lesson: Field | undefined;
		if (decision) {
			createSegmentedControl(choiceRow(contentEl, "Outcome"), {
				label: "Outcome",
				choices: OUTCOMES.map((value) => ({ value, label: OUTCOME_LABELS[value] })),
				value: outcome,
				onChange: (value) => {
					outcome = value;
					update();
				},
			});
			createSegmentedControl(choiceRow(contentEl, "Quality of the decision"), {
				label: "Quality of the decision",
				choices: QUALITIES.map((value) => ({ value, label: QUALITY_LABELS[value] })),
				value: quality,
				onChange: (value) => {
					quality = value;
					update();
				},
			});
			lesson = textField(contentEl, "Lesson");
		} else {
			createSegmentedControl(choiceRow(contentEl, "Did it happen?"), {
				label: "Did it happen?",
				choices: RESULTS.map((value) => ({ value, label: RESULT_LABELS[value] })),
				value: result,
				onChange: (value) => {
					result = value;
					update();
				},
			});
		}

		const send = (input: ReviewInput): void => {
			buttons.forEach((button) => (button.disabled = true));
			void this.onSubmit(input).then((written) => {
				if (written) {
					this.close();
				} else {
					buttons.forEach((button) => (button.disabled = false));
					update();
				}
			});
		};
		const base = (): { happened: string; lesson: string } => ({ happened: happened.value, lesson: lesson?.value ?? "" });

		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		closeButton = this.button(actions, late ? "Save outcome" : decision ? "Close decision" : "Close prediction", true, () => {
			if (decision && outcome && quality) send({ ...base(), type: "close-decision", outcome, quality });
			else if (!decision && result) send({ ...base(), type: "close-prediction", result });
		});
		buttons.push(closeButton);
		if (!late) {
			const again = contentEl.createDiv({ cls: "vaultmate-again" });
			const interval = intervalField(again, "Or review again in");
			const againActions = again.createDiv({ cls: "vaultmate-actions" });
			buttons.push(this.button(againActions, "Review again", false, () => send({ ...base(), type: "again", interval: interval() })));
		}
		update();
		// On a phone the keyboard would open at once and cover the choices.
		if (!Platform.isPhone) happened.focus();
	}
}
