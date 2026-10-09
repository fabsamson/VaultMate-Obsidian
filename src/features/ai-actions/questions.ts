// The `questions` output type: the contract appended to the prompt, a tolerant parser and the guard.
// Whatever the model says, only short questions of the expected shape survive; the UI never shows free
// AI prose. Pure.

export const QUESTION_KINDS = ["assumption", "evidence", "consequence", "alternative", "connection", "personal"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export interface Question {
	kind: QuestionKind | null;
	text: string;
}

export const MAX_QUESTION_LENGTH = 160;
/** Longest answer the parser looks at; a real answer is far shorter. */
const MAX_ANSWER_LENGTH = 50_000;

/** Appended after the user's prompt, so a custom prompt cannot break the parsing. */
export function questionsContract(count: number): string {
	return [
		"Output contract (mandatory; it overrides any instruction above about the format of your answer):",
		'Return only a JSON object, with no text before or after it and no code fence: {"questions":[{"kind":"assumption","text":"..."}]}',
		`- At most ${count} items in "questions".`,
		`- "kind" is one of these English words, whatever the language of the questions: ${QUESTION_KINDS.join(", ")}.`,
		`- "text" is one sentence that ends with a question mark, at most ${MAX_QUESTION_LENGTH} characters, on a single line.`,
	].join("\n");
}

// ---- JSON extraction ----------------------------------------------------------------------------------

/** Index of the `}` that closes the object opened at `start`, or -1. Strings are skipped. */
function closingBrace(text: string, start: number): number {
	let depth = 0;
	let inString = false;
	for (let i = start; i < text.length; i++) {
		const char = text.charAt(i);
		if (inString) {
			if (char === "\\") i++;
			else if (char === '"') inString = false;
		} else if (char === '"') inString = true;
		else if (char === "{") depth++;
		else if (char === "}" && --depth === 0) return i;
	}
	return -1;
}

export function jsonCandidates(text: string): unknown[] {
	const found: unknown[] = [];
	const tryParse = (source: string): void => {
		try {
			found.push(JSON.parse(source));
		} catch {
			// Not JSON: the next candidate may be.
		}
	};
	tryParse(text.trim());
	for (const fence of text.matchAll(/```[\w-]*[ \t]*\r?\n?([\s\S]*?)```/g)) tryParse(fence[1] ?? "");
	for (let i = text.indexOf("{"); i !== -1; i = text.indexOf("{", i + 1)) {
		const end = closingBrace(text, i);
		if (end !== -1) tryParse(text.slice(i, end + 1));
	}
	return found;
}

/** The raw items of the first JSON value that has a `questions` array (or is an array), or null. */
function jsonItems(text: string): unknown[] | null {
	for (const candidate of jsonCandidates(text)) {
		if (Array.isArray(candidate)) return candidate as unknown[];
		if (typeof candidate === "object" && candidate !== null && Array.isArray((candidate as { questions?: unknown }).questions)) {
			return (candidate as { questions: unknown[] }).questions;
		}
	}
	return null;
}

// ---- Fallback: lines ending with a question mark ------------------------------------------------------------

function lineQuestions(text: string): string[] {
	return text.split(/\r?\n/).flatMap((line) => {
		const cleaned = line
			.trim()
			.replace(/^(?:[-*+•]|\d+[.)])\s+/, "")
			.replace(/^\[[ xX]\]\s+/, "")
			.replace(/^(\*\*|__|`)(.*)\1$/, "$2")
			.replace(/^["'“‘](.*)["'”’]$/, "$1")
			.trim();
		return /[?？]$/.test(cleaned) ? [cleaned] : [];
	});
}

// ---- Guard ---------------------------------------------------------------------------------------------------

/** For duplicate checks: case, spaces, punctuation and width differences do not count. */
export function normalizeForCompare(text: string): string {
	return text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** The question as it will be shown, or null when it is not one short sentence ending with a question mark. */
function guardText(value: string): string | null {
	const text = value.trim();
	if (!/[?？]$/.test(text)) return null;
	if (/[\r\n]/.test(text)) return null;
	if (Array.from(text).length > MAX_QUESTION_LENGTH) return null;
	if (!/[\p{L}\p{N}]/u.test(text)) return null;
	const inner = text.slice(0, -1);
	// A sentence end followed by more text: a second sentence.
	if (/[.!?]["')\]”»]*\s+\S/.test(inner) || /[。！？]\S/.test(inner) || /[。！？]\s+\S/.test(inner)) return null;
	return text;
}

function guardKind(value: unknown): QuestionKind | null {
	const kind = typeof value === "string" ? value.trim().toLowerCase() : "";
	return (QUESTION_KINDS as readonly string[]).includes(kind) ? (kind as QuestionKind) : null;
}

export interface ParseOptions {
	/** Most questions to keep. */
	count: number;
	/** The note's text, so a question it already contains is not offered again. */
	noteText: string;
}

/** Parses the model's answer and keeps only questions that pass the guard, at most `count`. */
export function parseQuestions(answer: string, options: ParseOptions): Question[] {
	const text = answer.slice(0, MAX_ANSWER_LENGTH);
	const items = jsonItems(text);
	const candidates: Array<{ kind: unknown; text: unknown }> = items
		? items.map((item) => (typeof item === "string" ? { kind: null, text: item } : { kind: (item as { kind?: unknown } | null)?.kind, text: (item as { text?: unknown } | null)?.text }))
		: lineQuestions(text).map((line) => ({ kind: null, text: line }));

	const note = normalizeForCompare(options.noteText);
	const seen = new Set<string>();
	const kept: Question[] = [];
	for (const candidate of candidates) {
		if (kept.length >= options.count) break;
		if (typeof candidate.text !== "string") continue;
		const question = guardText(candidate.text);
		if (!question) continue;
		const key = normalizeForCompare(question);
		if (!key || seen.has(key) || note.includes(key)) continue;
		seen.add(key);
		kept.push({ kind: guardKind(candidate.kind), text: question });
	}
	return kept;
}
