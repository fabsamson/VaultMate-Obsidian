// The three forms of the journal: new entry, track an existing line, review an entry.
import { Modal, Platform, type App } from "obsidian";

import { addInterval, formatDate, INTERVAL_LABELS, keepTogether, REVIEW_INTERVALS, startOfDay, type ReviewInterval } from "../../core/dates";
import { createChipRow, createDisclosure, createSectionHeader, createSegmentedControl } from "../../ui/components";
import type { JournalItem } from "./journal-index";
import type { LessonHint } from "./track-record";
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
	/** Set once something was written; read by `onClosed`. */
	protected written = false;
	/** Called once when the window closes: "done" when something was written, else "cancel" (the way back to the app). */
	public onClosed?: (result: "done" | "cancel") => void;

	public constructor(app: App) {
		super(app);
		this.modalEl.addClass("vaultmate");
	}

	public onClose(): void {
		this.contentEl.empty();
		const notify = this.onClosed;
		this.onClosed = undefined;
		notify?.(this.written ? "done" : "cancel");
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
		/** The latest lessons of the same kind, shown read-only under the statement. */
		private readonly lessons: readonly LessonHint[] = [],
	) {
		super(app);
	}

	public onOpen(): void {
		const { contentEl, kind } = this;
		createSectionHeader(contentEl, `New ${kindName(kind)}`);
		const statement = textField(contentEl, capitalize(kindName(kind)), { placeholder: kind === "decision" ? "What did you decide?" : "What do you expect to happen?" });
		statement.value = this.initialStatement;
		if (this.lessons.length > 0) {
			const hint = contentEl.createDiv({ cls: "vaultmate-lessons-hint" });
			hint.createSpan({ cls: "vaultmate-field-label", text: "Your last lessons" });
			for (const lesson of this.lessons) {
				const row = hint.createDiv({ cls: "vaultmate-lessons-hint-row" });
				row.createSpan({ text: lesson.text });
				row.createSpan({ cls: "vaultmate-muted", text: `${lesson.statement || "(no text)"} · ${keepTogether(lesson.date)}` });
			}
		}
		// A prediction needs its probability, so it stays in view; a decision keeps it with the other details.
		const decision = kind === "decision";
		const confidence = decision ? null : textField(contentEl, confidenceLabel(kind), { placeholder: "70", numeric: true });
		const interval = intervalField(contentEl, "Review in");
		const details = createDisclosure(contentEl, { label: "Add details" }).body;
		const answer = answerField(details, kind);
		const confidenceField = confidence ?? textField(details, confidenceLabel(kind), { placeholder: "70", numeric: true });
		const labels = decision ? ["Why", "Options", "Expected", "Signals"] : ["Why", "Signals"];
		const extras = labels.map((label) => ({ label, input: textField(details, label) }));

		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		const percent = (): number | null => parsePercentInput(confidenceField.value);
		const valid = (): boolean => statement.value.trim() !== "" && (confidenceField.value.trim() === "" ? decision : percent() !== null);
		const submit = (): void => {
			if (!valid()) return;
			this.onSubmit({ statement: statement.value, answer: answer.value, confidence: percent(), interval: interval(), extras: extras.map(({ label, input }) => [label, input.value]) });
			this.close();
		};
		const add = this.button(actions, `Add ${kindName(kind)}`, true, submit);
		const update = (): void => {
			add.disabled = !valid();
		};
		for (const input of [statement, answer, confidenceField, ...extras.map((extra) => extra.input)]) {
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

	public open(): void {
		super.open();
		// Obsidian focuses the first text field when a modal opens, which raises the keyboard over the choices.
		const active = this.contentEl.doc.activeElement;
		if (Platform.isPhone && active instanceof HTMLElement && this.modalEl.contains(active)) active.blur();
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
		const send = (input: ReviewInput): void => {
			buttons.forEach((button) => (button.disabled = true));
			void this.onSubmit(input).then((written) => {
				if (written) {
					this.written = true;
					this.close();
				} else {
					buttons.forEach((button) => (button.disabled = false));
					update();
				}
			});
		};

		// Three blocks, one shown at a time: the question, closing the entry (Yes) and postponing it (Not yet).
		// Late mode has no question: it starts on the Yes block.
		const askEl = contentEl.createDiv();
		const yesEl = contentEl.createDiv();
		const notYetEl = contentEl.createDiv();
		const firstChoice = (group: HTMLElement): HTMLElement | null => group.querySelector<HTMLElement>('[tabindex="0"]');
		let focusYes: () => HTMLElement | null = () => null;
		let focusNotYet: () => HTMLElement | null = () => null;
		let focusAsk: () => HTMLElement | null = () => null;
		const go = (step: "ask" | "yes" | "not-yet"): void => {
			askEl.hidden = step !== "ask";
			yesEl.hidden = step !== "yes";
			notYetEl.hidden = step !== "not-yet";
			// On a phone the keyboard would open at once and cover the choices: the user taps the first control.
			if (Platform.isPhone) return;
			(step === "ask" ? focusAsk() : step === "yes" ? focusYes() : focusNotYet())?.focus();
		};
		const back = (actions: HTMLElement): void => {
			if (!late) this.button(actions, "Back", false, () => go("ask"));
		};

		// ---- Time to judge? ----
		askEl.createEl("p", { cls: "vaultmate-question", text: "Time to judge?" });
		const askActions = askEl.createDiv({ cls: "vaultmate-actions" });
		this.button(askActions, "Not yet", false, () => go("not-yet"));
		const yesButton = this.button(askActions, "Yes", true, () => go("yes"));
		focusAsk = () => yesButton;

		// ---- Yes: the outcome, a lesson, an optional note ----
		if (decision) {
			const outcomeGroup = createSegmentedControl(choiceRow(yesEl, "Outcome"), {
				label: "Outcome",
				choices: OUTCOMES.map((value) => ({ value, label: OUTCOME_LABELS[value] })),
				value: outcome,
				onChange: (value) => {
					outcome = value;
					update();
				},
			});
			createSegmentedControl(choiceRow(yesEl, "Quality of the decision"), {
				label: "Quality of the decision",
				choices: QUALITIES.map((value) => ({ value, label: QUALITY_LABELS[value] })),
				value: quality,
				onChange: (value) => {
					quality = value;
					update();
				},
			});
			focusYes = () => firstChoice(outcomeGroup.el);
		} else {
			const resultGroup = createSegmentedControl(choiceRow(yesEl, "Did it happen?"), {
				label: "Did it happen?",
				choices: RESULTS.map((value) => ({ value, label: RESULT_LABELS[value] })),
				value: result,
				onChange: (value) => {
					result = value;
					update();
				},
			});
			focusYes = () => firstChoice(resultGroup.el);
		}
		const lesson = textField(yesEl, "Lesson (optional)");
		const happened = textField(createDisclosure(yesEl, { label: "Add a note" }).body, decision ? "What happened?" : "Notes", { multiline: true });
		const yesActions = yesEl.createDiv({ cls: "vaultmate-actions" });
		back(yesActions);
		closeButton = this.button(yesActions, late ? "Save outcome" : decision ? "Close decision" : "Close prediction", true, () => {
			const base = { happened: happened.value, lesson: lesson.value };
			if (decision && outcome && quality) send({ ...base, type: "close-decision", outcome, quality });
			else if (!decision && result) send({ ...base, type: "close-prediction", result });
		});
		buttons.push(closeButton);

		// ---- Not yet: a new date and an optional note ----
		if (!late) {
			const interval = intervalField(notYetEl, "Review again in");
			const note = textField(notYetEl, "Note (optional)");
			const notYetActions = notYetEl.createDiv({ cls: "vaultmate-actions" });
			back(notYetActions);
			buttons.push(this.button(notYetActions, "Review again", true, () => send({ happened: note.value, lesson: "", type: "again", interval: interval() })));
			focusNotYet = () => firstChoice(notYetEl);
			this.submitOnEnter(note, () => notYetActions.querySelector<HTMLButtonElement>(".mod-cta")?.click());
		}
		update();
		go(late ? "yes" : "ask");
	}
}
