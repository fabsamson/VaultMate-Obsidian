// The words and small rules of the "Related notes" page. Pure, so Vitest can test them.
import type { BuildProgress, ContextStats } from "./context-index";
import type { ReasonKind } from "./engine";

/** Lucide icon of each kind of reason; the reason text always carries the meaning. */
export const REASON_ICONS: Record<ReasonKind, string> = {
	mention: "at-sign",
	links: "link",
	cocitation: "git-merge",
	tags: "tag",
	property: "user",
	wording: "text",
	time: "calendar",
	place: "map-pin",
};

export function indexingLine(progress: BuildProgress): string {
	return `Indexing your notes… ${progress.done} of ${progress.total}`;
}

export interface SummaryInput {
	/** Name of the context note, or null. */
	name: string | null;
	building: BuildProgress | null;
	/** Number of related notes found for the context note, or null when not computed yet. */
	count: number | null;
}

/** The line under the tile of the hub. */
export function relatedSummary(input: SummaryInput): string {
	if (!input.name) return "Open a note first";
	if (input.building) return `Indexing… ${input.building.done} of ${input.building.total}`;
	if (input.count === null) return `Notes related to ${input.name}`;
	if (input.count === 0) return `No related notes for ${input.name}`;
	return `${input.count} ${input.count === 1 ? "note" : "notes"} for ${input.name}`;
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
