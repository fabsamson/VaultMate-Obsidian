// The hub's "Track record" section: stamps, Brier score, calibration, decision matrix and lessons.
import { createHankoStamp, createPanel } from "../../ui/components";
import type { HubSection } from "../../ui/hub-view";
import { createSprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import type { JournalItem } from "./journal-index";
import { OUTCOMES, QUALITIES } from "./journal-line";
import { computeTrackRecord, MIN_SCORED, type TrackRecord } from "./track-record";

export interface TrackRecordHost {
	enabled(): boolean;
	entries(): JournalItem[];
	/** Opens the note at the entry's line. */
	openItem(item: JournalItem): void;
}

const LESSONS_SHOWN = 5;
const QUALITY_LABEL = { good: "Good decision", unsure: "Unsure", bad: "Bad decision" } as const;
const OUTCOME_LABEL = { better: "Better", "as-expected": "As expected", worse: "Worse" } as const;

const count = (n: number, singular: string, plural = `${singular}s`): string => `${n} ${n === 1 ? singular : plural}`;
const percent = (value: number): string => `${Math.round(value)}%`;

function renderTitle(body: HTMLElement, text: string): void {
	body.createDiv({ cls: "vaultmate-review-group-title", text, attr: { role: "heading", "aria-level": "3" } });
}

function renderStamps(body: HTMLElement, record: TrackRecord<JournalItem>): void {
	const row = body.createDiv({ cls: "vaultmate-stamp-row" });
	createHankoStamp(row, { sprite: SPRITES.stampHit, label: count(record.predictions.hits, "hit") });
	createHankoStamp(row, { sprite: SPRITES.stampMiss, label: count(record.predictions.misses, "miss", "misses") });
	createHankoStamp(row, { sprite: SPRITES.stampReview, label: count(record.reviewsDone, "review") + " done" });
}

function renderPredictions(body: HTMLElement, record: TrackRecord<JournalItem>): void {
	const { predictions } = record;
	if (predictions.scored === 0 && predictions.unscored === 0) return;
	renderTitle(body, "Predictions");
	const panel = createPanel(body, "vaultmate-track-panel");
	if (predictions.unscored > 0) panel.createEl("p", { cls: "vaultmate-muted", text: `${count(predictions.unscored, "resolved prediction")} without a probability, not scored.` });
	if (predictions.brier === null) {
		panel.createEl("p", { text: `${count(predictions.scored, "scored prediction")} so far.` });
		panel.createEl("p", { cls: "vaultmate-muted", text: "Resolve a few more predictions to see your calibration." });
		return;
	}
	const score = panel.createDiv({ cls: "vaultmate-brier" });
	score.createSpan({ cls: "vaultmate-brier-value", text: predictions.brier.toFixed(2) });
	score.createSpan({ cls: "vaultmate-brier-label", text: `Brier score · ${count(predictions.scored, "prediction")}` });
	panel.createEl("p", { cls: "vaultmate-muted", text: "Zero is perfect; always saying 50% scores 0.25." });

	const bands = panel.createDiv({ cls: "vaultmate-calibration", attr: { role: "list", "aria-label": "Calibration by stated probability" } });
	for (const band of predictions.bands) {
		const row = bands.createDiv({ cls: "vaultmate-calibration-row", attr: { role: "listitem" } });
		row.createSpan({ text: `You said about ${percent(band.stated)} · came true ${percent(band.observed)} · ${count(band.count, "prediction")}` });
		const bar = row.createDiv({ cls: "vaultmate-calibration-bar", attr: { "aria-hidden": "true" } });
		bar.createDiv({ cls: "vaultmate-calibration-fill" }).setCssProps({ "--vaultmate-width": `${Math.round(band.observed)}%` });
		bar.createDiv({ cls: "vaultmate-calibration-mark" }).setCssProps({ "--vaultmate-left": `${Math.round(band.stated)}%` });
	}
	panel.createEl("p", { cls: "vaultmate-muted", text: "Bar: how often it came true. Line: what you said." });
}

function renderMatrix(body: HTMLElement, record: TrackRecord<JournalItem>): void {
	const { decisions } = record;
	if (decisions.closed === 0) return;
	renderTitle(body, `Decisions · ${decisions.closed}`);
	const panel = createPanel(body, "vaultmate-track-panel");
	const table = panel.createEl("table", { cls: "vaultmate-matrix" });
	table.createEl("caption", { cls: "vaultmate-matrix-caption", text: "Decision quality by outcome" });
	const head = table.createEl("thead").createEl("tr");
	head.createEl("td");
	for (const outcome of OUTCOMES) head.createEl("th", { text: OUTCOME_LABEL[outcome], attr: { scope: "col" } });
	const tbody = table.createEl("tbody");
	QUALITIES.forEach((quality, index) => {
		const row = tbody.createEl("tr");
		row.createEl("th", { text: QUALITY_LABEL[quality], attr: { scope: "row" } });
		for (const value of decisions.matrix[index] ?? []) row.createEl("td", { text: String(value), cls: value === 0 ? "vaultmate-matrix-zero" : undefined });
	});
	if (decisions.badLuck > 0) panel.createEl("p", { cls: "vaultmate-muted", text: `Good decision, worse outcome: bad luck, not a bad call (${decisions.badLuck})` });
	if (decisions.lucky > 0) panel.createEl("p", { cls: "vaultmate-muted", text: `Bad decision, better outcome: lucky (${decisions.lucky})` });
}

export function createTrackRecordSection(host: TrackRecordHost): HubSection {
	let showAllLessons = false;

	const renderLessons = (body: HTMLElement, record: TrackRecord<JournalItem>): void => {
		if (record.lessons.length === 0) return;
		renderTitle(body, `Lessons · ${record.lessons.length}`);
		const shown = showAllLessons ? record.lessons : record.lessons.slice(0, LESSONS_SHOWN);
		for (const lesson of shown) {
			const main = body.createDiv({ cls: "vaultmate-review-row" }).createEl("button", { cls: "vaultmate-review-main", attr: { type: "button" } });
			main.createSpan({ cls: "vaultmate-review-statement", text: lesson.text });
			main.createSpan({ cls: "vaultmate-muted", text: `${lesson.item.entry.statement || "(no text)"} · ${lesson.date}` });
			main.addEventListener("click", () => host.openItem(lesson.item));
		}
		if (shown.length < record.lessons.length) {
			const more = body.createEl("button", { cls: "vaultmate-link", text: `${record.lessons.length - shown.length} more`, attr: { type: "button" } });
			more.addEventListener("click", () => {
				showAllLessons = true;
				body.empty();
				renderBody(body);
			});
		}
	};

	const renderBody = (body: HTMLElement): void => {
		const record = computeTrackRecord(host.entries());
		const { predictions, decisions } = record;
		if (record.reviewsDone + predictions.scored + decisions.closed + record.lessons.length === 0) {
			const panel = createPanel(body, "vaultmate-empty");
			createSprite(panel, SPRITES.mascotTea, 96);
			panel.createEl("p", { cls: "vaultmate-empty-title", text: "No reviews yet" });
			panel.createEl("p", { cls: "vaultmate-muted", text: `Your track record builds up as you resolve predictions and close decisions; ${MIN_SCORED} resolved predictions unlock calibration.` });
			return;
		}
		renderStamps(body, record);
		renderPredictions(body, record);
		renderMatrix(body, record);
		renderLessons(body, record);
	};

	return {
		id: "journal-track-record",
		order: 20,
		label: "Track record",
		kanji: "績",
		enabled: () => host.enabled(),
		render: (body) => {
			showAllLessons = false;
			renderBody(body);
		},
	};
}
