// The search field at the top of a hub page (Projects, Ideas, Decisions and predictions). The page keeps the
// query in memory in a `PageSearchState`; typing re-renders only the list area, never the field itself, so
// focus, cursor and IME composition stay put.
import { SearchComponent } from "obsidian";

import { createInfoPanel } from "./components";
import { SPRITES } from "./sprites";

/** The query of one page, kept while the hub view lives (not saved with the workspace). */
export interface PageSearchState {
	query: string;
}

export interface PageSearchField {
	setPlaceholder(text: string): void;
}

/** Wait after the last keystroke before the list is filtered. */
const DEBOUNCE_MS = 150;

/**
 * Adds the field under the page's switchers. `onChange` redraws the list area; it runs after a short pause,
 * after the IME commits a composition, and at once when the field is cleared (the cross or Escape).
 */
export function addPageSearch(parent: HTMLElement, state: PageSearchState, placeholder: string, onChange: () => void): PageSearchField {
	const row = parent.createDiv({ cls: "vaultmate-page-search" });
	const search = new SearchComponent(row).setPlaceholder(placeholder).setValue(state.query);
	search.inputEl.setAttribute("aria-label", placeholder);
	let timer: number | null = null;
	let composing = false;
	const apply = (): void => {
		if (timer !== null) row.win.clearTimeout(timer);
		timer = null;
		if (state.query === search.getValue()) return;
		state.query = search.getValue();
		onChange();
	};
	const later = (): void => {
		if (timer !== null) row.win.clearTimeout(timer);
		timer = row.win.setTimeout(apply, DEBOUNCE_MS);
	};
	search.onChange((value) => {
		if (composing) return;
		if (value === "") apply();
		else later();
	});
	search.inputEl.addEventListener("compositionstart", () => (composing = true));
	search.inputEl.addEventListener("compositionend", () => {
		composing = false;
		later();
	});
	search.inputEl.addEventListener("keydown", (event) => {
		if (event.key !== "Escape" || search.getValue() === "") return;
		event.preventDefault();
		event.stopPropagation();
		search.setValue("");
		apply();
	});
	return { setPlaceholder: (text) => { search.setPlaceholder(text); search.inputEl.setAttribute("aria-label", text); } };
}

/** The panel shown when the query leaves nothing on the page. */
export function createNoMatch(parent: HTMLElement, query: string): HTMLElement {
	return createInfoPanel(parent, { sprite: SPRITES.mascotSleep, title: `Nothing matches \u201C${query.trim()}\u201D`, compact: true });
}
