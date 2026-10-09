// The eight signals of the context finder. Each one looks at the active note and returns, for the notes
// it finds, a strength between 0 and 1 and the reason in words. `engine.ts` weights and adds them.
import { rarity, type GraphContext } from "./graph";
import { baseName, haversineKm, type NoteMeta } from "./note-meta";
import type { TextIndex } from "./text-index";
import { cleanText, hasCjk, tokenize } from "./tokenizer";

export interface Signal {
	/** 0 to 1. */
	strength: number;
	text: string;
}

export type Signals = Map<string, Signal>;

function titleOf(context: GraphContext, path: string): string {
	return context.notes.get(path)?.title ?? baseName(path);
}

function add(signals: Signals, path: string, strength: number, text: string): void {
	signals.set(path, { strength: Math.min(1, strength), text });
}

/** Notes that link to the same notes as the active note; links to hub notes count little. */
export function sharedLinks(context: GraphContext): Signals {
	const found = new Map<string, { target: string; idf: number }[]>();
	for (const target of context.active.links) {
		const from = context.backlinks.get(target);
		if (!from) continue;
		const idf = rarity(context.notes.size, from.size);
		if (idf < 0.1) continue; // a hub: every note links to it
		for (const path of from) {
			if (path === context.active.path) continue;
			let list = found.get(path);
			if (!list) found.set(path, (list = []));
			list.push({ target, idf });
		}
	}
	const signals: Signals = new Map();
	for (const [path, list] of found) {
		list.sort((a, b) => b.idf - a.idf);
		const best = titleOf(context, list[0]?.target ?? "");
		const text = list.length === 1 ? `Links to the same note, ${best}` : `Links to ${list.length} of the same notes, including ${best}`;
		add(signals, path, list.reduce((sum, item) => sum + item.idf, 0) / 2, text);
	}
	return signals;
}

/** Notes that other notes link to together with the active note. */
export function coCitation(context: GraphContext): Signals {
	const found = new Map<string, { from: string; weight: number }[]>();
	for (const from of context.backlinks.get(context.active.path) ?? []) {
		const source = context.notes.get(from);
		if (!source || source.links.length < 2) continue;
		const weight = 1 / Math.log(1 + source.links.length); // a long list of links says little
		for (const path of source.links) {
			if (path === context.active.path || !context.notes.has(path)) continue;
			let list = found.get(path);
			if (!list) found.set(path, (list = []));
			list.push({ from, weight });
		}
	}
	const signals: Signals = new Map();
	for (const [path, list] of found) {
		const text = list.length >= 2 ? "Often linked together with this note" : `Linked together with this note in ${titleOf(context, list[0]?.from ?? "")}`;
		add(signals, path, list.reduce((sum, item) => sum + item.weight, 0) / 2, text);
	}
	return signals;
}

/** A tag or value shared with the active note counts less the more notes carry it. */
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

export function rareTags(context: GraphContext): Signals {
	const total = context.notes.size;
	const groups = groupBy(context.notes, (note) => note.tags);
	const found = new Map<string, { tag: string; idf: number; count: number }[]>();
	for (const tag of context.active.tags) {
		const paths = groups.get(tag);
		if (!paths || tooCommon(total, paths.size)) continue;
		const idf = rarity(total, paths.size);
		for (const path of paths) {
			if (path === context.active.path) continue;
			let list = found.get(path);
			if (!list) found.set(path, (list = []));
			list.push({ tag, idf, count: paths.size });
		}
	}
	const signals: Signals = new Map();
	for (const [path, list] of found) {
		list.sort((a, b) => b.idf - a.idf);
		const [best, second] = list;
		const rare = (best?.count ?? 0) <= Math.max(5, total * 0.02);
		const text = second ? `Shares the tags #${best?.tag ?? ""}, #${second.tag}` : `Shares the ${rare ? "rare " : ""}tag #${best?.tag ?? ""}`;
		add(signals, path, list.reduce((sum, item) => sum + item.idf, 0), text);
	}
	return signals;
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

const QUERY_TERMS = 12;
const WORDING_TERMS_SHOWN = 3;
const WORDING_MIN = 0.1;
const WORDING_CANDIDATES = 40;

/** BM25 of the active note's most telling terms against every other note, relative to the note itself. */
export function similarWording(context: GraphContext, text: TextIndex): Signals {
	const top = text.topTerms(context.active.path, QUERY_TERMS);
	// Numbers (dates in daily note titles, years) say little about the topic.
	const query = new Map(top.filter(([term, weight]) => weight > 0 && /\D/.test(term)).map(([term, weight]) => [term, 1 + Math.log(1 + weight)]));
	const scores = text.search(query);
	const own = scores.get(context.active.path) ?? 0;
	const signals: Signals = new Map();
	if (own <= 0) return signals;
	scores.delete(context.active.path);
	const best = [...scores].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, WORDING_CANDIDATES);
	const terms = [...query.keys()];
	for (const [path, score] of best) {
		const similarity = score / own;
		if (similarity < WORDING_MIN) break;
		add(signals, path, similarity * 2, `Similar wording: ${text.sharedTerms(path, terms, WORDING_TERMS_SHOWN).join(", ")}`);
	}
	return signals;
}

export const TIME_WINDOW_DAYS = 3;

/** Notes written within a few days of the active note; the closer, the stronger. */
export function timeProximity(context: GraphContext): Signals {
	const signals: Signals = new Map();
	const { day } = context.active;
	if (day === null) return signals;
	for (const note of context.notes.values()) {
		if (note.day === null || note.path === context.active.path) continue;
		const distance = Math.abs(note.day - day);
		if (distance <= TIME_WINDOW_DAYS) add(signals, note.path, 1 - distance / (TIME_WINDOW_DAYS + 1), "Written the same week");
	}
	return signals;
}

export function formatDistance(km: number): string {
	return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m away` : `${km.toFixed(1)} km away`;
}

/** Notes with coordinates close to the active note's: under 1 km strong, under 10 km weak. */
export function geoProximity(context: GraphContext): Signals {
	const signals: Signals = new Map();
	const { geo } = context.active;
	if (!geo) return signals;
	for (const note of context.notes.values()) {
		if (!note.geo || note.path === context.active.path) continue;
		const km = haversineKm(geo, note.geo);
		if (km < 10) add(signals, note.path, km < 1 ? 1 : 0.3, formatDistance(km));
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
		if (named !== undefined && usesName !== undefined) add(signals, path, 1, "Mentions each other without a link");
		else if (usesName !== undefined) add(signals, path, 0.85, `Mentions ${usesName} without a link`);
		else add(signals, path, 0.85, `Named in this note without a link: ${named ?? ""}`);
	}
	return signals;
}

function totalFrequency(text: TextIndex, path: string, tokens: readonly string[]): number {
	const terms = text.doc(path)?.terms;
	return tokens.reduce((sum, token) => sum + (terms?.get(token) ?? 0), 0);
}
