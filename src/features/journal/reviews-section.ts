// The "Reviews" block of the journal page: open entries grouped by review date.
import { dueLabel, keepTogether, parseDate, startOfDay } from "../../core/dates";
import { createPanel } from "../../ui/components";
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

const UPCOMING_SHOWN = 5;

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

/** Draws the "Not tracked yet" group (plain or undated entries, to track) into a body; nothing when there are none. */
export function renderUntracked(host: ReviewsHost, body: HTMLElement, items: readonly JournalItem[]): void {
	if (items.length === 0) return;
	const today = startOfDay();
	const group = body.createDiv({ cls: "vaultmate-review-group" });
	group.createDiv({ cls: "vaultmate-review-group-title", text: `Not tracked yet · ${items.length}`, attr: { role: "heading", "aria-level": "3" } });
	for (const item of items) renderRow(host, group, item, today, true);
}

/** Returns the function that draws the reviews of `items` (open entries of one kind) into a body. */
export function createReviewsBlock(host: ReviewsHost): (body: HTMLElement, items: JournalItem[]) => void {
	let showAllUpcoming = false;
	let shownItems: JournalItem[] = [];

	const renderGroup = (body: HTMLElement, title: string, items: JournalItem[], today: Date, limit?: number): void => {
		if (items.length === 0) return;
		const group = body.createDiv({ cls: "vaultmate-review-group" });
		group.createDiv({ cls: "vaultmate-review-group-title", text: `${title} · ${items.length}`, attr: { role: "heading", "aria-level": "3" } });
		const shown = limit !== undefined && !showAllUpcoming ? items.slice(0, limit) : items;
		for (const item of shown) renderRow(host, group, item, today);
		if (shown.length < items.length) {
			const more = group.createEl("button", { cls: "vaultmate-button vaultmate-show-more", text: `Show ${items.length - shown.length} more`, attr: { type: "button" } });
			more.addEventListener("click", () => {
				showAllUpcoming = true;
				body.empty();
				renderBody(body);
			});
		}
	};

	const renderBody = (body: HTMLElement): void => {
		const today = startOfDay();
		const groups = groupByDue(shownItems, today);
		if (groups.overdue.length + groups.week.length + groups.upcoming.length === 0) {
			const panel = createPanel(body, "vaultmate-empty");
			createSprite(panel, SPRITES.mascotSleep, 96);
			panel.createEl("p", { cls: "vaultmate-empty-title", text: "Nothing to review" });
			panel.createEl("p", { cls: "vaultmate-muted", text: `End a line with #${host.decisionTag()}, or run New decision.` });
			return;
		}
		renderGroup(body, "Overdue", groups.overdue, today);
		renderGroup(body, "This week", groups.week, today);
		renderGroup(body, "Upcoming", groups.upcoming, today, UPCOMING_SHOWN);
	};

	return (body, items) => {
		showAllUpcoming = false;
		shownItems = items;
		renderBody(body);
	};
}
