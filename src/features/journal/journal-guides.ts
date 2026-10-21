// Chapter 8 of the book: the Decisions and predictions page (`journal`). The story is the first novel, six months after
// the launch: a decision and a prediction written on day one, judged later. Each picture is the same two bets at that
// moment, drawn with the real components and classes.
import { createHankoStamp, createIconButton, createSegmentedControl } from "../../ui/components";
import type { Guide } from "../../ui/guide/guide";
import { createSprite } from "../../ui/pixel";
import { createSectionNav } from "../../ui/section-nav";
import { SPRITES } from "../../ui/sprites";
import { badgeFor, classifyLine, type JournalTags } from "./journal-line";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#decision-journal";
const noop = (): void => undefined;
const TAGS: JournalTags = { decisionTag: "decision", predictionTag: "prediction" };

/** The two bets of the story, as the note holds them on the day they are written. */
export const SELF_PUBLISH = "- [ ] Self-publish #decision ➕ 2026-10-21 📅 2027-04-21";
export const HUNDRED_COPIES = "- [ ] 100 copies by spring #prediction [confidence: 60%] ➕ 2026-10-21 📅 2027-04-21";

/** A line of a note with the end-of-line badge the plugin draws on it (the real text, for the day `today`). */
export function badgedLine(parent: HTMLElement, line: string, today: Date): void {
	const row = parent.createDiv({ cls: "vaultmate-guide-md-line" });
	const shown = line.split(" ➕")[0] ?? line;
	shown.split(/(#\w+)/).forEach((part) => (part.startsWith("#") ? row.createSpan({ cls: "vaultmate-guide-md-tag", text: part }) : row.appendText(part)));
	const cls = classifyLine(line, TAGS);
	if (cls) row.createSpan({ cls: "vaultmate-badge", text: badgeFor(cls, today).text });
}

/** An open entry as the Reviews list draws it: its kind, its text and its Review button. */
function reviewRow(parent: HTMLElement, options: { decision: boolean; statement: string; detail: string }): void {
	const row = parent.createDiv({ cls: "vaultmate-review-row" });
	createSprite(row, options.decision ? SPRITES.moduleDecision : SPRITES.modulePrediction, 24);
	const main = row.createEl("button", { cls: "vaultmate-review-main", attr: { type: "button" } });
	main.createSpan({ cls: "vaultmate-review-statement", text: options.statement });
	main.createSpan({ cls: "vaultmate-muted", text: options.detail });
	createIconButton(row, SPRITES.actionReview, "Review", noop, { primary: true });
}

export const JOURNAL_GUIDE: Guide = {
	id: "journal",
	sprite: SPRITES.moduleDecision,
	purpose: "Write a call down now, judge it later, and learn how good your calls are.",
	steps: [
		{
			when: "Month 1",
			cat: SPRITES.mascotCrystal,
			text: "You decide to **Self-publish** and write a review date, then predict 100 copies by spring at 60%. Each line gets a small badge at its end.",
			mock: (el) => {
				const day = new Date(2026, 9, 21);
				badgedLine(el, SELF_PUBLISH, day);
				badgedLine(el, HUNDRED_COPIES, day);
			},
		},
		{
			when: "Month 7",
			cat: SPRITES.mascotThink,
			text: "The **Overdue** chip counts both bets. **Review** opens **Time to judge?**, and **Yes** starts the verdict while **Not yet** waits.",
			mock: (el) => {
				const chips = [
					{ id: "overdue", sprite: SPRITES.stateOverdue, label: "Overdue", count: 2, target: () => null },
					{ id: "record", sprite: SPRITES.stampReview, label: "Track record", count: 1, target: () => null },
				];
				createSectionNav(el, chips);
				reviewRow(el, { decision: true, statement: "Self-publish", detail: "Book · 2 weeks overdue" });
				el.createEl("p", { cls: "vaultmate-question", text: "Time to judge?" });
				const actions = el.createDiv({ cls: "vaultmate-actions" });
				actions.createEl("button", { cls: "vaultmate-button", text: "Not yet", attr: { type: "button" } });
				actions.createEl("button", { cls: "vaultmate-button mod-cta", text: "Yes", attr: { type: "button" } });
			},
		},
		{
			when: "The verdict",
			cat: SPRITES.mascotStamp,
			text: "The outcome is **Better** and it was a **Good decision**, so you type the lesson. **Close decision** writes it, and the prediction is a hit.",
			mock: (el) => {
				createSegmentedControl(el, { label: "Outcome", choices: [{ value: "better", label: "Better" }, { value: "as-expected", label: "As expected" }, { value: "worse", label: "Worse" }], value: "better", onChange: noop });
				createSegmentedControl(el, { label: "Quality of the decision", choices: [{ value: "good", label: "Good decision" }, { value: "unsure", label: "Unsure" }, { value: "bad", label: "Bad" }], value: "good", onChange: noop });
				const lesson = el.createDiv({ cls: "vaultmate-field" });
				lesson.createSpan({ cls: "vaultmate-field-label", text: "Lesson (optional)" });
				lesson.createDiv({ cls: "vaultmate-guide-input", text: "Start the mailing list before launch" });
				createHankoStamp(el, { sprite: SPRITES.stampHit, label: "1 hit" });
			},
		},
		{
			when: "Next book",
			cat: SPRITES.mascotCheer,
			text: "The **Track record** adds up your hits and misses, your Brier score and your calibration. Your last lessons wait under **New decision**.",
			mock: (el) => {
				const stamps = el.createDiv({ cls: "vaultmate-stamp-row" });
				createHankoStamp(stamps, { sprite: SPRITES.stampHit, label: "4 hits" });
				createHankoStamp(stamps, { sprite: SPRITES.stampMiss, label: "1 miss" });
				const score = el.createDiv({ cls: "vaultmate-brier" });
				score.createSpan({ cls: "vaultmate-brier-value", text: "0.18" });
				score.createSpan({ cls: "vaultmate-brier-label", text: "Brier score · 5 predictions" });
				const row = el.createDiv({ cls: "vaultmate-calibration-row" });
				row.createSpan({ text: "You said about 60% · came true 60% · 5 predictions" });
				const bar = row.createDiv({ cls: "vaultmate-calibration-bar" });
				bar.createDiv({ cls: "vaultmate-calibration-fill" }).setCssProps({ "--vaultmate-width": "60%" });
				bar.createDiv({ cls: "vaultmate-calibration-mark" }).setCssProps({ "--vaultmate-left": "60%" });
				const hint = el.createDiv({ cls: "vaultmate-lessons-hint" });
				hint.createSpan({ cls: "vaultmate-field-label", text: "Your last lessons" });
				const lessonRow = hint.createDiv({ cls: "vaultmate-lessons-hint-row" });
				lessonRow.createSpan({ text: "Start the mailing list before launch" });
				lessonRow.createSpan({ cls: "vaultmate-muted", text: "Self-publish · 2027-05-04" });
			},
		},
	],
	write: {
		caption: "The verdict, in the note",
		lines: [
			"- [x] Self-publish #decision [outcome: better] [quality: good] ➕ 2026-10-21 📅 2027-04-21 ✅ 2027-05-04",
			"    - Review 2027-05-04: Lesson: Start the mailing list before launch",
		],
	},
	tips: [
		"Not yet sets a new review date and keeps the box open.",
		"A tagged line without a date waits under Not tracked yet until you Track it.",
		"Tidy up holds entries ticked done without a review.",
	],
	readme: README,
};
