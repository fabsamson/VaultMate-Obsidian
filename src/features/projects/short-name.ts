// The short name of a track: the heading text proposed when an idea becomes a track. Pure, and the same
// function, from the same table of cases (`tests/fixtures/short-name-cases.json`), as in the Android app.

/** The longest short name a track keeps. */
export const MAX_SHORT_NAME = 80;
/** The length the field is prefilled with (`shortName(text, PREFILL_LENGTH)`). */
export const PREFILL_LENGTH = 60;

// A status marker at the start (★ ⭐ 📥 🔨 ✅ 🗑), each with an optional variation selector.
const LEADING_MARKER_RE = /^(?:★|⭐|\u{1F4E5}|\u{1F528}|✅|\u{1F5D1})️? */u;

/**
 * Cleans a text into a heading: links reduced to their text, `[ ] # ^ | \` removed, whitespace collapsed,
 * one leading status marker removed, then cut to `max` code points at a word boundary (as `titleFromIdea`).
 */
export function shortName(text: string, max: number = MAX_SHORT_NAME): string {
	const plain = text
		.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
		.replace(/\[\[([^\]]*)\]\]/g, "$1")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[[\]#^|\\]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(LEADING_MARKER_RE, "")
		.trim();
	const chars = Array.from(plain);
	if (chars.length <= max) return plain;
	const cut = chars.slice(0, max).join("");
	if (/\s/.test(chars[max] ?? "")) return cut.trim();
	const space = cut.lastIndexOf(" ");
	return (space > 0 ? cut.slice(0, space) : cut).trim();
}
