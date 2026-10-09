// The `suggestions` output type: the contract appended to the prompt, a tolerant parser and the guard.
// Whatever the model says, only suggestions of the expected shape and length survive, titles already in the
// vault are dropped, and the UI never shows free AI prose. Pure.
import { normalizeTitle, ratingLabel } from "./collection";
import type { RatedTitle } from "./collection-profile";
import { jsonCandidates } from "./questions";

export interface Suggestion {
	title: string;
	year: string | null;
	creator: string | null;
	/** Titles from the user's vault that explain the suggestion (at most 2). */
	because: string[];
	why: string | null;
}

export const MAX_TITLE_LENGTH = 120;
export const MAX_CREATOR_LENGTH = 80;
export const MAX_WHY_LENGTH = 160;
export const MAX_BECAUSE = 2;
/** Longest answer the parser looks at; a real answer is far shorter. */
const MAX_ANSWER_LENGTH = 50_000;

/** Appended after the user's prompt, so a custom prompt cannot break the parsing. */
export function suggestionsContract(count: number): string {
	return [
		"Output contract (mandatory; it overrides any instruction above about the format of your answer):",
		'Return only a JSON object, with no text before or after it and no code fence: {"suggestions":[{"title":"...","year":"2010","creator":"...","because":["..."],"why":"..."}]}',
		`- At most ${count} items in "suggestions".`,
		`- "title" is the exact title of a real work, on a single line, at most ${MAX_TITLE_LENGTH} characters.`,
		'- "year" is the four-digit year of release, or "" if you are not sure.',
		`- "creator" is the main director, author, studio or developer, at most ${MAX_CREATOR_LENGTH} characters, or "" if you are not sure.`,
		`- "because" lists one or two titles copied exactly from the user's rated list that this suggestion is close to (at most ${MAX_BECAUSE}).`,
		`- "why" is one short sentence, at most ${MAX_WHY_LENGTH} characters, on a single line.`,
		"- Never suggest a title from the \"Already in the vault\" list.",
	].join("\n");
}

// ---- Guard ---------------------------------------------------------------------------------------------------

function length(text: string): number {
	return Array.from(text).length;
}

/** One line of text with at least one letter or digit, at most `max` characters, or null. */
function oneLine(value: unknown, max: number): string | null {
	if (typeof value !== "string") return null;
	const text = value.trim();
	if (!text || /[\r\n]/.test(text) || length(text) > max || !/[\p{L}\p{N}]/u.test(text)) return null;
	return text;
}

/** One sentence: a sentence end followed by more text is a second sentence. */
function oneSentence(value: unknown, max: number): string | null {
	const text = oneLine(value, max);
	if (!text) return null;
	const inner = text.slice(0, -1);
	if (/[.!?]["')\]»]*\s+\S/.test(inner) || /[。！？]\S/.test(inner)) return null;
	return text;
}

function guardYear(value: unknown): string | null {
	const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
	return /^\d{4}$/.test(text) ? text : null;
}

/** A trailing "(1999)" is the year, not part of the title. */
function splitTitleYear(title: string): { title: string; year: string | null } {
	const match = /^(.*\S)\s*\((\d{4})\)$/.exec(title);
	return match ? { title: match[1] ?? title, year: match[2] ?? null } : { title, year: null };
}

export interface SuggestionOptions {
	/** Most suggestions to keep. */
	count: number;
	/** The rated titles of the profile: the only ones `because` may name. */
	rated: readonly RatedTitle[];
	/** Titles that must not be suggested: the vault's titles of this type and the Not interested ones. */
	excluded: readonly string[];
}

/** Parses the model's answer and keeps only suggestions that pass the guard, at most `count`. A free-text answer gives none. */
export function parseSuggestions(answer: string, options: SuggestionOptions): Suggestion[] {
	let items: unknown[] = [];
	for (const candidate of jsonCandidates(answer.slice(0, MAX_ANSWER_LENGTH))) {
		const list = Array.isArray(candidate) ? candidate : (candidate as { suggestions?: unknown } | null)?.suggestions;
		if (Array.isArray(list)) {
			items = list as unknown[];
			break;
		}
	}
	const ratedByKey = new Map(options.rated.map((item) => [normalizeTitle(item.title), item.title]));
	const blocked = new Set(options.excluded.map(normalizeTitle));
	const seen = new Set<string>();
	const kept: Suggestion[] = [];
	for (const item of items) {
		if (kept.length >= options.count) break;
		if (typeof item !== "object" || item === null) continue;
		const raw = item as Record<string, unknown>;
		const titleText = oneLine(raw.title, MAX_TITLE_LENGTH + 7);
		if (!titleText) continue;
		const { title, year: titleYear } = splitTitleYear(titleText);
		const key = normalizeTitle(title);
		if (!key || length(title) > MAX_TITLE_LENGTH || blocked.has(key) || seen.has(key)) continue;
		seen.add(key);
		const because: string[] = [];
		for (const name of Array.isArray(raw.because) ? raw.because : typeof raw.because === "string" ? [raw.because] : []) {
			const real = typeof name === "string" ? ratedByKey.get(normalizeTitle(name)) : undefined;
			if (real !== undefined && !because.includes(real) && because.length < MAX_BECAUSE) because.push(real);
		}
		kept.push({
			title,
			year: guardYear(raw.year) ?? titleYear,
			creator: oneLine(raw.creator, MAX_CREATOR_LENGTH),
			because,
			why: oneSentence(raw.why, MAX_WHY_LENGTH),
		});
	}
	return kept;
}

// ---- Result card text -----------------------------------------------------------------------------------------

/** "Because you rated Heat 9/10", with the real rating from the vault, or null when no reason survived the guard. */
export function becauseLine(suggestion: Suggestion, rated: readonly RatedTitle[]): string | null {
	const first = suggestion.because[0];
	const found = first === undefined ? undefined : rated.find((item) => item.title === first);
	return found ? `Because you rated ${found.title} ${ratingLabel(found.rating)}` : null;
}

/** A web search for the suggestion, opened in the user's browser. */
export function searchUrl(suggestion: Suggestion): string {
	const query = [suggestion.title, suggestion.year, suggestion.creator].filter((part) => part).join(" ");
	return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}
