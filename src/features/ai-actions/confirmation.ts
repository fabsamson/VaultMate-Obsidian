// Per-action consent: an action must be confirmed once, and again whenever its source list changes.
// Stored in data.json as action file path -> sorted source list. Pure.

export type Confirmations = Record<string, string[]>;

function sortedSources(sources: readonly string[]): string[] {
	return [...new Set(sources)].sort();
}

export function isConfirmed(confirmations: Confirmations, path: string, sources: readonly string[]): boolean {
	const saved = confirmations[path];
	const current = sortedSources(sources);
	return saved !== undefined && saved.length === current.length && saved.every((source, index) => source === current[index]);
}

/** A copy of `confirmations` where `path` is confirmed for exactly these sources. */
export function withConfirmation(confirmations: Confirmations, path: string, sources: readonly string[]): Confirmations {
	return { ...confirmations, [path]: sortedSources(sources) };
}
