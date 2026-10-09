// Text to tokens for the context finder. Pure. Lowercase, accents folded, letters and digits of any
// script; Chinese and Japanese runs (no spaces between words) become character bigrams.

const STOPWORDS = new Set(
	(
		// English
		"a an and are as at be been being but by for from had has have he her his i if in into is it its me my no not of on or our she so " +
		"than that the their them then there these they this to too us was we were what when which who will with you your " +
		// French (accents folded)
		"au aux avec ce ces cet cette dans de des du elle elles en est et il ils je la le les leur leurs lui ma mais me mes moi mon ne nos " +
		"notre nous on ou par pas pour qu que qui sa se ses son sont sur ta te tes toi ton tu un une vos votre vous ete etre avoir fait plus comme"
	).split(" "),
);

const CJK = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\u30fc";
// A CJK run, or a run of other letters and digits. The lookahead (not a lookbehind) keeps Latin text
// stuck to a CJK character from swallowing it.
const TOKEN_RE = new RegExp(`[${CJK}]+|(?:(?![${CJK}])[\\p{L}\\p{N}])+`, "gu");
const CJK_RE = new RegExp(`[${CJK}]`, "u");
const MAX_TOKEN_LENGTH = 40;

/** Lowercase, accents removed (`Été` -> `ete`), a few ligatures spelled out. */
export function foldText(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "") // combining accents only: kana marks stay, then NFC recomposes them
		.normalize("NFC")
		.replace(/ß/g, "ss")
		.replace(/œ/g, "oe")
		.replace(/æ/g, "ae");
}

export function hasCjk(text: string): boolean {
	return CJK_RE.test(text);
}

/** Tokens of a text, in order, stopwords and one-letter words removed. */
export function tokenize(text: string): string[] {
	const tokens: string[] = [];
	for (const match of foldText(text).matchAll(TOKEN_RE)) {
		const word = match[0];
		if (CJK_RE.test(word)) {
			const chars = Array.from(word);
			if (chars.length === 1) tokens.push(word);
			else for (let i = 0; i + 1 < chars.length; i++) tokens.push((chars[i] ?? "") + (chars[i + 1] ?? ""));
		} else if (word.length >= 2 && word.length <= MAX_TOKEN_LENGTH && !STOPWORDS.has(word)) {
			tokens.push(word);
		}
	}
	return tokens;
}

/**
 * The prose of a Markdown note: no frontmatter, no code, no link targets or URLs. A wikilink with a
 * display text keeps the display text; a bare wikilink disappears (the link signals cover it).
 */
export function cleanText(markdown: string): string {
	const body = markdown.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
	const kept: string[] = [];
	let fence = "";
	for (const line of body.split("\n")) {
		const marker = /^\s*(```|~~~)/.exec(line)?.[1];
		if (fence) {
			if (marker === fence) fence = "";
		} else if (marker) {
			fence = marker;
		} else {
			kept.push(line);
		}
	}
	return kept
		.join("\n")
		.replace(/`[^`\n]*`/g, " ")
		.replace(/!\[\[[^\]]*\]\]/g, " ")
		.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
		.replace(/\[\[[^\]]*\]\]/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/https?:\/\/\S+/g, " ");
}
