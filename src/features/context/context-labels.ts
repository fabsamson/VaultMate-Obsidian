// The words and small rules of the "New connections" page. Pure, so Vitest can test them.
import type { BuildProgress, ContextStats } from "./context-index";
import type { ReasonKind } from "./engine";

/** Lucide icon of each kind of reason; the reason text always carries the meaning. */
export const REASON_ICONS: Record<ReasonKind, string> = {
	mention: "at-sign",
	property: "user",
	place: "map-pin",
};

export function indexingLine(progress: BuildProgress): string {
	return `Indexing your notes… ${progress.done} of ${progress.total}`;
}

export interface SummaryInput {
	/** Name of the context note, or null. */
	name: string | null;
	building: BuildProgress | null;
	/** Number of connections found for the context note, or null when not computed yet. */
	count: number | null;
}

/** The line under the tile of the hub. */
export function connectionsSummary(input: SummaryInput): string {
	if (!input.name) return "Open a note first";
	if (input.building) return `Indexing… ${input.building.done} of ${input.building.total}`;
	if (input.count === null) return `New connections for ${input.name}`;
	if (input.count === 0) return `No new connection for ${input.name}`;
	return `${input.count} new ${input.count === 1 ? "connection" : "connections"} for ${input.name}`;
}

/** Terms named on the card. */
export const ABOUT_TERMS = 2;

export interface AboutPart {
	text: string;
	/** The part is one of the terms, shown in emphasis. */
	term: boolean;
}

/** "Both are about *checklist* and *preparation*": the pieces of the sentence, the terms flagged. Empty without terms. */
export function aboutParts(terms: readonly string[]): AboutPart[] {
	const shown = terms.slice(0, ABOUT_TERMS);
	const parts: AboutPart[] = shown.length === 0 ? [] : [{ text: "Both are about ", term: false }];
	shown.forEach((term, index) => {
		if (index > 0) parts.push({ text: " and ", term: false });
		parts.push({ text: term, term: true });
	});
	return parts;
}

function topFolder(path: string): string {
	return path.includes("/") ? (path.split("/")[0] ?? "") : "";
}

/** "in 20-Areas/Zettelkasten, another area": where the note is, and whether it is outside the active note's top-level folder. Presentation only. */
export function locationLine(path: string, activePath: string): string {
	const folder = noteFolder(path);
	const place = folder === "" ? "at the root of the vault" : `in ${folder}`;
	return topFolder(path) === topFolder(activePath) ? place : `${place}, another area`;
}

/** "Indexed 301 notes in 0.4 s · computed on this device". */
export function statsLine(stats: ContextStats): string {
	const seconds = Math.max(0.1, Math.round(stats.buildMs / 100) / 10);
	return `Indexed ${stats.notesTotal} ${stats.notesTotal === 1 ? "note" : "notes"} in ${seconds.toFixed(1)} s · computed on this device`;
}

export function noteTitle(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

/** Folder of a note, or an empty string at the root of the vault. */
export function noteFolder(path: string): string {
	const slash = path.lastIndexOf("/");
	return slash < 0 ? "" : path.slice(0, slash);
}
