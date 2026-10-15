// What the track forms (Promote, and New track in the idea portal) decide without the DOM: whether the
// short name is usable, whether it repeats a track of the project, whether the first task is asked.
// Pure: no Obsidian import, so Vitest tests it.
import type { TrackStatus } from "./project-note";
import { PREFILL_LENGTH, shortName } from "./short-name";

export interface TrackFormState {
	/** The cleaned short name that will be written. */
	name: string;
	/** A name is needed: the form cannot be confirmed without one. */
	valid: boolean;
	/** A track of the project already has this name: a warning, not a block. */
	duplicate: boolean;
	/** The first task (text and due date) is only asked when the track starts In progress. */
	showTask: boolean;
}

function same(a: string, b: string): boolean {
	return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function trackFormState(typed: string, status: TrackStatus, existingTitles: readonly string[]): TrackFormState {
	const name = shortName(typed);
	return { name, valid: name !== "", duplicate: name !== "" && existingTitles.some((title) => same(title, name)), showTask: status === "progress" };
}

/** The short name a form is prefilled with. */
export function prefillName(text: string): string {
	return shortName(text, PREFILL_LENGTH);
}
