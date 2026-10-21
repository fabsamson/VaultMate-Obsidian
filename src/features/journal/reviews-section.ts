// The "Reviews" block of the journal page: open entries grouped by review date.
import { dueLabel, keepTogether, parseDate, startOfDay } from "../../core/dates";
import { createInfoPanel } from "../../ui/components";
import { createSprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import type { JournalItem } from "./journal-index";
import { groupByDue, kindName } from "./journal-line";

export interface ReviewsHost {
	decisionTag(): string;
	/** Opens the note at the entry's line. */
	openItem(item: JournalItem): void;
	openReview(item: JournalItem): void;
	/** Tracks an undated or plain line as the kind of its tag: the track form, then the line is rewritten. */
	track(item: JournalItem): void;
}

/** Rows shown in the long groups (Not tracked yet, Upcoming) before "Show N more". */
const SHOWN = 5;

function noteName(path: string): string {
	const name = path.split("/").pop() ?? path;
	return name.replace(/\.md$/i, "");
}

function renderRow(host: ReviewsHost, list: HTMLElement, item: JournalItem, today: Date, untracked = false): void {
	const { entry } = item;
	const row = list.createDiv({ cls: "vaultmate-review-row" });
	createSprite(row, entry.kind === "decision" ? SPRITES.moduleDecision : SPRITES.modulePrediction, 24);
	const main = row.createEl("button", { cls: "vaultmate-review-main", attr: { type: "button" } });
	main.createSpan({ cls: "vaultmate-review-statement", text: entry.statement || "(no text)" });
	if (entry.answer !== null) main.createSpan({ cls: "vaultmate-muted", text: `${entry.kind === "decision" ? "Your decision" : "Your answer"}: ${entry.answer}` });
	const due = entry.due === null ? null : parseDate(entry.due);
	main.createSpan({ cls: "vaultmate-muted", text: `${noteName(item.path)} · ${due ? keepTogether(dueLabel(due, today)) : "no review date"}` });
	main.addEventListener("click", () => host.openItem(item));
	if (untracked) {
		const track = row.createEl("button", { cls: "vaultmate-button", text: `Track as ${kindName(entry.kind)}`, attr: { type: "button", "aria-label": `Track as ${kindName(entry.kind)}: ${entry.statement}` } });
		track.addEventListener("click", () => host.track(item));
		return;
	}
	const review = row.createEl("button", { cls: "vaultmate-button", text: "Review", attr: { type: "button", "aria-label": `Review ${kindName(entry.kind)}: ${entry.statement}` } });
	review.addEventListener("click", () => host.openReview(item));
}

/** Returns the function that draws the reviews of `items` (open entries of one kind) into a body. */
export function createReviewsBlock(host: ReviewsHost): (body: HTMLElement, items: JournalItem[]) => void {
	const expanded = new Set<string>();
	let shownItems: JournalItem[] = [];

	const renderGroup = (body: HTMLElement, title: string, items: JournalItem[], today: Date, limit?: number, untracked = false): void => {
		if (items.length === 0) return;
		const group = body.createDiv({ cls: "vaultmate-review-group" });
		group.createDiv({ cls: "vaultmate-review-group-title", text: `${title} · ${items.length}`, attr: { role: "heading", "aria-level": "3" } });
		const shown = limit !== undefined && !expanded.has(title) ? items.slice(0, limit) : items;
		for (const item of shown) renderRow(host, group, item, today, untracked);
		if (shown.length < items.length) {
			const more = group.createEl("button", { cls: "vaultmate-button vaultmate-show-more", text: `Show ${items.length - shown.length} more`, attr: { type: "button" } });
			more.addEventListener("click", () => {
				expanded.add(title);
				body.empty();
				renderBody(body);
			});
		}
	};

	const renderBody = (body: HTMLElement): void => {
		const today = startOfDay();
		const groups = groupByDue(shownItems, today);
		if (groups.undated.length + groups.overdue.length + groups.week.length + groups.upcoming.length === 0) {
			createInfoPanel(body, { sprite: SPRITES.mascotSleep, title: "Nothing to review", text: `End a line with #${host.decisionTag()}, or run New decision.` });
			return;
		}
		renderGroup(body, "Not tracked yet", groups.undated, today, SHOWN, true);
		renderGroup(body, "Overdue", groups.overdue, today);
		renderGroup(body, "This week", groups.week, today);
		renderGroup(body, "Upcoming", groups.upcoming, today, SHOWN);
	};

	return (body, items) => {
		expanded.clear();
		shownItems = items;
		renderBody(body);
	};
}
