// The rule of the section navigation rows, kept apart from the DOM code so tests can load it.

/** The chips worth showing: a section with nothing has none, and a row of fewer than two chips navigates nowhere. */
export function visibleChips<T extends { count: number }>(chips: readonly T[]): T[] {
	const shown = chips.filter((chip) => chip.count > 0);
	return shown.length >= 2 ? shown : [];
}
