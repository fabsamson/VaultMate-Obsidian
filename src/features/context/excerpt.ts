// The passage of a note shown on a connection card: about two lines around the words both notes use.
// Pure: the Markdown is cleaned like the tokenizer does, and the positions to emphasise are returned.
import { cleanText, foldText, hasCjk } from "./tokenizer";

export const EXCERPT_LENGTH = 180;
/** Characters kept before the first hit of the passage, so the hit has some context. */
const LEAD = 40;

export interface Excerpt {
	text: string;
	/** `[start, end)` positions in `text` to emphasise, in order, without overlap. */
	marks: [number, number][];
}

interface Hit {
	start: number;
	end: number;
	/** The term or phrase that matched. */
	needle: string;
}

/**
 * Prose of a note on one line: no frontmatter, code or embeds, no headings (the card shows the title),
 * no list or emphasis marks. A plain link keeps the name of its note, so the sentence still reads.
 */
function plainText(markdown: string): string {
	const named = markdown.replace(/(!?)\[\[([^\]|#]*)(?:#[^\]|]*)?\]\]/g, (link: string, embed: string, target: string) => (embed ? link : (target.split("/").pop() ?? target)));
	return cleanText(named)
		.split("\n")
		.filter((line) => !/^\s*#{1,6}\s/.test(line))
		.map((line) => line.replace(/^\s*(?:>\s*|[-*+]\s+(?:\[.\]\s+)?|\d+[.)]\s+)/, ""))
		.join(" ")
		.replace(/[*~=]{2,}|\*/g, "")
		.replace(/\s+/g, " ")
		.replace(/ ([.,;:!?])/g, "$1")
		.trim();
}

function findHits(plain: string, terms: readonly string[], phrases: readonly string[]): Hit[] {
	const hits: Hit[] = [];
	const wanted = new Set(terms.filter((term) => !hasCjk(term)));
	for (const match of plain.matchAll(/[\p{L}\p{N}]+/gu)) {
		const folded = foldText(match[0]);
		if (wanted.has(folded)) hits.push({ start: match.index, end: match.index + match[0].length, needle: folded });
	}
	const lower = plain.toLowerCase();
	const literal = [...terms.filter(hasCjk), ...phrases.filter((phrase) => phrase.trim().length >= 2)];
	for (const needle of literal) {
		const text = needle.trim().toLowerCase();
		for (let at = lower.indexOf(text); at >= 0; at = lower.indexOf(text, at + text.length)) hits.push({ start: at, end: at + text.length, needle });
	}
	return hits.sort((a, b) => a.start - b.start || b.end - a.end);
}

/** Moves a cut to the nearest space before it, unless that would lose most of the passage. */
function snap(text: string, at: number, floor: number): number {
	if (at <= 0 || at >= text.length) return Math.max(0, Math.min(at, text.length));
	const space = text.lastIndexOf(" ", at);
	return space > floor ? space + 1 : at;
}

/**
 * The passage of about `length` characters with the most distinct hits of the terms (shared words) and
 * phrases (for example the other note's title, for an unlinked mention); the first lines when nothing hits.
 */
export function excerpt(markdown: string, terms: readonly string[], phrases: readonly string[] = [], length = EXCERPT_LENGTH): Excerpt {
	const plain = plainText(markdown);
	const hits = findHits(plain, terms, phrases);
	let from = 0;
	if (plain.length > length && hits.length > 0) {
		let best = -1;
		for (const hit of hits) {
			const start = snap(plain, Math.max(0, hit.start - LEAD), 0);
			const inside = hits.filter((other) => other.start >= start && other.end <= start + length);
			const score = new Set(inside.map((other) => other.needle)).size * 1000 + inside.length;
			if (score > best) {
				best = score;
				from = start;
			}
		}
	}
	const to = plain.length <= from + length ? plain.length : snap(plain, from + length, from + length / 2);
	const lead = from > 0 ? "… " : "";
	const text = `${lead}${plain.slice(from, to).trim()}${to < plain.length ? " …" : ""}`;
	const shift = lead.length - from;
	const marks: [number, number][] = [];
	for (const hit of hits) {
		if (hit.start < from || hit.end > to) continue;
		const last = marks[marks.length - 1];
		if (last && hit.start + shift < last[1]) last[1] = Math.max(last[1], hit.end + shift);
		else marks.push([hit.start + shift, hit.end + shift]);
	}
	return { text, marks };
}

/** The excerpt cut into pieces, each flagged when it is a hit to emphasise. */
export function excerptParts(found: Excerpt): { text: string; hit: boolean }[] {
	const parts: { text: string; hit: boolean }[] = [];
	let at = 0;
	for (const [start, end] of found.marks) {
		if (start > at) parts.push({ text: found.text.slice(at, start), hit: false });
		parts.push({ text: found.text.slice(start, end), hit: true });
		at = end;
	}
	if (at < found.text.length) parts.push({ text: found.text.slice(at), hit: false });
	return parts;
}
