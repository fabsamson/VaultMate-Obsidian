// The text index of the context finder: term frequencies per note, an inverted index over them, and
// BM25 scoring. Pure. The title counts TITLE_WEIGHT times, as if it were repeated in the text.
import { cleanText, tokenizeCounting } from "./tokenizer";

const K1 = 1.2;
const B = 0.75;
export const TITLE_WEIGHT = 3;

/** What is cached per note: the body only (the title comes from the graph, so a rename costs nothing). */
export interface DocText {
	/** Modification time of the file when it was indexed. */
	mtime: number;
	/** Number of tokens of the body. */
	length: number;
	/** Number of words of prose in the body, links and code left out: a note with few has no content of its own. */
	words: number;
	terms: Map<string, number>;
}

export function countTerms(tokens: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
	return counts;
}

export function makeDoc(markdown: string, mtime: number): DocText {
	const { tokens, words } = tokenizeCounting(cleanText(markdown));
	return { mtime, length: tokens.length, words, terms: countTerms(tokens) };
}

interface Entry {
	doc: DocText;
	title: Map<string, number>;
	/** Body length plus the weighted title length. */
	length: number;
}

export class TextIndex {
	private readonly entries = new Map<string, Entry>();
	private readonly postings = new Map<string, Set<string>>();
	private totalLength = 0;

	public get size(): number {
		return this.entries.size;
	}

	public paths(): string[] {
		return [...this.entries.keys()];
	}

	public doc(path: string): DocText | undefined {
		return this.entries.get(path)?.doc;
	}

	/** Adds or replaces a note. `titleTokens` are the tokens of its title (and nothing else). */
	public put(path: string, doc: DocText, titleTokens: readonly string[]): void {
		this.remove(path);
		const title = countTerms(titleTokens);
		const entry: Entry = { doc, title, length: doc.length + TITLE_WEIGHT * titleTokens.length };
		this.entries.set(path, entry);
		this.totalLength += entry.length;
		for (const term of new Set([...doc.terms.keys(), ...title.keys()])) {
			let paths = this.postings.get(term);
			if (!paths) this.postings.set(term, (paths = new Set()));
			paths.add(path);
		}
	}

	public remove(path: string): void {
		const entry = this.entries.get(path);
		if (!entry) return;
		this.entries.delete(path);
		this.totalLength -= entry.length;
		for (const term of new Set([...entry.doc.terms.keys(), ...entry.title.keys()])) {
			const paths = this.postings.get(term);
			if (paths?.delete(path) && paths.size === 0) this.postings.delete(term);
		}
	}

	/** Notes whose body contains the term. */
	public bodyPaths(term: string): string[] {
		return [...(this.postings.get(term) ?? [])].filter((path) => this.entries.get(path)?.doc.terms.has(term));
	}

	public idf(term: string): number {
		const df = this.postings.get(term)?.size ?? 0;
		return Math.log(1 + (this.entries.size - df + 0.5) / (df + 0.5));
	}

	private frequency(entry: Entry, term: string): number {
		return (entry.doc.terms.get(term) ?? 0) + TITLE_WEIGHT * (entry.title.get(term) ?? 0);
	}

	/** The terms that best describe a note (tf-idf), best first, with their weight in a query. */
	public topTerms(path: string, count: number): [string, number][] {
		const entry = this.entries.get(path);
		if (!entry) return [];
		const terms = new Set([...entry.doc.terms.keys(), ...entry.title.keys()]);
		return [...terms]
			.map((term): [string, number] => [term, this.frequency(entry, term) * this.idf(term)])
			.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
			.slice(0, count);
	}

	/** BM25 score of every note that has at least one query term. `query` maps terms to a weight. */
	public search(query: ReadonlyMap<string, number>): Map<string, number> {
		const scores = new Map<string, number>();
		const average = this.entries.size > 0 ? this.totalLength / this.entries.size : 1;
		for (const [term, weight] of query) {
			const idf = this.idf(term);
			for (const path of this.postings.get(term) ?? []) {
				const entry = this.entries.get(path);
				if (!entry) continue;
				const tf = this.frequency(entry, term);
				const part = (weight * idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * entry.length) / Math.max(average, 1)));
				scores.set(path, (scores.get(path) ?? 0) + part);
			}
		}
		return scores;
	}

	/** Which of the terms a note has, the most telling first. */
	public sharedTerms(path: string, terms: readonly string[], count: number): string[] {
		const entry = this.entries.get(path);
		if (!entry) return [];
		return terms
			.filter((term) => this.frequency(entry, term) > 0)
			.sort((a, b) => this.frequency(entry, b) * this.idf(b) - this.frequency(entry, a) * this.idf(a))
			.slice(0, count);
	}
}
