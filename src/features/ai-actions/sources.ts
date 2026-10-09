// What each source sends: extraction and size caps. Pure, so the preview and the request cannot differ.
import { splitFrontmatter, type SourceName } from "./definition";

export const SOURCE_CAPS: Record<SourceName, number> = { note: 24_000, selection: 8_000, properties: 2_000, "collection-profile": 12_000 };

export interface SourceText {
	name: SourceName;
	text: string;
	/** Length of `text` in characters. */
	chars: number;
	truncated: boolean;
	/** Why the action cannot run on this source, when it cannot. */
	problem?: string;
}

function cap(name: SourceName, text: string): SourceText {
	const limit = SOURCE_CAPS[name];
	const truncated = text.length > limit;
	const kept = truncated ? text.slice(0, limit) : text;
	return { name, text: kept, chars: kept.length, truncated };
}

/** Removes fenced code blocks (``` or ~~~), including an unclosed one. */
function stripCodeFences(text: string): string {
	const kept: string[] = [];
	let open: { char: string; length: number } | null = null;
	for (const line of text.split(/\r?\n/)) {
		if (open === null) {
			const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
			if (marker) open = { char: marker.charAt(0), length: marker.length };
			else kept.push(line);
		} else {
			const closing = /^\s*(`{3,}|~{3,})\s*$/.exec(line)?.[1];
			if (closing && closing.charAt(0) === open.char && closing.length >= open.length) open = null;
		}
	}
	return kept.join("\n");
}

/** Wikilinks, embeds and Markdown links are replaced by their visible text. */
function linksToText(text: string): string {
	return text
		.replace(/!?\[\[([^\]\n]*)\]\]/g, (_all, inner: string) => {
			const [target = "", alias] = inner.split("|");
			return (alias ?? target.split("#")[0] ?? "").trim() || target.trim();
		})
		.replace(/!\[([^\]\n]*)\]\([^)\n]*\)/g, "$1")
		.replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, "$1");
}

/** Content of a note as sent: without frontmatter and code, links as text. */
export function noteContent(raw: string): string {
	const withoutFrontmatter = splitFrontmatter(raw).body;
	return linksToText(stripCodeFences(withoutFrontmatter)).trim();
}

export function noteSource(title: string, raw: string): SourceText {
	return cap("note", `Title: ${title}\n\n${noteContent(raw)}`);
}

export function selectionSource(selection: string): SourceText {
	return cap("selection", selection.trim());
}

function propertyValue(value: unknown): string {
	if (Array.isArray(value)) return value.map(propertyValue).join(", ");
	if (value !== null && typeof value === "object") return JSON.stringify(value);
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

/** The note's frontmatter as `key: value` lines (`position` and other Obsidian internals are not in it). */
export function propertiesSource(frontmatter: Record<string, unknown> | undefined): SourceText {
	const lines = Object.entries(frontmatter ?? {})
		.filter(([key]) => key !== "position")
		.map(([key, value]) => `${key}: ${propertyValue(value)}`);
	return cap("properties", lines.join("\n"));
}
