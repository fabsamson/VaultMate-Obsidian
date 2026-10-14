// What the Projects page shows, decided without the DOM: the tile summary, the columns, the buttons of a
// card. Pure: no Obsidian import, so Vitest tests it.
import { STATUS_INFO, TRACK_STATUSES, openTasks, type ProjectTrack, type TrackStatus } from "./project-note";

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

/** Columns of the board, in order; Done and Dropped only when `showClosed`. */
export function boardStatuses(showClosed: boolean): TrackStatus[] {
	return TRACK_STATUSES.filter((status) => showClosed || (status !== "done" && status !== "dropped"));
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

/** "1 in progress · 2 backlog" for a project header (zero counts left out; Done and Dropped included when asked). */
export function headerCounts(counts: Record<TrackStatus, number>, showClosed: boolean): string {
	return boardStatuses(showClosed)
		.filter((status) => counts[status] > 0)
		.map((status) => `${counts[status]} ${STATUS_INFO[status].label.toLowerCase()}`)
		.join(" · ");
}

/** Whether the Move command or a button applies to a cursor line inside a block [start, end). */
export function lineIn(line: number, start: number, end: number): boolean {
	return line >= start && line < end;
}
