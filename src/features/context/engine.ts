// The connections finder. Pure: it takes the graph (`NoteMeta` per note) and the text index and returns
// the few notes, not connected with the active note yet, whose ideas could work with it.
//
//   score = relevance x novelty x hub bonus
//
// Relevance comes only from bridge signals (an unlinked mention, distinctive shared terms, the same
// person or place, a place within a kilometre) and has a minimum. Novelty and the hub bonus only
// multiply it, so two notes with nothing in common are never proposed.
import { buildGraphContext, eligibleNotes, graphDistances, type GraphContext } from "./graph";
import type { NoteMeta } from "./note-meta";
import { geoProximity, sameProperty, unlinkedMentions, type Signal } from "./signals";
import { sharedTerms } from "./terms";
import type { TextIndex } from "./text-index";

export type ReasonKind = "mention" | "property" | "place";

export interface ConnectionReason {
	kind: ReasonKind;
	/** The reason in words, ready to show ("Same author: Jane Doe"). */
	text: string;
	/** What this reason added to the relevance (strength 0 to 1 times the weight of the kind). */
	weight: number;
}

export interface Connection {
	path: string;
	/** Relevance x novelty x hub bonus. */
	score: number;
	/** The most telling distinctive terms both notes use, best first; empty when the notes share fewer than two. */
	terms: string[];
	/** Why the notes belong together besides their wording, the largest contribution first. */
	reasons: ConnectionReason[];
}

/** Relevance added by a signal at full strength. */
export const WEIGHTS = { mention: 3, property: 3, place: 2.2, terms: 2.5 };
/** Cosine similarity that counts as a full-strength match on terms. */
export const TERMS_FULL_SIMILARITY = 0.3;
/** Below this relevance the notes have too little in common, whatever their novelty. */
export const MIN_RELEVANCE = 1;
/** Notes scoring less are not worth showing. */
export const MIN_SCORE = 1.6;
export const DEFAULT_LIMIT = 3;

/** Novelty: best at 3 or 4 links away, where indirect common ground exists but no link. */
const NOVELTY_FAR = 0.85;
const NOVELTY_NEAR = 0.9;
const NOVELTY_SHARED_TAG = 0.93;
const MAX_DISTANCE = 4;
const HUB_STEP = 0.15;
const HUB_MAX = 1.5;

export interface EngineInput {
	/** Path of the active note. */
	active: string;
	/** Every note that may be suggested, plus the active note. Excluded folders are already left out. */
	notes: ReadonlyMap<string, NoteMeta>;
	text: TextIndex;
	/** Reads a note's Markdown. */
	readText: (path: string) => Promise<string>;
	limit?: number;
}

export function noveltyOf(context: GraphContext, path: string, distances: ReadonlyMap<string, number>): number {
	const distance = distances.get(path);
	let novelty = distance === undefined ? NOVELTY_FAR : distance <= 2 ? NOVELTY_NEAR : 1;
	const tags = new Set(context.active.tags);
	if ((context.notes.get(path)?.tags ?? []).some((tag) => tags.has(tag))) novelty *= NOVELTY_SHARED_TAG;
	return novelty;
}

/** Well-linked notes are good places to attach a new link: up to HUB_MAX times. */
export function hubBonus(context: GraphContext, path: string): number {
	const degree = (context.backlinks.get(path)?.size ?? 0) + (context.notes.get(path)?.links.length ?? 0);
	return Math.min(HUB_MAX, 1 + HUB_STEP * Math.log(1 + degree));
}

export async function findConnections(input: EngineInput): Promise<Connection[]> {
	const active = input.notes.get(input.active);
	if (!active) return [];
	const context = buildGraphContext(active, input.notes);
	const eligible = eligibleNotes(context, (path) => input.text.doc(path)?.words ?? 0);
	if (eligible.size === 0) return [];
	const skip = new Set([...input.notes.keys()].filter((path) => !eligible.has(path)));

	const signals: [ReasonKind, Map<string, Signal>][] = [
		["mention", await unlinkedMentions({ context, text: input.text, activeText: await input.readText(input.active), skip, readText: input.readText })],
		["property", sameProperty(context)],
		["place", geoProximity(context)],
	];
	const matches = sharedTerms(context, input.text, eligible);

	const reasons = new Map<string, ConnectionReason[]>();
	for (const [kind, found] of signals) {
		for (const [path, signal] of found) {
			if (!eligible.has(path)) continue;
			let list = reasons.get(path);
			if (!list) reasons.set(path, (list = []));
			list.push({ kind, text: signal.text, weight: WEIGHTS[kind] * signal.strength });
		}
	}

	const distances = graphDistances(context, MAX_DISTANCE);
	const found: Connection[] = [];
	for (const path of new Set([...reasons.keys(), ...matches.keys()])) {
		const list = reasons.get(path) ?? [];
		const match = matches.get(path);
		const relevance = list.reduce((sum, reason) => sum + reason.weight, 0) + (match ? WEIGHTS.terms * Math.min(1, match.similarity / TERMS_FULL_SIMILARITY) : 0);
		if (relevance < MIN_RELEVANCE) continue;
		const score = relevance * noveltyOf(context, path, distances) * hubBonus(context, path);
		if (score < MIN_SCORE) continue;
		found.push({ path, score, terms: match?.terms ?? [], reasons: list.sort((a, b) => b.weight - a.weight) });
	}
	return found.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1)).slice(0, input.limit ?? DEFAULT_LIMIT);
}
