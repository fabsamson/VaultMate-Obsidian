// The bridge signals of the connections finder (unlinked mention, same person or place, nearby place). Each
// one looks at the active note and returns, for the notes it finds, a strength between 0 and 1 and the
// reason in words. `engine.ts` weights and adds them to the shared terms of `terms.ts`.
import { rarity, type GraphContext } from "./graph";
import { haversineKm, type NoteMeta } from "./note-meta";
import type { TextIndex } from "./text-index";
import { cleanText, hasCjk, tokenize } from "./tokenizer";

export interface Signal {
	/** 0 to 1. */
	strength: number;
	text: string;
	/** The signal rests on a single-word name, which is not enough alone: it counts only next to shared terms. */
	weak?: boolean;
}

export type Signals = Map<string, Signal>;

function add(signals: Signals, path: string, strength: number, text: string, weak = false): void {
	signals.set(path, weak ? { strength: Math.min(1, strength), text, weak } : { strength: Math.min(1, strength), text });
}

/** The notes that carry each key (a property value). */
function groupBy(notes: ReadonlyMap<string, NoteMeta>, keys: (note: NoteMeta) => string[]): Map<string, Set<string>> {
	const groups = new Map<string, Set<string>>();
	for (const note of notes.values()) {
		for (const key of keys(note)) {
			let paths = groups.get(key);
			if (!paths) groups.set(key, (paths = new Set()));
			paths.add(note.path);
		}
	}
	return groups;
}

/** Ignore tags and values carried by a quarter of the notes (but always allow up to 20 notes). */
function tooCommon(total: number, count: number): boolean {
	return count > Math.max(20, total / 4);
}

/** `authors` -> `author`; names that end in `ss` or are short stay as they are. */
export function singular(property: string): string {
	return property.length > 3 && property.endsWith("s") && !property.endsWith("ss") ? property.slice(0, -1) : property;
}

/** Notes with the same value in one of the people or place properties. */
export function sameProperty(context: GraphContext): Signals {
	const total = context.notes.size;
	const groups = groupBy(context.notes, (note) => note.people.map((value) => value.key));
	const found = new Map<string, { property: string; label: string; idf: number }[]>();
	for (const value of context.active.people) {
		const paths = groups.get(value.key);
		if (!paths || tooCommon(total, paths.size)) continue;
		const idf = rarity(total, paths.size);
		for (const path of paths) {
			if (path === context.active.path) continue;
			let list = found.get(path);
			if (!list) found.set(path, (list = []));
			list.push({ property: value.property, label: value.label, idf });
		}
	}
	const signals: Signals = new Map();
	for (const [path, list] of found) {
		list.sort((a, b) => b.idf - a.idf);
		const property = list[0]?.property ?? "";
		const labels = [...new Set(list.filter((item) => item.property === property).map((item) => item.label))].slice(0, 2);
		add(signals, path, list.reduce((sum, item) => sum + 0.4 + 0.6 * item.idf, 0), `Same ${singular(property)}: ${labels.join(", ")}`);
	}
	return signals;
}

export function formatDistance(km: number): string {
	return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m away` : `${km.toFixed(1)} km away`;
}

/** Notes with coordinates under a kilometre from the active note's. */
export function geoProximity(context: GraphContext): Signals {
	const signals: Signals = new Map();
	const { geo } = context.active;
	if (!geo) return signals;
	for (const note of context.notes.values()) {
		if (!note.geo || note.path === context.active.path) continue;
		const km = haversineKm(geo, note.geo);
		if (km < 1) add(signals, note.path, 1, formatDistance(km));
	}
	return signals;
}

/** A name can be searched as a phrase when it has a few letters, or any Chinese or Japanese. */
function nameTokens(name: string): string[] | null {
	const tokens = tokenize(name);
	if (tokens.length === 0) return null;
	return tokens.join("").length >= 4 || hasCjk(name) ? tokens : null;
}

/** `2026-10`, `2026-10-05`, `2026-W41`: the notes of a period are named by their date, and dates fill the vault. */
const DATE_NAME = /^\d{4}-(?:W\d{1,2}|\d{1,2}(?:-\d{1,2})?)$/i;

function names(note: NoteMeta): { label: string; phrase: string }[] {
	return [note.title, ...note.aliases].flatMap((label) => {
		if (!/\p{L}/u.test(label) || DATE_NAME.test(label.trim())) return [];
		const tokens = nameTokens(label);
		return tokens ? [{ label, phrase: ` ${tokens.join(" ")} ` }] : [];
	});
}

/** A name of one word (not Chinese or Japanese), such as "Processes": a note often uses it without meaning the note. */
function isSingleWord(label: string): boolean {
	return !hasCjk(label) && tokenize(label).length === 1;
}

/** A single word that many notes use ("notice") says nothing when it is a title: more than 3 notes and more than 1% of them. */
function isCommonWord(text: TextIndex, phrase: string): boolean {
	const word = phrase.trim();
	if (word.includes(" ")) return false;
	return text.bodyPaths(word).length > Math.max(3, text.size * 0.01);
}

const MAX_VERIFIED_READS = 40;

function proseTokens(markdown: string): string[] {
	return tokenize(cleanText(markdown));
}

export interface MentionInput {
	context: GraphContext;
	text: TextIndex;
	/** The active note's Markdown. */
	activeText: string;
	/** Notes to leave out (already linked either way). */
	skip: ReadonlySet<string>;
	/** Reads a note's Markdown, to check that a name really appears in its prose. */
	readText: (path: string) => Promise<string>;
}

/**
 * Unlinked mentions in both directions: another note's prose names the active note (title or alias),
 * or the active note's prose names another note. Candidates come from the index; a candidate in the
 * first direction is confirmed by reading its text, so at most a few dozen reads happen.
 */
export async function unlinkedMentions(input: MentionInput): Promise<Signals> {
	const { context, text, skip } = input;
	const namesOfActive = names(context.active).filter((name) => !isCommonWord(text, name.phrase));
	const mentionsActive = new Map<string, string>(); // note -> the name of the active note it uses
	const mentionedByActive = new Map<string, string>();

	// The active note names another note.
	const activeTokens = proseTokens(input.activeText);
	const activeSet = new Set(activeTokens);
	const activeString = ` ${activeTokens.join(" ")} `;
	for (const note of context.notes.values()) {
		if (note.path === context.active.path || skip.has(note.path)) continue;
		for (const name of names(note)) {
			const first = name.phrase.trim().split(" ")[0] ?? "";
			if (activeSet.has(first) && activeString.includes(name.phrase) && !isCommonWord(text, name.phrase)) {
				mentionedByActive.set(note.path, name.label);
				break;
			}
		}
	}

	// Another note names the active note: candidates hold every token of a name in their body.
	for (const name of namesOfActive) {
		const tokens = name.phrase.trim().split(" ");
		const lists = tokens.map((token) => text.bodyPaths(token)).sort((a, b) => a.length - b.length);
		const others = lists.slice(1).map((list) => new Set(list));
		const candidates = (lists[0] ?? []).filter((path) => path !== context.active.path && !skip.has(path) && context.notes.has(path) && !mentionsActive.has(path) && others.every((set) => set.has(path)));
		candidates.sort((a, b) => totalFrequency(text, b, tokens) - totalFrequency(text, a, tokens) || (a < b ? -1 : 1));
		for (const path of candidates.slice(0, MAX_VERIFIED_READS)) {
			const body = ` ${proseTokens(await input.readText(path)).join(" ")} `;
			if (body.includes(name.phrase)) mentionsActive.set(path, name.label);
		}
	}

	const signals: Signals = new Map();
	for (const path of new Set([...mentionsActive.keys(), ...mentionedByActive.keys()])) {
		const named = mentionedByActive.get(path);
		const usesName = mentionsActive.get(path);
		if (named !== undefined && usesName !== undefined) add(signals, path, 1, "Mentions each other without a link", isSingleWord(named) && isSingleWord(usesName));
		else if (usesName !== undefined) add(signals, path, 0.85, `Mentions ${usesName} without a link`, isSingleWord(usesName));
		else add(signals, path, 0.85, `Named in this note without a link: ${named ?? ""}`, isSingleWord(named ?? ""));
	}
	return signals;
}

function totalFrequency(text: TextIndex, path: string, tokens: readonly string[]): number {
	const terms = text.doc(path)?.terms;
	return tokens.reduce((sum, token) => sum + (terms?.get(token) ?? 0), 0);
}
