// When a page guide opens by itself (the first visit of a page) and how a guide is marked as seen. Pure.

export interface AutoOpenState {
	/** The guide of the page now shown. */
	id: string;
	/** `guides.seen`. */
	seen: readonly string[];
	/** `guides.autoOpen`. */
	autoOpen: boolean;
	/** Another window is open (a review, a form, a guide). */
	modalOpen: boolean;
	/** The page was opened by the Weekly review: it must not be interrupted. */
	quiet: boolean;
}

export function shouldAutoOpen(state: AutoOpenState): boolean {
	return state.autoOpen && !state.quiet && !state.modalOpen && !state.seen.includes(state.id);
}

/** The new list of seen guides, or null when `id` is already in it (nothing to save). */
export function withSeen(seen: readonly string[], id: string): string[] | null {
	return seen.includes(id) ? null : [...seen, id];
}
