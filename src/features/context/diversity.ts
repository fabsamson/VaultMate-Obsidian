// Diverse selection of the connections to show (maximal marginal relevance): the notes are picked one at
// a time, each maximising  LAMBDA x score - (1 - LAMBDA) x (its largest similarity to a note already
// picked). A note that is nearly identical to one already picked is left out altogether, so the active
// note is never offered several copies of the same idea. Pure.

/** Weight of the score against the dissimilarity to what is picked already. */
export const LAMBDA = 0.7;
/** A candidate at least this similar to a note already picked adds nothing new. */
export const DUPLICATE_SIMILARITY = 0.8;

export interface Candidate {
	path: string;
	score: number;
}

/**
 * Picks at most `limit` candidates. Scores are scaled by the best one, so they weigh as much as
 * the similarities (0 to 1). `similarity(a, b)` is 1 for notes that are linked or cited together.
 */
export function pickDiverse<T extends Candidate>(candidates: readonly T[], similarity: (a: string, b: string) => number, limit: number): T[] {
	const remaining = [...candidates].sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1));
	const best = remaining[0]?.score ?? 1;
	const picked: T[] = [];
	while (picked.length < limit && remaining.length > 0) {
		let choice = -1;
		let choiceValue = -Infinity;
		remaining.forEach((candidate, index) => {
			const closest = picked.reduce((most, other) => Math.max(most, similarity(candidate.path, other.path)), 0);
			if (closest >= DUPLICATE_SIMILARITY) return;
			const value = LAMBDA * (candidate.score / best) - (1 - LAMBDA) * closest;
			if (value > choiceValue) {
				choice = index;
				choiceValue = value;
			}
		});
		if (choice < 0) break;
		picked.push(...remaining.splice(choice, 1));
	}
	return picked;
}
