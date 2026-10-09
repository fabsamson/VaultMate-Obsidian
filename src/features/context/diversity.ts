// Diverse selection of the connections to show (maximal marginal relevance): the notes are picked one at
// a time, each maximising  LAMBDA x score - (1 - LAMBDA) x (its largest similarity to a note already
// picked), so the active note is never offered three near-identical notes. Pure.

/** Weight of the score against the dissimilarity to what is picked already. */
export const LAMBDA = 0.7;

export interface Candidate {
	path: string;
	score: number;
}

/**
 * Picks at most `limit` candidates. Scores are scaled by the best one, so they weigh as much as
 * the similarities (0 to 1). `similarity(a, b)` is 1 for notes that clearly belong together.
 */
export function pickDiverse<T extends Candidate>(candidates: readonly T[], similarity: (a: string, b: string) => number, limit: number): T[] {
	const remaining = [...candidates].sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1));
	const best = remaining[0]?.score ?? 1;
	const picked: T[] = [];
	while (picked.length < limit && remaining.length > 0) {
		let choice = 0;
		let choiceValue = -Infinity;
		remaining.forEach((candidate, index) => {
			const closest = picked.reduce((most, other) => Math.max(most, similarity(candidate.path, other.path)), 0);
			const value = LAMBDA * (candidate.score / best) - (1 - LAMBDA) * closest;
			if (value > choiceValue) {
				choice = index;
				choiceValue = value;
			}
		});
		picked.push(...remaining.splice(choice, 1));
	}
	return picked;
}
