// The `items` output type: a short list of next actions. The contract appended to the prompt, a tolerant
// parser and the guard. Whatever the model says, only single-line plain texts survive (they become task
// lines), and the UI never shows free AI prose. Pure.
import { jsonCandidates, normalizeForCompare } from "./questions";

export const MAX_ITEM_LENGTH = 100;
/** Longest answer the parser looks at; a real answer is far shorter. */
const MAX_ANSWER_LENGTH = 50_000;

/** Appended after the user's prompt, so a custom prompt cannot break the parsing. */
export function itemsContract(count: number): string {
	return [
		"Output contract (mandatory; it overrides any instruction above about the format of your answer):",
		'Return only a JSON object, with no text before or after it and no code fence: {"items":["..."]}',
		`- At most ${count} strings in "items".`,
		`- Each string is one action on a single line, at most ${MAX_ITEM_LENGTH} characters.`,
		"- Plain text only: no list marker, no checkbox, no heading, no date, no emoji, no tag.",
	].join("\n");
}

// ---- Fallback: list lines -----------------------------------------------------------------------------------

/** Only lines written as list items count: a sentence of introduction is not an action. The marker is removed. */
function listLines(text: string): string[] {
	return text.split(/\r?\n/).flatMap((line) => {
		const match = /^\s*(?:[-*+•]|\d{1,3}[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(line);
		return match?.[1] ? [match[1].trim().replace(/^(\*\*|__)(.*)\1$/, "$2")] : [];
	});
}

// ---- Guard ---------------------------------------------------------------------------------------------------

const LIST_OR_HEADING_START = /^(?:[-*+•>#]|\d{1,3}[.)]|\[[ xX]\])/;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/;
// The Tasks plugin's date, recurrence, priority and dependency emojis.
const TASKS_EMOJI = /[\u{1F4C5}\u{23F3}\u{1F6EB}\u{2795}✅❌\u{1F501}\u{23EB}\u{1F53C}\u{1F53D}\u{1F53A}\u{23EC}\u{1F194}⛔\u{1F3C1}]/u;
const TAG = /(?:^|\s)#[\p{L}\p{N}_/-]/u;

/** The item as it will be shown, or null when it is not one plain line of at most 100 characters. */
function guardItem(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const text = value.trim();
	if (!text || /[\r\n]/.test(text) || Array.from(text).length > MAX_ITEM_LENGTH) return null;
	if (!/[\p{L}\p{N}]/u.test(text)) return null;
	if (LIST_OR_HEADING_START.test(text) || ISO_DATE.test(text) || TASKS_EMOJI.test(text) || TAG.test(text)) return null;
	// A line that introduces a list ("Here are three steps:") is chat, not an action.
	if (/[:：]$/.test(text)) return null;
	return text;
}

export interface ItemsOptions {
	/** Most items to keep. */
	count: number;
	/** Texts already in the track: an item that repeats one is not offered again. */
	existing?: readonly string[];
}

/** Parses the model's answer and keeps only items that pass the guard, at most `count`. */
export function parseItems(answer: string, options: ItemsOptions): string[] {
	const text = answer.slice(0, MAX_ANSWER_LENGTH);
	let candidates: unknown[] | null = null;
	for (const candidate of jsonCandidates(text)) {
		const list = Array.isArray(candidate) ? candidate : (candidate as { items?: unknown } | null)?.items;
		if (Array.isArray(list)) {
			candidates = list as unknown[];
			break;
		}
	}
	const seen = new Set((options.existing ?? []).map(normalizeForCompare));
	const kept: string[] = [];
	for (const candidate of candidates ?? listLines(text)) {
		if (kept.length >= options.count) break;
		const item = guardItem(candidate);
		if (!item) continue;
		const key = normalizeForCompare(item);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		kept.push(item);
	}
	return kept;
}
