// The "Closed without a review" group of the journal page: entries ticked done without the outcome a review
// writes (plan §15, A1). Each row offers to add the outcome or to take the entry out of the list.
import { createSprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import type { JournalItem } from "./journal-index";
import { closedWithoutReview, kindName } from "./journal-line";

export interface ClosedHost {
	/** Opens the note at the entry's line. */
	openItem(item: JournalItem): void;
	/** Opens the review form in late mode. */
	addOutcome(item: JournalItem): void;
	/** Rewrites the entry's `[x]` into `[-]`. */
	notReviewable(item: JournalItem): void;
}

function noteName(path: string): string {
	const name = path.split("/").pop() ?? path;
	return name.replace(/\.md$/i, "");
}

/** Returns the function that draws the entries of `items` closed without a review into a body, and the group's element (null when there are none). */
export function createClosedBlock(host: ClosedHost): (body: HTMLElement, items: JournalItem[]) => HTMLElement | null {
	return (body, items) => {
		const closed = items.filter((item) => closedWithoutReview(item.entry));
		if (closed.length === 0) return null;
		const group = body.createDiv({ cls: "vaultmate-review-group" });
		group.createDiv({ cls: "vaultmate-review-group-title", text: `Closed without a review · ${closed.length}`, attr: { role: "heading", "aria-level": "3" } });
		for (const item of closed) {
			const { entry } = item;
			const row = group.createDiv({ cls: "vaultmate-review-row" });
			createSprite(row, entry.kind === "decision" ? SPRITES.moduleDecision : SPRITES.modulePrediction, 24);
			const main = row.createEl("button", { cls: "vaultmate-review-main", attr: { type: "button" } });
			main.createSpan({ cls: "vaultmate-review-statement", text: entry.statement || "(no text)" });
			main.createSpan({ cls: "vaultmate-muted", text: `${noteName(item.path)} · closed ${entry.done ?? "without a date"}` });
			main.addEventListener("click", () => host.openItem(item));
			const add = row.createEl("button", { cls: "vaultmate-button", text: "Add the outcome", attr: { type: "button", "aria-label": `Add the outcome of ${kindName(entry.kind)}: ${entry.statement}` } });
			add.addEventListener("click", () => host.addOutcome(item));
			const skip = row.createEl("button", { cls: "vaultmate-button", text: "Not reviewable", attr: { type: "button", title: "Cancel the box: the entry leaves this list and your statistics", "aria-label": `Not reviewable: ${entry.statement}` } });
			skip.addEventListener("click", () => host.notReviewable(item));
		}
		return group;
	};
}
