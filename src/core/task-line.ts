// Reading and editing one Markdown line in the Tasks plugin style:
//
//   > - [ ] description #tag [key:: value] ➕ 2026-10-08 📅 2027-01-08 ^block-id
//
// The contract order is description, tags, inline fields, Tasks emojis, then an optional block id. The
// Tasks plugin reads its signifiers from the end of the line, so nothing is ever written after them.
// Editors return a new string and leave every character they do not need to change as it was.
// No regex lookbehind anywhere (iOS before 16.4).

/** A line cut into its prefix and its body; `serializeTaskLine(parseTaskLine(line)) === line` for every line. */
export interface TaskLine {
	/** Blockquote or callout levels and indentation, as written ("> > ", "\t", ""). */
	lead: string;
	/** "-", "*", "+", "1." or "1)"; empty when the line is not a list item. */
	marker: string;
	/** Whitespace between the marker and the checkbox or the body. */
	gap: string;
	/** The character inside `[ ]` ("x", "-", " "…); null when there is no checkbox. */
	status: string | null;
	/** Whitespace after the checkbox. */
	statusGap: string;
	/** The text after the prefix; the helpers below read and edit it. */
	body: string;
}

const LINE_RE = /^((?:[ \t]*>)*[ \t]*)(?:([-*+]|\d{1,9}[.)])([ \t]+|$)(?:\[([^\]\r\n])\](?=[ \t]|$)([ \t]*))?)?/u;

export function parseTaskLine(line: string): TaskLine {
	const match = LINE_RE.exec(line);
	if (!match) return { lead: "", marker: "", gap: "", status: null, statusGap: "", body: line };
	return {
		lead: match[1] ?? "",
		marker: match[2] ?? "",
		gap: match[3] ?? "",
		status: match[4] ?? null,
		statusGap: match[5] ?? "",
		body: line.slice(match[0].length),
	};
}

export function serializeTaskLine(line: TaskLine): string {
	const checkbox = line.status === null ? "" : `[${line.status}]${line.statusGap}`;
	return `${line.lead}${line.marker}${line.gap}${checkbox}${line.body}`;
}

/** Makes a plain line or a plain list item a task (`- [ ] `), keeping the quote prefix, indentation and marker. */
export function toTaskLine(line: TaskLine): TaskLine {
	if (line.status !== null) return line;
	if (line.marker) return { ...line, gap: line.gap || " ", status: " ", statusGap: " " };
	return { ...line, marker: "-", gap: " ", status: " ", statusGap: " " };
}

/** Sets the checkbox character (" " open, "x" done, "-" cancelled), turning the line into a task first if needed. */
export function setTaskStatus(line: TaskLine, status: string): TaskLine {
	return { ...toTaskLine(line), status };
}

// ---- Body structure -------------------------------------------------------------------------------

const VS = "[\\uFE0E\\uFE0F]?"; // emoji or text variation selector, both accepted
const DATE = "\\d{4}-\\d{2}-\\d{2}";

// Tasks signifiers, each anchored at the end of the line like the Tasks plugin's own parser.
const SIGNIFIERS = [
	new RegExp(`[\\u2795\\u{1F6EB}\\u23F3\\u{1F4C5}\\u2705\\u274C]${VS}\\s*${DATE}$`, "u"),
	new RegExp(`[\\u23EB\\u{1F53C}\\u{1F53D}\\u{1F53A}\\u23EC]${VS}$`, "u"),
	new RegExp(`\\u{1F501}${VS}\\s*[a-zA-Z0-9, !]+$`, "u"),
	new RegExp(`\\u{1F194}${VS}\\s*[a-zA-Z0-9\\-_]+$`, "u"),
	new RegExp(`\\u26D4${VS}\\s*[a-zA-Z0-9\\-_]+(?:\\s*,\\s*[a-zA-Z0-9\\-_]+)*$`, "u"),
	new RegExp(`\\u{1F3C1}${VS}\\s*[a-zA-Z]+$`, "u"),
];

const BLOCK_ID_RE = /[ \t]\^[A-Za-z0-9-]+$/;

interface BodyParts {
	/** Description, tags and inline fields; it ends where the emoji block starts. */
	main: string;
	/** The Tasks emoji block ("➕ … 📅 …"), empty when there is none. */
	block: string;
	/** Trailing whitespace and block id (" ^abc"). */
	tail: string;
}

function splitBody(body: string): BodyParts {
	let end = body.trimEnd().length;
	const blockId = BLOCK_ID_RE.exec(body.slice(0, end));
	if (blockId) end = body.slice(0, blockId.index).trimEnd().length;
	let start = end;
	for (;;) {
		const rest = body.slice(0, start).trimEnd();
		let next = -1;
		for (const signifier of SIGNIFIERS) {
			const match = signifier.exec(rest);
			if (match) {
				next = match.index;
				break;
			}
		}
		if (next < 0) break;
		start = next;
	}
	return { main: body.slice(0, start), block: body.slice(start, end), tail: body.slice(end) };
}

/** Joins `main` around [start, end) replaced by `text`, with single spaces, and keeps `main` apart from the emoji block. */
function splice(main: string, start: number, end: number, text: string, hasBlock: boolean): string {
	const out = [main.slice(0, start).trimEnd(), text, main.slice(end).trimStart()].filter(Boolean).join(" ");
	return hasBlock && out && !/\s$/.test(out) ? `${out} ` : out;
}

// Spans where `#`, `[` and `::` carry no meaning: inline code, wikilinks, Markdown links, bare URLs.
const MASK_RE = /(`+)[^`]*?\1|\[\[[^\]]*\]\]|\[[^\]]*\]\([^)]*\)|(?:https?:\/\/|www\.)[^\s\])>]+/g;

/** Same length as the input, so indexes stay valid. */
function mask(text: string): string {
	return text.replace(MASK_RE, (span) => " ".repeat(span.length));
}

// ---- Tags -----------------------------------------------------------------------------------------

const TAG_RE = /#([\p{L}\p{N}\p{M}_/-]+)/gu;
const WORD_CHAR_RE = /[\p{L}\p{N}\p{M}_/#&-]/u;

interface TagMatch {
	name: string;
	start: number;
}

function findTags(text: string): TagMatch[] {
	const masked = mask(text);
	const tags: TagMatch[] = [];
	for (const match of masked.matchAll(TAG_RE)) {
		const name = match[1] ?? "";
		const before = match.index > 0 ? masked.charAt(match.index - 1) : "";
		const afterWord = before !== "" && (WORD_CHAR_RE.test(before) || /[\uDC00-\uDFFF]/.test(before));
		if (!afterWord && /\D/.test(name)) tags.push({ name, start: match.index });
	}
	return tags;
}

/** Tags of a body in order, without `#`, as written. Tags in code, links and URLs are ignored. */
export function getTags(body: string): string[] {
	return findTags(body).map((tag) => tag.name);
}

function stripHash(tag: string): string {
	return tag.startsWith("#") ? tag.slice(1) : tag;
}

/** Case-insensitive, like Obsidian; a nested tag (`decision/work`) counts for its parent (`decision`). */
export function hasTag(body: string, tag: string): boolean {
	const wanted = stripHash(tag).toLowerCase();
	return getTags(body).some((name) => {
		const lower = name.toLowerCase();
		return lower === wanted || lower.startsWith(`${wanted}/`);
	});
}

/** Adds `#tag` after the description, before the inline fields and the emoji block, unless the body already has it. */
export function ensureTag(body: string, tag: string): string {
	if (hasTag(body, tag)) return body;
	const { main, block, tail } = splitBody(body);
	const firstField = findFields(main)[0];
	const at = firstField ? firstField.start : main.length;
	return splice(main, at, at, `#${stripHash(tag)}`, block !== "") + block + tail;
}

// ---- Inline fields (Dataview bracket form) ----------------------------------------------------------

const FIELD_RE = /\[([\p{L}\p{N}_-]+)::[ \t]*([^\]]*?)[ \t]*\]/gu;

interface FieldMatch {
	key: string;
	value: string;
	start: number;
	end: number;
}

function findFields(main: string): FieldMatch[] {
	const fields: FieldMatch[] = [];
	for (const match of mask(main).matchAll(FIELD_RE)) {
		const key = match[1] ?? "";
		const end = match.index + match[0].length;
		// Read the value from the original text: a URL inside it is masked above.
		const value = main.slice(match.index + key.length + 3, end - 1).trim();
		fields.push({ key, value, start: match.index, end });
	}
	return fields;
}

function findField(main: string, key: string): FieldMatch | undefined {
	const wanted = key.toLowerCase();
	return findFields(main).find((field) => field.key.toLowerCase() === wanted);
}

/** Value of `[key:: value]` (key compared case-insensitively), or null. */
export function getInlineField(body: string, key: string): string | null {
	return findField(splitBody(body).main, key)?.value ?? null;
}

/** Replaces `[key:: …]` in place, or adds it after the existing inline fields and before the emoji block. */
export function setInlineField(body: string, key: string, value: string): string {
	const { main, block, tail } = splitBody(body);
	const fields = findFields(main);
	const existing = fields.find((field) => field.key.toLowerCase() === key.toLowerCase());
	if (existing) return `${main.slice(0, existing.start)}[${existing.key}:: ${value}]${main.slice(existing.end)}${block}${tail}`;
	const last = fields[fields.length - 1];
	const at = last ? last.end : main.length;
	return splice(main, at, at, `[${key}:: ${value}]`, block !== "") + block + tail;
}

export function removeInlineField(body: string, key: string): string {
	const { main, block, tail } = splitBody(body);
	const existing = findField(main, key);
	if (!existing) return body;
	return splice(main, existing.start, existing.end, "", block !== "") + block + tail;
}

// ---- Tasks emoji dates ------------------------------------------------------------------------------

const DATE_EMOJI = {
	created: "➕", // ➕
	start: "\u{1F6EB}", // 🛫
	scheduled: "⏳", // ⏳
	due: "\u{1F4C5}", // 📅
	cancelled: "❌", // ❌
	done: "✅", // ✅
} as const;

export type TaskDateKind = keyof typeof DATE_EMOJI;

// Stable order of the emoji block, as the Tasks plugin writes it.
const DATE_ORDER: TaskDateKind[] = ["created", "start", "scheduled", "due", "cancelled", "done"];

const DATE_TOKEN_RE = new RegExp(`([\\u2795\\u{1F6EB}\\u23F3\\u{1F4C5}\\u2705\\u274C])${VS}(\\s*)(${DATE})`, "gu");

interface DateToken {
	kind: TaskDateKind;
	date: string;
	/** Start of the emoji, end of the date, and start of the date, within the block. */
	start: number;
	end: number;
	dateStart: number;
}

function findDateTokens(block: string): DateToken[] {
	const tokens: DateToken[] = [];
	for (const match of block.matchAll(DATE_TOKEN_RE)) {
		const kind = DATE_ORDER.find((candidate) => DATE_EMOJI[candidate] === match[1]);
		const date = match[3];
		if (kind && date) tokens.push({ kind, date, start: match.index, end: match.index + match[0].length, dateStart: match.index + match[0].length - date.length });
	}
	return tokens;
}

/** The `YYYY-MM-DD` text after a Tasks emoji (with or without variation selector), or null. */
export function getTaskDate(body: string, kind: TaskDateKind): string | null {
	return findDateTokens(splitBody(body).block).find((token) => token.kind === kind)?.date ?? null;
}

/** Replaces the date in place, or adds `emoji date` to the emoji block in stable order. Other signifiers are untouched. */
export function setTaskDate(body: string, kind: TaskDateKind, date: string): string {
	const { main, block, tail } = splitBody(body);
	const tokens = findDateTokens(block);
	const same = tokens.find((token) => token.kind === kind);
	if (same) return `${main}${block.slice(0, same.dateStart)}${date}${block.slice(same.end)}${tail}`;
	const text = `${DATE_EMOJI[kind]} ${date}`;
	const rank = DATE_ORDER.indexOf(kind);
	const next = tokens.find((token) => DATE_ORDER.indexOf(token.kind) > rank);
	if (next) return `${main}${block.slice(0, next.start)}${text} ${block.slice(next.start)}${tail}`;
	if (block) return `${main}${block} ${text}${tail}`;
	return `${main ? `${main} ` : ""}${text}${tail}`;
}

export function removeTaskDate(body: string, kind: TaskDateKind): string {
	const { main, block, tail } = splitBody(body);
	const same = findDateTokens(block).find((token) => token.kind === kind);
	if (!same) return body;
	const after = block.slice(same.end).trimStart();
	const before = after ? block.slice(0, same.start) : block.slice(0, same.start).trimEnd();
	const rest = before + after;
	return rest ? main + rest + tail : main.trimEnd() + tail;
}
