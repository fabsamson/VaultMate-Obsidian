// The page search of the hub: case, accent and width insensitive, every word of the query must appear.

/** Lowercase, full-width letters folded (NFKC), Latin accents dropped. Kana voicing marks are kept: が stays distinct from か. */
function fold(text: string): string {
	return text.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC").toLowerCase();
}

/** The words of a query (split on any whitespace, the ideographic space included), folded. */
export function queryWords(query: string): string[] {
	return fold(query).split(/[\s\u3000]+/).filter((word) => word !== "");
}

/** True when every word of `query` appears in `haystack`. A blank query matches everything. */
export function matchesQuery(haystack: string, query: string): boolean {
	const words = queryWords(query);
	if (words.length === 0) return true;
	const text = fold(haystack);
	return words.every((word) => text.includes(word));
}
