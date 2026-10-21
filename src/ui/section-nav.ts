// A row of chips at the top of a long page: a sprite and a count per section; a click scrolls to the section.
import { createMark } from "./components";
import type { Sprite } from "./pixel";
import { visibleChips } from "./section-chips";
import { setIconTooltip } from "./tooltip";

export interface SectionChip {
	id: string;
	sprite: Sprite;
	label: string;
	count: number;
	/** The section's element, looked up on click (the section may be drawn after the row). */
	target(): HTMLElement | null;
	/** Runs before scrolling, to open a collapsed section. */
	open?(): void;
}

/** Draws the row into `parent` and returns it, or returns null when fewer than two sections have something to show. */
export function createSectionNav(parent: HTMLElement, chips: readonly SectionChip[]): HTMLElement | null {
	const shown = visibleChips(chips);
	if (shown.length === 0) return null;
	const row = parent.createDiv({ cls: "vaultmate-chip-row", attr: { role: "group", "aria-label": "Sections" } });
	for (const chip of shown) {
		const element = row.createEl("button", { cls: "vaultmate-button vaultmate-section-chip", attr: { type: "button" } });
		setIconTooltip(element, `Go to ${chip.label} · ${chip.count}`);
		createMark(element, chip.sprite);
		element.createSpan({ text: String(chip.count) });
		element.addEventListener("click", () => {
			chip.open?.();
			const reduce = element.win.matchMedia("(prefers-reduced-motion: reduce)").matches;
			chip.target()?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
		});
	}
	return row;
}
