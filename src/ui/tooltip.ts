// The tooltip of a control without a visible word (an icon button, a sprite chip) or with a reason to show.
// It needs the Obsidian runtime, so keep it out of the pure modules that Vitest imports.
import { displayTooltip, Platform, setTooltip } from "obsidian";

/** Obsidian's own delay is about a second; an icon alone must name itself almost at once. */
const TOOLTIP_DELAY_MS = 50;

/**
 * Names `el` for hover (after `TOOLTIP_DELAY_MS`) and for assistive technology. On a phone a long press shows
 * the same tooltip, in place of the context menu that the press would otherwise open.
 */
export function setIconTooltip(el: HTMLElement, text: string): void {
	setQuickTooltip(el, text);
	if (!Platform.isMobile) return;
	el.addEventListener("contextmenu", (event) => {
		event.preventDefault();
		displayTooltip(el, text, { delay: TOOLTIP_DELAY_MS });
	});
}

/** The quick hover tooltip alone, for a control that also shows a word. `text` is also its accessible name. */
export function setQuickTooltip(el: HTMLElement, text: string): void {
	setTooltip(el, text, { delay: TOOLTIP_DELAY_MS });
	el.setAttribute("aria-label", text);
}
