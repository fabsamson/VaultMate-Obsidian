// Distinctive shared terms: the words two notes have in common once the vocabulary of the active
// note's own neighbourhood is set aside. This is the "text" bridge signal of the connections finder.
import type { GraphContext } from "./graph";
import type { TextIndex } from "./text-index";

/** A shared word must be shared at least this many times to count: one word in common is chance. */
export const MIN_SHARED_TERMS = 2;
export const TERMS_SHOWN = 3;
/** Only the candidates with the largest overlap are compared exactly, which keeps a query fast in a large vault. */
const MAX_COMPARED = 100;
/** A term used by more than this share of the notes (and more than MIN_COMMON_NOTES) says nothing about a topic. */
const COMMON_SHARE = 0.05;
const MIN_COMMON_NOTES = 6;

export interface TermMatch {
	/** Cosine similarity of the two notes' vectors of distinctive terms, 0 to 1. */
	similarity: number;
	/** The most telling shared terms, best first, at most TERMS_SHOWN. */
	terms: string[];
}

/** Hiragana alone is mostly particles and verb endings; Han and katakana carry the meaning. */
const ONLY_HIRAGANA = /^\p{Script=Hiragana}+$/u;

/** Terms worth comparing: not a number, not Japanese grammar, used by at least two notes and not by a large share of them. */
function usableTerm(text: TextIndex): (term: string) => boolean {
	const maxNotes = Math.max(MIN_COMMON_NOTES, Math.ceil(text.size * COMMON_SHARE));
	return (term) => {
		const notes = text.documentFrequency(term);
		return notes >= 2 && notes <= maxNotes && /\D/.test(term) && !ONLY_HIRAGANA.test(term);
	};
}

/** Terms used by at least two of the notes around the active note (those it links to and those that link to it). */
function neighbourhoodTerms(context: GraphContext, text: TextIndex): Set<string> {
	const around = new Set<string>(context.active.links);
	for (const path of context.backlinks.get(context.active.path) ?? []) around.add(path);
	const counts = new Map<string, number>();
	for (const path of around) for (const term of text.termsOf(path)) counts.set(term, (counts.get(term) ?? 0) + 1);
	const needed = Math.min(2, around.size);
	return new Set([...counts].filter(([, count]) => count >= needed).map(([term]) => term));
}

/** TF-IDF vector of a note over the terms `keep` accepts. */
function vector(text: TextIndex, path: string, keep: (term: string) => boolean): Map<string, number> {
	const weights = new Map<string, number>();
	for (const term of text.termsOf(path)) if (keep(term)) weights.set(term, (1 + Math.log(text.count(path, term))) * text.idf(term));
	return weights;
}

function norm(weights: ReadonlyMap<string, number>): number {
	let sum = 0;
	for (const weight of weights.values()) sum += weight * weight;
	return Math.sqrt(sum);
}

/** Cosine similarity of two notes' wording, over every usable term. 0 to 1. */
export function wordingSimilarity(text: TextIndex, a: string, b: string): number {
	const keep = usableTerm(text);
	const left = vector(text, a, keep);
	const right = vector(text, b, keep);
	let dot = 0;
	for (const [term, weight] of left) dot += weight * (right.get(term) ?? 0);
	const scale = norm(left) * norm(right);
	return scale > 0 ? dot / scale : 0;
}

/**
 * The eligible notes that share at least MIN_SHARED_TERMS distinctive terms with the active note.
 * The active note's neighbourhood vocabulary is removed first, so the words of its own project or area
 * do not count. Similarity is the cosine of TF-IDF vectors over the remaining terms.
 */
export function sharedTerms(context: GraphContext, text: TextIndex, eligible: ReadonlySet<string>): Map<string, TermMatch> {
	const usable = usableTerm(text);
	const around = neighbourhoodTerms(context, text);
	const keep = (term: string): boolean => usable(term) && !around.has(term);
	const active = vector(text, context.active.path, keep);
	const activeNorm = norm(active);
	const found = new Map<string, { dot: number; shared: [string, number][] }>();
	for (const [term, weight] of active) {
		const idf = text.idf(term);
		for (const path of text.pathsWith(term)) {
			if (!eligible.has(path)) continue;
			const product = weight * (1 + Math.log(text.count(path, term))) * idf;
			let entry = found.get(path);
			if (!entry) found.set(path, (entry = { dot: 0, shared: [] }));
			entry.dot += product;
			entry.shared.push([term, product]);
		}
	}
	const matches = new Map<string, TermMatch>();
	const closest = [...found].filter(([, { shared }]) => shared.length >= MIN_SHARED_TERMS).sort((a, b) => b[1].dot - a[1].dot).slice(0, MAX_COMPARED);
	for (const [path, { dot, shared }] of closest) {
		const scale = activeNorm * norm(vector(text, path, keep));
		if (scale <= 0) continue;
		shared.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
		matches.set(path, { similarity: dot / scale, terms: shared.slice(0, TERMS_SHOWN).map(([term]) => term) });
	}
	return matches;
}
