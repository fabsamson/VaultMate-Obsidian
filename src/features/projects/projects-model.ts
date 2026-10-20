// What the Projects page shows, decided without the DOM: the hub tile, the dashboard tiles, the project page's
// chips, entries and buttons. Pure: no Obsidian import, so Vitest tests it.
import { formatDate, parseDate } from "../../core/dates";
import type { VaultMateSettings } from "../../core/settings-model";
import { countDue, type JournalEntry } from "../journal/journal-line";
import { TRACK_STATUSES, openTasks, trackCounts, type ProjectIdea, type ProjectTags, type ProjectTrack, type TrackStatus } from "./project-note";

/** The tags the settings give to ideas, decisions, predictions and project seeds: what `readProject` needs. */
export function projectTags(settings: Pick<VaultMateSettings, "ideas" | "journal">): ProjectTags {
	return { idea: settings.ideas.tag, decision: settings.journal.decisionTag, prediction: settings.journal.predictionTag, seed: settings.ideas.seedSubtag };
}

/** What the tile needs to know about a project note. */
export interface ProjectCounts {
	tracks: Record<TrackStatus, number>;
	ideas: number;
}

/** "2 in progress · 4 backlog · 3 ideas": the parts that are not zero; the tile text when nothing is tracked yet. */
export function tileSummary(projects: readonly ProjectCounts[]): string {
	const total = { progress: 0, backlog: 0, ideas: 0 };
	for (const project of projects) {
		total.progress += project.tracks.progress;
		total.backlog += project.tracks.backlog;
		total.ideas += project.ideas;
	}
	const parts = [
		total.progress > 0 ? `${total.progress} in progress` : "",
		total.backlog > 0 ? `${total.backlog} backlog` : "",
		total.ideas > 0 ? `${total.ideas} ${total.ideas === 1 ? "idea" : "ideas"}` : "",
	].filter((part) => part !== "");
	return parts.length > 0 ? parts.join(" · ") : projects.length > 0 ? "Nothing in progress" : "No projects yet";
}

export interface PrimaryAction {
	label: string;
	target: TrackStatus;
}

/** The main button of a card: Explore to backlog, Backlog start, In progress done, Done reopen, Dropped restore. */
export function primaryAction(status: TrackStatus): PrimaryAction {
	switch (status) {
		case "explore":
			return { label: "To backlog", target: "backlog" };
		case "backlog":
			return { label: "Start", target: "progress" };
		case "progress":
			return { label: "Done", target: "done" };
		case "done":
			return { label: "Reopen", target: "progress" };
		case "dropped":
			return { label: "Restore", target: "explore" };
	}
}

/** The statuses of the "Move to…" menu: every one but the current. */
export function moveTargets(status: TrackStatus): TrackStatus[] {
	return TRACK_STATUSES.filter((target) => target !== status);
}

/** "2 open tasks · next: X", "1 open task · next: X" or "No open tasks". */
export function taskSummary(track: ProjectTrack): string {
	const open = openTasks(track);
	const next = open[0];
	if (!next) return "No open tasks";
	return `${open.length} open ${open.length === 1 ? "task" : "tasks"} · next: ${next.text}`;
}

/** An In progress track with no open task is flagged "No next task" and offers Add task. */
export function needsNextTask(track: ProjectTrack): boolean {
	return track.status === "progress" && openTasks(track).length === 0;
}

/** Whether the Move command or a button applies to a cursor line inside a block [start, end). */
export function lineIn(line: number, start: number, end: number): boolean {
	return line >= start && line < end;
}

// ---- Dashboard: one summary per project ------------------------------------------------------------------

/** What the dashboard and the project page need to know about a project note. */
export interface ProjectLike {
	path: string;
	name: string;
	model: { tracks: readonly ProjectTrack[]; ideas: readonly ProjectIdea[] };
}

/** An entry of the journal index, as far as the project page is concerned. */
export interface EntryLike {
	path: string;
	line: number;
	entry: JournalEntry;
	plain?: boolean;
}

export interface NextTask {
	text: string;
	/** Title of the track the task belongs to. */
	track: string;
	/** `YYYY-MM-DD`, or null for the fallback (the next task of the first In progress track). */
	due: string | null;
	overdue: boolean;
}

const OPEN_STATUSES: readonly TrackStatus[] = ["explore", "backlog", "progress"];

/**
 * The open task with the nearest 📅 among the tracks that are not closed (overdue ones included); when no
 * task is dated, the next open task of the first In progress track that has one, without a date; else null.
 */
export function nextDueTask(tracks: readonly ProjectTrack[], today: Date): NextTask | null {
	const todayText = formatDate(today);
	let best: NextTask | null = null;
	for (const track of tracks) {
		if (!OPEN_STATUSES.includes(track.status)) continue;
		for (const task of openTasks(track)) {
			if (task.due === null || parseDate(task.due) === null) continue;
			if (best === null || task.due < (best.due ?? "")) best = { text: task.text, track: track.title, due: task.due, overdue: task.due < todayText };
		}
	}
	if (best) return best;
	const track = tracks.find((candidate) => candidate.status === "progress" && openTasks(candidate).length > 0);
	const task = track ? openTasks(track)[0] : undefined;
	return track && task ? { text: task.text, track: track.title, due: null, overdue: false } : null;
}

/** "Fix the gate · Garden · overdue", "Fix the gate · Garden · 2026-10-30" or just "Fix the gate · Garden". */
export function nextTaskLine(next: NextTask): string {
	return [next.text, next.track, next.overdue ? "overdue" : next.due].filter((part): part is string => !!part).join(" · ");
}

/**
 * Splits the open, dated, tracked entries of the journal. An entry written in a track's block
 * `[track.line, track.end)` of the project note belongs to that track (`byTrack`, in the order of
 * `model.tracks`); the others belong to the project (`outside`) when they are in the project note or, for a
 * folder note, in `treePaths` (its sub-notes). Plain tagged lines and undated entries are the journal's
 * Tidy up, not shown here. Sorted by review date, so due reviews come first.
 */
export function splitEntries<T extends EntryLike>(
	project: { path: string; model: { tracks: readonly ProjectTrack[] } },
	items: readonly T[],
	treePaths: ReadonlySet<string> | null,
): { byTrack: T[][]; outside: T[] } {
	const byTrack: T[][] = project.model.tracks.map(() => []);
	const outside: T[] = [];
	const covered = treePaths ?? new Set([project.path]);
	const shown = items.filter((item) => covered.has(item.path) && !item.plain && item.entry.status === "open" && item.entry.due !== null && parseDate(item.entry.due) !== null);
	shown.sort((a, b) => (a.entry.due ?? "").localeCompare(b.entry.due ?? ""));
	for (const item of shown) {
		const index = item.path === project.path ? project.model.tracks.findIndex((track) => lineIn(item.line, track.line, track.end)) : -1;
		(byTrack[index] ?? outside).push(item);
	}
	return { byTrack, outside };
}

export interface ProjectSummary {
	path: string;
	name: string;
	counts: Record<TrackStatus, number>;
	ideas: number;
	/** Open entries of the project (in tracks or not) due today or earlier. */
	reviewsDue: number;
	next: NextTask | null;
}

export function summarizeProject(project: ProjectLike, entries: { byTrack: readonly EntryLike[][]; outside: readonly EntryLike[] }, today: Date): ProjectSummary {
	return {
		path: project.path,
		name: project.name,
		counts: trackCounts(project.model.tracks),
		ideas: project.model.ideas.length,
		reviewsDue: countDue([...entries.byTrack.flat(), ...entries.outside], today),
		next: nextDueTask(project.model.tracks, today),
	};
}

/** The counter line of a tile: In progress, Backlog and Explore when not zero (the seals), then the ideas text. */
export function tileCounters(summary: ProjectSummary): { statuses: Array<{ status: TrackStatus; count: number }>; ideas: string } {
	const statuses = (["progress", "backlog", "explore"] as const).flatMap((status) => (summary.counts[status] > 0 ? [{ status, count: summary.counts[status] }] : []));
	return { statuses, ideas: summary.ideas > 0 ? `${summary.ideas} ${summary.ideas === 1 ? "idea" : "ideas"}` : "" };
}

/** "1 review due" or "3 reviews due"; empty when none. */
export function reviewsDueText(count: number): string {
	return count === 0 ? "" : `${count} ${count === 1 ? "review" : "reviews"} due`;
}

/** Tiles in view: projects with a review due first, then those with a track in progress; the rest go under "Other projects". */
export function orderTiles<T extends ProjectSummary>(tiles: readonly T[]): { shown: T[]; other: T[] } {
	const due = tiles.filter((tile) => tile.reviewsDue > 0);
	const building = tiles.filter((tile) => tile.reviewsDue === 0 && tile.counts.progress > 0);
	return { shown: [...due, ...building], other: tiles.filter((tile) => tile.reviewsDue === 0 && tile.counts.progress === 0) };
}

// ---- Project page: the chip row ---------------------------------------------------------------------------

export type SectionId = "ideas" | "progress" | "backlog" | "explore" | "reviews" | "closed";

export interface Chip {
	id: SectionId;
	count: number;
}

/** The section chips in the page's order (Ideas, In progress, Backlog, Explore, Reviews, Closed); only non-empty ones. */
export function sectionChips(counts: Record<TrackStatus, number>, ideas: number, reviews: number): Chip[] {
	const all: Chip[] = [
		{ id: "ideas", count: ideas },
		{ id: "progress", count: counts.progress },
		{ id: "backlog", count: counts.backlog },
		{ id: "explore", count: counts.explore },
		{ id: "reviews", count: reviews },
		{ id: "closed", count: counts.done + counts.dropped },
	];
	return all.filter((chip) => chip.count > 0);
}
