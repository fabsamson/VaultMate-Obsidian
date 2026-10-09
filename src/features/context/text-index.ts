// The text index of the context finder: term frequencies per note and an inverted index over them.
// Pure. The title counts TITLE_WEIGHT times, as if it were repeated in the text.
import { cleanText, tokenizeCounting } from "./tokenizer";

export const TITLE_WEIGHT = 3;

/** What is cached per note: the body only (the title comes from the graph, so a rename costs nothing). */
export interface DocText {
	/** Modification time of the file when it was indexed. */
	mtime: number;
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
	return { mtime, words, terms: countTerms(tokens) };
}

interface Entry {
	doc: DocText;
	title: Map<string, number>;
}

export class TextIndex {
	private readonly entries = new Map<string, Entry>();
	private readonly postings = new Map<string, Set<string>>();

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
		this.entries.set(path, { doc, title });
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
		for (const term of new Set([...entry.doc.terms.keys(), ...entry.title.keys()])) {
			const paths = this.postings.get(term);
			if (paths?.delete(path) && paths.size === 0) this.postings.delete(term);
		}
	}

	/** Notes whose body contains the term. */
	public bodyPaths(term: string): string[] {
		return [...(this.postings.get(term) ?? [])].filter((path) => this.entries.get(path)?.doc.terms.has(term));
	}

	/** Number of notes that have the term in their body or title. */
	public documentFrequency(term: string): number {
		return this.postings.get(term)?.size ?? 0;
	}

	/** Notes that have the term in their body or title. */
	public pathsWith(term: string): ReadonlySet<string> {
		return this.postings.get(term) ?? new Set();
	}

	/** Every term of a note's body and title. */
	public termsOf(path: string): string[] {
		const entry = this.entries.get(path);
		return entry ? [...new Set([...entry.doc.terms.keys(), ...entry.title.keys()])] : [];
	}

	/** How many times the term counts in a note (body, plus the weighted title). */
	public count(path: string, term: string): number {
		const entry = this.entries.get(path);
		return entry ? (entry.doc.terms.get(term) ?? 0) + TITLE_WEIGHT * (entry.title.get(term) ?? 0) : 0;
	}

	/** How telling a term is: high for a rare term, near 0 for one that almost every note has. */
	public idf(term: string): number {
		const notes = this.documentFrequency(term);
		return Math.log(1 + (this.entries.size - notes + 0.5) / (notes + 0.5));
	}
}
