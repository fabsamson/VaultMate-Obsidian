// The link graph around the active note and the hard rules that decide which notes may be proposed
// as a new connection. Pure: no `obsidian` import.
import type { NoteMeta } from "./note-meta";

/** The graph around the active note, computed once per query. */
export interface GraphContext {
	active: NoteMeta;
	notes: ReadonlyMap<string, NoteMeta>;
	/** Target path -> notes that link to it. */
	backlinks: ReadonlyMap<string, ReadonlySet<string>>;
}

export function buildGraphContext(active: NoteMeta, notes: ReadonlyMap<string, NoteMeta>): GraphContext {
	const backlinks = new Map<string, Set<string>>();
	for (const note of notes.values()) {
		for (const target of note.links) {
			let from = backlinks.get(target);
			if (!from) backlinks.set(target, (from = new Set()));
			from.add(note.path);
		}
	}
	return { active, notes, backlinks };
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
 * Folders play no part: some are generic and mix unrelated ideas. If the active note itself has no
 * content, nothing is eligible.
 */
export function eligibleNotes(context: GraphContext, ownWords: (path: string) => number): Set<string> {
	const { active, notes, backlinks } = context;
	const eligible = new Set<string>();
	if (ownWords(active.path) < MIN_OWN_WORDS) return eligible;

	const citing = backlinks.get(active.path) ?? new Set<string>();
	const excluded = new Set<string>([active.path, ...active.links, ...citing]);
	for (const from of citing) for (const target of notes.get(from)?.links ?? []) excluded.add(target); // co-cited
	for (const via of active.links) {
		if (isHub(context, via)) continue;
		for (const path of backlinks.get(via) ?? []) excluded.add(path); // A to X, B to X
		for (const path of notes.get(via)?.links ?? []) excluded.add(path); // A to X to B
	}
	for (const via of citing) {
		if (isHub(context, via)) continue;
		for (const path of backlinks.get(via) ?? []) excluded.add(path); // B to X to A
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
