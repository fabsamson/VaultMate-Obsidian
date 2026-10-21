// The `track` source: ONE track of a project note (its title, status and block), plus the note's goal section
// when one is recognisable. Pure, so the preview and the request cannot differ.
import { findHeadings } from "./insertion";
import { readProject, STATUS_INFO, type ProjectTrack } from "../projects/project-note";
import { cap, linksToText, stripCodeFences, type SourceText } from "./sources";

/** The goal is context, not the subject: it never takes the room of the track. */
export const GOAL_CAP = 1_500;

export interface TrackChoice {
	/** The index of the track's heading line, as text: it identifies the track in the note as it was read. */
	id: string;
	label: string;
}

/** The lines of a note's text, without their line breaks. */
export function noteLines(raw: string): string[] {
	return raw.split(/\r?\n/);
}

const OPEN_STATUSES = new Set(["explore", "backlog", "progress"]);

/** The tracks that are not done or dropped, in the order of the note. */
export function openTracks(lines: readonly string[]): ProjectTrack[] {
	return readProject(lines).tracks.filter((track) => OPEN_STATUSES.has(track.status));
}

export function openTrackChoices(lines: readonly string[]): TrackChoice[] {
	return openTracks(lines).map((track) => ({ id: String(track.line), label: track.title || "(untitled)" }));
}

/** The track whose heading is at `id`, whatever its status. */
export function trackAt(lines: readonly string[], id: string): ProjectTrack | undefined {
	return readProject(lines).tracks.find((track) => String(track.line) === id);
}

function clean(lines: readonly string[]): string {
	return linksToText(stripCodeFences(lines.join("\n"))).trim();
}

/** "Goal", "Objectif", "Objective", alone in the heading, in singular or plural, with or without an emoji before. */
function isGoalHeading(text: string): boolean {
	const folded = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/^[^\p{L}]+/u, "").trim();
	return /^(?:goal|objective|objectif)s?$/.test(folded);
}

/** The text under the first Goal / Objectif heading of the note, or "". */
export function goalText(lines: readonly string[]): string {
	const headings = findHeadings([...lines]);
	const goal = headings.find((heading) => isGoalHeading(heading.text));
	if (!goal) return "";
	const end = headings.find((heading) => heading.line > goal.line && heading.level <= goal.level)?.line ?? lines.length;
	return clean(lines.slice(goal.line + 1, end)).slice(0, GOAL_CAP).trim();
}

/** What is sent for the track at `id`; a `problem` when there is none to send. */
export function trackSource(title: string, lines: readonly string[], id: string): SourceText {
	const track = trackAt(lines, id);
	if (!track) return { name: "track", text: "", chars: 0, truncated: false, problem: "Choose a track." };
	const goal = goalText(lines);
	const parts = [
		`Project: ${title}`,
		...(goal ? [`Goal:\n${goal}`] : []),
		`Track: ${track.title}\nStatus: ${STATUS_INFO[track.status].label}`,
		clean(lines.slice(track.line + 1, track.end)),
	];
	return cap("track", parts.filter((part) => part !== "").join("\n\n"));
}
