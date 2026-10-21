// Code that moves focus (the page title after a click on a tile, the main button of a panel) must not show the
// focus ring for a mouse user: Chromium shows it as soon as any key was pressed earlier in the session.
import type { Plugin } from "obsidian";

const QUIET = "vaultmate-focus-quiet";
let pointerLast = false;

/** Follows whether the last input was a pointer (true) or a key (false); stops when the plugin unloads. */
export function watchInput(plugin: Plugin): void {
	plugin.registerDomEvent(activeDocument, "pointerdown", () => (pointerLast = true), true);
	plugin.registerDomEvent(activeDocument, "keydown", () => (pointerLast = false), true);
}

/**
 * Focuses `element`. After a pointer input the ring stays hidden until a key is pressed or the element loses
 * focus (`focus({ focusVisible: false })` is not implemented by Chromium yet); after a key it shows.
 */
export function focusFromInput(element: HTMLElement): void {
	if (!pointerLast) {
		element.focus();
		return;
	}
	element.addClass(QUIET);
	const restore = (): void => {
		element.removeClass(QUIET);
		element.removeEventListener("keydown", restore);
		element.removeEventListener("blur", restore);
	};
	element.addEventListener("keydown", restore);
	element.addEventListener("blur", restore);
	element.focus();
}
