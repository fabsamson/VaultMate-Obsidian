// What the project gestures write: a status change, a promoted or dropped idea, a track task. Pure
// planning: every plan is a list of splices of the note's lines (`InsertPlan`, positions in the lines the
// plan was made from), ordered from the end of the note to its start so that they apply one after the
// other, through the Editor (`applyToEditor`) or `Vault.process` (`applyEdits`). Each gesture checks that
// the line it targets still has the text the caller read and refuses otherwise.
import { applyPlan, type InsertPlan } from "../ai-actions/insertion";
import { splitLine, width } from "../journal/journal-note";
import { appendPoint, readProject, STATUS_INFO, withMarker, type ProjectIdea, type ProjectModel, type ProjectTrack, type TrackStatus } from "./project-note";

export type Edit = InsertPlan;

/** Why a gesture was refused: the note changed since it was read, or the target is not in it. */
export type Refusal = "changed" | "not-found" | "empty-text";

export type WritePlan = { ok: true; edits: Edit[] } | { ok: false; reason: Refusal };

/** A line the caller read: its index and its text. `ProjectTrack` and `ProjectIdea` fit. */
export interface LineRef {
	line: number;
	raw: string;
}

export const DEFAULT_TRACKS_TITLE = "\u{1F9ED} Tracks";

const REFUSAL_MESSAGES: Record<Refusal, string> = {
	changed: "The note changed since it was read. Nothing was written.",
	"not-found": "VaultMate could not find this item in the note. Nothing was written.",
	"empty-text": "Write the task first.",
};

export function refusalMessage(reason: Refusal): string {
	return REFUSAL_MESSAGES[reason];
}

/** Applies edits made by a plan (in the order the plan gave them). */
export function applyEdits(lines: string[], edits: readonly Edit[]): string[] {
	return edits.reduce((current, edit) => applyPlan(current, edit), lines);
}

function byLineDescending(edits: Edit[]): Edit[] {
	return edits.sort((a, b) => b.at - a.at);
}

function refuse(reason: Refusal): WritePlan {
	return { ok: false, reason };
}

function checked(lines: readonly string[], ref: LineRef): boolean {
	return lines[ref.line] === ref.raw;
}

function findTrack(model: ProjectModel, ref: LineRef): ProjectTrack | undefined {
	return model.tracks.find((track) => track.line === ref.line);
}

// ---- Tasks --------------------------------------------------------------------------------------------

/** `- [ ] <text> ➕ <today>` plus ` 📅 <due>`; null when the text is empty. */
export function trackTaskLine(text: string, today: string, due?: string): string | null {
	const clean = text.replace(/\s+/g, " ").trim();
	if (clean === "") return null;
	return `- [ ] ${clean} ➕ ${today}${due ? ` \u{1F4C5} ${due}` : ""}`;
}

export interface NewTask {
	text: string;
	/** Today, `YYYY-MM-DD`. */
	today: string;
	/** Due date, `YYYY-MM-DD`; none when absent. */
	due?: string;
}

function taskEdit(lines: readonly string[], track: ProjectTrack, task: NewTask): Edit | null {
	const line = trackTaskLine(task.text, task.today, task.due);
	return line === null ? null : { at: appendPoint(lines, track.line + 1, track.end), remove: 0, lines: [line] };
}

/** Adds a task after the last non-blank line of the track's block. */
export function addTrackTask(lines: readonly string[], ref: LineRef, task: NewTask): WritePlan {
	if (!checked(lines, ref)) return refuse("changed");
	const track = findTrack(readProject(lines), ref);
	if (!track) return refuse("not-found");
	const edit = taskEdit(lines, track, task);
	return edit ? { ok: true, edits: [edit] } : refuse("empty-text");
}

// ---- Status -------------------------------------------------------------------------------------------

/**
 * Sets the status marker of a track heading and nothing else. With `firstTask`, the task is added in the
 * same plan (starting a track); an empty task text refuses, so leave `firstTask` out to skip it.
 */
export function setTrackStatus(lines: readonly string[], ref: LineRef, status: TrackStatus, firstTask?: NewTask): WritePlan {
	if (!checked(lines, ref)) return refuse("changed");
	const track = findTrack(readProject(lines), ref);
	if (!track) return refuse("not-found");
	const edits: Edit[] = [];
	if (firstTask) {
		const edit = taskEdit(lines, track, firstTask);
		if (!edit) return refuse("empty-text");
		edits.push(edit);
	}
	const heading = withMarker(track.raw, status);
	if (heading !== null) edits.push({ at: track.line, remove: 1, lines: [heading] });
	return { ok: true, edits: byLineDescending(edits) };
}

// ---- Ideas --------------------------------------------------------------------------------------------

function findIdea(model: ProjectModel, ref: LineRef): ProjectIdea | undefined {
	return model.ideas.find((idea) => idea.line === ref.line);
}

/** Removes the idea and its more-indented lines. */
export function dropIdea(lines: readonly string[], ref: LineRef): WritePlan {
	if (!checked(lines, ref)) return refuse("changed");
	const idea = findIdea(readProject(lines), ref);
	if (!idea) return refuse("not-found");
	return { ok: true, edits: [{ at: idea.line, remove: idea.end - idea.line, lines: [] }] };
}

/** Removes up to `columns` columns of leading whitespace (a tab counts as four). */
function dedentLine(line: string, columns: number): string {
	let removed = 0;
	let i = 0;
	for (; i < line.length && removed < columns; i++) {
		const char = line.charAt(i);
		if (char === " ") removed++;
		else if (char === "\t") removed += 4;
		else break;
	}
	return line.slice(i);
}

/** Children lines dedented by one level: the least indented of them ends up at the left margin. */
export function dedentChildren(children: readonly string[]): string[] {
	const columns = Math.min(...children.map((child) => width(splitLine(child).indent)));
	return children.map((child) => dedentLine(child, columns));
}

/** A track block from a list item: the heading `<#…> <marker> <text>`, then the item's lines dedented. */
export function trackFromIdea(level: number, status: TrackStatus, idea: Pick<ProjectIdea, "text" | "children">): string[] {
	return [`${"#".repeat(level)} ${STATUS_INFO[status].marker} ${idea.text}`, ...dedentChildren(idea.children)];
}

export interface PromoteOptions {
	/** Defaults to Explore. */
	status?: TrackStatus;
	/** Title of the Tracks section when the note has none yet. */
	tracksTitle?: string;
}

/**
 * Moves an idea to the end of the Tracks section as a track (blank line, heading, dedented lines). A
 * note without a Tracks section gets one just after the Ideas block.
 */
export function promoteIdea(lines: readonly string[], ref: LineRef, options: PromoteOptions = {}): WritePlan {
	if (!checked(lines, ref)) return refuse("changed");
	const model = readProject(lines);
	const idea = findIdea(model, ref);
	if (!idea || model.level === null || !model.ideasSection) return refuse("not-found");
	const track = trackFromIdea(model.level + 1, options.status ?? "explore", idea);
	const remove: Edit = { at: idea.line, remove: idea.end - idea.line, lines: [] };
	const { tracksSection, ideasSection } = model;
	if (tracksSection) return { ok: true, edits: byLineDescending([remove, { at: appendPoint(lines, tracksSection.line + 1, tracksSection.end), remove: 0, lines: ["", ...track] }]) };
	const heading = `${"#".repeat(model.level)} ${options.tracksTitle?.trim() || DEFAULT_TRACKS_TITLE}`;
	return { ok: true, edits: byLineDescending([remove, { at: appendPoint(lines, ideasSection.line + 1, ideasSection.end), remove: 0, lines: ["", heading, "", ...track] }]) };
}
