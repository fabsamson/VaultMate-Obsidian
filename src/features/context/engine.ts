// The ranking of the context finder. Pure: it takes the graph (`NoteMeta` per note) and the text index,
// runs the eight signals for the active note and returns the best notes with their reasons.
import { buildGraphContext } from "./graph";
import type { NoteMeta } from "./note-meta";
import {
	coCitation,
	geoProximity,
	rareTags,
	sameProperty,
	sharedLinks,
	similarWording,
	timeProximity,
	unlinkedMentions,
	type Signals,
} from "./signals";
import type { TextIndex } from "./text-index";

export type ReasonKind = "mention" | "links" | "cocitation" | "tags" | "property" | "wording" | "time" | "place";

export interface RelatedReason {
	kind: ReasonKind;
	/** The reason in words, ready to show ("Shares the rare tag #x"). */
	text: string;
	/** What this reason added to the score (strength 0 to 1 times the kind's weight). */
	weight: number;
}

export interface RelatedNote {
	path: string;
	/** Sum of all the reasons' weights. */
	score: number;
	/** At most `MAX_REASONS`, the largest contribution first. */
	reasons: RelatedReason[];
}

/**
 * Score added by a signal at full strength. A text-based mention or a link overlap is the strongest
 * hint; tags, place and time are circumstantial, and time alone never reaches MIN_SCORE.
 */
export const WEIGHTS: Record<ReasonKind, number> = {
	mention: 3,
	links: 3,
	cocitation: 2.5,
	wording: 2.5,
	property: 2,
	tags: 1.5,
	place: 1.5,
	time: 0.4,
};

export const MAX_REASONS = 3;
/** Notes scoring less are not worth showing. */
export const MIN_SCORE = 0.5;

export interface EngineInput {
	/** Path of the active note. */
	active: string;
	/** Every note that may be suggested, plus the active note. Excluded folders are already left out. */
	notes: ReadonlyMap<string, NoteMeta>;
	text: TextIndex;
	/** Reads a note's Markdown. */
	readText: (path: string) => Promise<string>;
	limit: number;
}

export async function findRelated(input: EngineInput): Promise<RelatedNote[]> {
	const active = input.notes.get(input.active);
	if (!active) return [];
	const context = buildGraphContext(active, input.notes);
	// Backlinks and Outgoing links already show these notes.
	const skip = new Set<string>([input.active, ...active.links, ...(context.backlinks.get(input.active) ?? [])]);

	const bySignal: [ReasonKind, Signals][] = [
		["links", sharedLinks(context)],
		["cocitation", coCitation(context)],
		["tags", rareTags(context)],
		["property", sameProperty(context)],
		["wording", similarWording(context, input.text)],
		["time", timeProximity(context)],
		["place", geoProximity(context)],
		["mention", await unlinkedMentions({ context, text: input.text, activeText: await input.readText(input.active), skip, readText: input.readText })],
	];

	const reasons = new Map<string, RelatedReason[]>();
	for (const [kind, signals] of bySignal) {
		for (const [path, signal] of signals) {
			if (skip.has(path) || !input.notes.has(path)) continue;
			let list = reasons.get(path);
			if (!list) reasons.set(path, (list = []));
			list.push({ kind, text: signal.text, weight: WEIGHTS[kind] * signal.strength });
		}
	}

	return [...reasons]
		.map(([path, list]): RelatedNote => ({ path, score: list.reduce((sum, reason) => sum + reason.weight, 0), reasons: list.sort((a, b) => b.weight - a.weight).slice(0, MAX_REASONS) }))
		.filter((note) => note.score >= MIN_SCORE)
		.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1))
		.slice(0, input.limit);
}
