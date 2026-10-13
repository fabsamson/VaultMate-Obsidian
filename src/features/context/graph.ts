// The link graph around the active note and the hard rules that decide which notes may be proposed
// as a new connection. Pure: no `obsidian` import.
import type { NoteMeta } from "./note-meta";

/** The graph around the active note, computed once per query. */
export interface GraphContext {
	active: NoteMeta;
	notes: ReadonlyMap<string, NoteMeta>;
	/** Target path -> notes that link to it. */
	backlinks: ReadonlyMap<string, ReadonlySet<string>>;
	/** Target path -> notes that cite it (`NoteMeta.citations`): a subset of the backlinks. */
	citedBy: ReadonlyMap<string, ReadonlySet<string>>;
}

function invert(notes: ReadonlyMap<string, NoteMeta>, targetsOf: (note: NoteMeta) => readonly string[]): Map<string, Set<string>> {
	const from = new Map<string, Set<string>>();
	for (const note of notes.values()) {
		for (const target of targetsOf(note)) {
			let sources = from.get(target);
			if (!sources) from.set(target, (sources = new Set()));
			sources.add(note.path);
		}
	}
	return from;
}

export function buildGraphContext(active: NoteMeta, notes: ReadonlyMap<string, NoteMeta>): GraphContext {
	return { active, notes, backlinks: invert(notes, (note) => note.links), citedBy: invert(notes, (note) => note.citations) };
}

/** 1 for something only the active note and one other have, near 0 for something almost every note has. */
export function rarity(total: number, count: number): number {
	return Math.log((total + 1) / (count + 1)) / Math.log(total + 1);
}

/** A note that so many notes link to that linking to it says nothing. */
function isHub(context: GraphContext, path: string): boolean {
	return rarity(context.notes.size, context.backlinks.get(path)?.size ?? 0) < 0.1;
}

/** Below this many words of prose (links and code left out) a note has no content of its own: an index, a map, an empty daily note. */
export const MIN_OWN_WORDS = 30;

/**
 * The notes that may be proposed as a new connection to the active note: every note except
 * - the active note and the notes linked with it in either direction;
 * - the notes co-cited with it, whatever the size of the citing note (an index, a map, a project note, a daily note);
 * - the 2-hop neighbours (A to X to B, A to X from B, B to X to A) through a note X that is not a hub;
 * - the notes without content of their own.
 * Links in either direction exclude directly. Co-citation and the 2-hop paths follow citations only: a
 * note that merely records where its ideas were sent links every target without citing them together.
 * Folders play no part: some are generic and mix unrelated ideas. If the active note itself has no
 * content, nothing is eligible.
 */
export function eligibleNotes(context: GraphContext, ownWords: (path: string) => number): Set<string> {
	const { active, notes, backlinks, citedBy } = context;
	const eligible = new Set<string>();
	if (ownWords(active.path) < MIN_OWN_WORDS) return eligible;

	const citing = citedBy.get(active.path) ?? new Set<string>();
	const excluded = new Set<string>([active.path, ...active.links, ...(backlinks.get(active.path) ?? [])]);
	for (const from of citing) for (const target of notes.get(from)?.citations ?? []) excluded.add(target); // co-cited
	for (const via of active.citations) {
		if (isHub(context, via)) continue;
		for (const path of citedBy.get(via) ?? []) excluded.add(path); // A to X, B to X
		for (const path of notes.get(via)?.citations ?? []) excluded.add(path); // A to X to B
	}
	for (const via of citing) {
		if (isHub(context, via)) continue;
		for (const path of citedBy.get(via) ?? []) excluded.add(path); // B to X to A
	}

	for (const path of notes.keys()) if (!excluded.has(path) && ownWords(path) >= MIN_OWN_WORDS) eligible.add(path);
	return eligible;
}

/** Links in either direction, as a graph walk would follow them. */
function neighbours(context: GraphContext, path: string): Iterable<string> {
	return [...(context.notes.get(path)?.links ?? []), ...(context.backlinks.get(path) ?? [])];
}

/** Undirected link distance from the active note (breadth-first), for the notes within `maxDepth` links. */
export function graphDistances(context: GraphContext, maxDepth: number): Map<string, number> {
	const distances = new Map<string, number>([[context.active.path, 0]]);
	let frontier = [context.active.path];
	for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
		const next: string[] = [];
		for (const path of frontier) {
			for (const other of neighbours(context, path)) {
				if (distances.has(other) || !context.notes.has(other)) continue;
				distances.set(other, depth);
				next.push(other);
			}
		}
		frontier = next;
	}
	return distances;
}

/** Whether two notes are linked either way or cited together by a third note. */
export function areTied(context: GraphContext, a: string, b: string): boolean {
	if (context.notes.get(a)?.links.includes(b) || context.notes.get(b)?.links.includes(a)) return true;
	const citingB = context.citedBy.get(b);
	return [...(context.citedBy.get(a) ?? [])].some((from) => citingB?.has(from));
}
