// The arrow-key rule of a radio group, apart from the DOM so Vitest can test it.

/**
 * Index to focus after an arrow, Home or End key in a radio group, or null for any other key (or when no
 * option can take focus). Arrows wrap; options flagged in `disabled` are skipped.
 */
export function nextChoiceIndex(key: string, current: number, count: number, disabled: readonly boolean[] = []): number | null {
	const from = (start: number, step: number): number | null => {
		for (let tried = 0; tried < count; tried++) {
			const index = (((start + step * tried) % count) + count) % count;
			if (!disabled[index]) return index;
		}
		return null;
	};
	switch (key) {
		case "ArrowRight":
		case "ArrowDown":
			return from(current + 1, 1);
		case "ArrowLeft":
		case "ArrowUp":
			return from(current - 1, -1);
		case "Home":
			return from(0, 1);
		case "End":
			return from(count - 1, -1);
		default:
			return null;
	}
}
