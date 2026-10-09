// Pairs of notes the user marked "Not useful": never proposed again, in either direction. Small state
// kept in `data.json` (shared between devices). Pure.

/** Two note paths in sorted order, so that a pair is the same whichever note is active. */
export type NotePair = [string, string];

export function makePair(a: string, b: string): NotePair {
	return a < b ? [a, b] : [b, a];
}

export function hasPair(pairs: readonly NotePair[], a: string, b: string): boolean {
	const [first, second] = makePair(a, b);
	return pairs.some(([x, y]) => x === first && y === second);
}

/** Adds the pair unless it is there already. */
export function addPair(pairs: readonly NotePair[], a: string, b: string): NotePair[] {
	return hasPair(pairs, a, b) ? [...pairs] : [...pairs, makePair(a, b)];
}

export function removePair(pairs: readonly NotePair[], a: string, b: string): NotePair[] {
	const [first, second] = makePair(a, b);
	return pairs.filter(([x, y]) => x !== first || y !== second);
}

/** The pairs after a note moved from `from` to `to`. */
export function renamePath(pairs: readonly NotePair[], from: string, to: string): NotePair[] {
	return pairs.reduce<NotePair[]>((list, [x, y]) => {
		const a = x === from ? to : x;
		const b = y === from ? to : y;
		return a === b ? list : addPair(list, a, b);
	}, []);
}

/** Pairs read from `data.json`: only lists of two different strings are kept, once each. */
export function cleanPairs(raw: unknown): NotePair[] {
	if (!Array.isArray(raw)) return [];
	return raw.reduce<NotePair[]>((list, item) => {
		const valid = Array.isArray(item) && item.length === 2 && typeof item[0] === "string" && typeof item[1] === "string" && item[0] !== "" && item[1] !== "" && item[0] !== item[1];
		return valid ? addPair(list, item[0] as string, item[1] as string) : list;
	}, []);
}
