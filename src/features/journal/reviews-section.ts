// The hub's "Reviews" section: open decisions and predictions grouped by review date.
import { dueLabel, parseDate, startOfDay } from "../../core/dates";
import { createPanel } from "../../ui/components";
import type { HubSection } from "../../ui/hub-view";
import { createSprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import type { JournalItem } from "./journal-index";
import { groupByDue, kindName } from "./journal-line";

export interface ReviewsHost {
	enabled(): boolean;
	entries(): JournalItem[];
	decisionTag(): string;
	/** Opens the note at the entry's line. */
	openItem(item: JournalItem): void;
	openReview(item: JournalItem): void;
}

const UPCOMING_SHOWN = 5;

function noteName(path: string): string {
	const name = path.split("/").pop() ?? path;
	return name.replace(/\.md$/i, "");
}

export function createReviewsSection(host: ReviewsHost): HubSection {
	let showAllUpcoming = false;

	const renderRow = (list: HTMLElement, item: JournalItem, today: Date): void => {
		const { entry } = item;
		const row = list.createDiv({ cls: "vaultmate-review-row" });
		createSprite(row, entry.kind === "decision" ? SPRITES.moduleDecision : SPRITES.modulePrediction, 24);
		const main = row.createEl("button", { cls: "vaultmate-review-main", attr: { type: "button" } });
		main.createSpan({ cls: "vaultmate-review-kind", text: kindName(entry.kind) });
		main.createSpan({ cls: "vaultmate-review-statement", text: entry.statement || "(no text)" });
		const due = entry.due === null ? null : parseDate(entry.due);
		main.createSpan({ cls: "vaultmate-muted", text: `${noteName(item.path)} · ${due ? dueLabel(due, today) : "no review date"}` });
		main.addEventListener("click", () => host.openItem(item));
		const review = row.createEl("button", { cls: "vaultmate-button", text: "Review", attr: { type: "button", "aria-label": `Review ${kindName(entry.kind)}: ${entry.statement}` } });
		review.addEventListener("click", () => host.openReview(item));
	};

	const renderGroup = (body: HTMLElement, title: string, items: JournalItem[], today: Date, limit?: number): void => {
		if (items.length === 0) return;
		const group = body.createDiv({ cls: "vaultmate-review-group" });
		group.createDiv({ cls: "vaultmate-review-group-title", text: `${title} · ${items.length}`, attr: { role: "heading", "aria-level": "3" } });
		const shown = limit !== undefined && !showAllUpcoming ? items.slice(0, limit) : items;
		for (const item of shown) renderRow(group, item, today);
		if (shown.length < items.length) {
			const more = group.createEl("button", { cls: "vaultmate-link", text: `${items.length - shown.length} more`, attr: { type: "button" } });
			more.addEventListener("click", () => {
				showAllUpcoming = true;
				body.empty();
				renderBody(body);
			});
		}
	};

	const renderBody = (body: HTMLElement): void => {
		const today = startOfDay();
		const groups = groupByDue(host.entries(), today);
		if (groups.overdue.length + groups.week.length + groups.upcoming.length + groups.undated.length === 0) {
			const panel = createPanel(body, "vaultmate-empty");
			createSprite(panel, SPRITES.mascotSleep, 96);
			panel.createEl("p", { cls: "vaultmate-empty-title", text: "Nothing to review" });
			panel.createEl("p", { cls: "vaultmate-muted", text: `End a line with #${host.decisionTag()}, or run New decision.` });
			return;
		}
		renderGroup(body, "Overdue", groups.overdue, today);
		renderGroup(body, "This week", groups.week, today);
		renderGroup(body, "Upcoming", groups.upcoming, today, UPCOMING_SHOWN);
		renderGroup(body, "No review date", groups.undated, today);
	};

	return {
		id: "journal-reviews",
		order: 10,
		label: "Reviews",
		kanji: "省",
		enabled: () => host.enabled(),
		render: (body) => {
			showAllUpcoming = false;
			renderBody(body);
		},
	};
}
