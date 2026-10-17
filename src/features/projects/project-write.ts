// What the project gestures write: a status change, a promoted or dropped idea, a track task. Pure
// planning: every plan is a list of splices of the note's lines (`InsertPlan`, positions in the lines the
// plan was made from), ordered from the end of the note to its start so that they apply one after the
// other, by the write gateway (`core/note-write`). Each gesture checks that
// the line it targets still has the text the caller read and refuses otherwise.
import { lastNonBlank, type InsertPlan } from "../ai-actions/insertion";
import { childLines, indentUnit, type ChildLine } from "../ideas/idea-note";
import { splitLine, width } from "../journal/journal-note";
import { appendPoint, readProject, STATUS_INFO, withMarker, type ProjectIdea, type ProjectModel, type ProjectTags, type ProjectTrack, type TrackStatus } from "./project-note";

export type Edit = InsertPlan;

/** Why a gesture was refused: the note changed since it was read, or the target is not in it. */
export type Refusal = "changed" | "not-found" | "empty-text" | "empty-name" | "not-a-project";

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
	"empty-name": "Write a short name first.",
	"not-a-project": "This note no longer has the project tag in its tags property. Nothing was written.",
};

export function refusalMessage(reason: Refusal): string {
	return REFUSAL_MESSAGES[reason];
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

function findIdea(model: ProjectModel, ref: LineRef, kind?: ProjectIdea["kind"]): ProjectIdea | undefined {
	return model.ideas.find((idea) => idea.line === ref.line && (kind === undefined || idea.kind === kind));
}

/** Removes a bullet idea and its more-indented lines. A tagged idea is not removed but closed: that is the Ideas feature's drop. */
export function dropIdea(lines: readonly string[], ref: LineRef): WritePlan {
	if (!checked(lines, ref)) return refuse("changed");
	const idea = findIdea(readProject(lines), ref, "bullet");
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

/** A first line that Markdown would read as a heading, quote or list item gets a backslash. */
const MARKDOWN_START_RE = /^(?:[#>+*-]|\d+[.)])/;

/**
 * A track block from a list item: the heading `<#…> <marker> <name>`, then the full text as the first line
 * when `name` differs from it, then the item's lines dedented, then `task` (a task line) if given. Without
 * `name` the heading is the whole text, as before short names.
 */
export function trackFromIdea(level: number, status: TrackStatus, idea: Pick<ProjectIdea, "text" | "children">, name: string = idea.text, task: string | null = null): string[] {
	const text = idea.text.trim();
	const first = name.trim() === text ? [] : [MARKDOWN_START_RE.test(text) ? `\\${text}` : text];
	return [`${"#".repeat(level)} ${STATUS_INFO[status].marker} ${name}`, ...first, ...(idea.children.length > 0 ? dedentChildren(idea.children) : []), ...(task === null ? [] : [task])];
}

export interface PromoteOptions {
	/** Defaults to Explore. */
	status?: TrackStatus;
	/** Title of the Tracks section when the note has none yet. */
	tracksTitle?: string;
	/** The heading text; defaults to the whole idea text. The caller cleans it (`shortName`). */
	shortName?: string;
	/** Added as the track's first task when the status is In progress. */
	firstTask?: NewTask;
	/** The tags that tell the ideas of the note apart; needed to promote a tagged idea. */
	tags?: ProjectTags;
}

/** The edit that appends `track` (a block) at the end of the Tracks section, creating the section when the note has none. */
function appendTrackEdit(lines: readonly string[], model: ProjectModel, track: string[], tracksTitle: string | undefined): Edit {
	const { tracksSection, ideasSection } = model;
	if (tracksSection) return { at: appendPoint(lines, tracksSection.line + 1, tracksSection.end), remove: 0, lines: ["", ...track] };
	const heading = `${"#".repeat(model.level ?? 1)} ${tracksTitle?.trim() || DEFAULT_TRACKS_TITLE}`;
	const at = ideasSection ? appendPoint(lines, ideasSection.line + 1, ideasSection.end) : lastNonBlank([...lines], 0, lines.length) + 1;
	return { at, remove: 0, lines: ["", heading, "", ...track] };
}

/**
 * Moves an idea to the end of the Tracks section as a track (blank line, heading, dedented lines). A
 * note without a Tracks section gets one just after the Ideas block. A tagged idea (`options.tags`) moves
 * like a bullet; its text is its description.
 */
export function promoteIdea(lines: readonly string[], ref: LineRef, options: PromoteOptions = {}): WritePlan {
	if (!checked(lines, ref)) return refuse("changed");
	const model = readProject(lines, options.tags);
	const idea = findIdea(model, ref);
	if (!idea) return refuse("not-found");
	const status = options.status ?? "explore";
	if (options.shortName !== undefined && options.shortName.trim() === "") return refuse("empty-name");
	const name = options.shortName?.replace(/\s+/g, " ").trim();
	const task = status === "progress" && options.firstTask ? trackTaskLine(options.firstTask.text, options.firstTask.today, options.firstTask.due) : null;
	const track = trackFromIdea((model.level ?? 1) + 1, status, idea, name, task);
	const remove: Edit = { at: idea.line, remove: idea.end - idea.line, lines: [] };
	return { ok: true, edits: byLineDescending([remove, appendTrackEdit(lines, model, track, options.tracksTitle)]) };
}

export interface NewTrack {
	/** The heading text; the caller cleans it (`shortName`). */
	name: string;
	status: TrackStatus;
	/** The full text of the idea. */
	text: string;
	/** The idea's sub-items, copied below the text. */
	children: readonly ChildLine[];
	/** Added as the first task when the status is In progress. */
	firstTask?: NewTask;
}

/**
 * Appends a track from an idea written in another note at the end of this note's Tracks section (a
 * missing section is created, with `tracksTitle`).
 */
export function newTrackInNote(lines: readonly string[], track: NewTrack, options: { tracksTitle?: string } = {}): WritePlan {
	const model = readProject(lines);
	const name = track.name.replace(/\s+/g, " ").trim();
	if (name === "") return refuse("empty-name");
	const task = track.status === "progress" && track.firstTask ? trackTaskLine(track.firstTask.text, track.firstTask.today, track.firstTask.due) : null;
	const block = trackFromIdea((model.level ?? 1) + 1, track.status, { text: track.text, children: childLines(track.children, indentUnit([...lines])) }, name, task);
	return { ok: true, edits: [appendTrackEdit(lines, model, block, options.tracksTitle)] };
}

/**
 * Puts a dropped idea back where it was: its lines go in at `idea.line`, provided the line now there is
 * still `lineAfter` (the line that followed the idea when it was dropped, undefined at the end of the note).
 */
export function undoDropIdea(lines: readonly string[], idea: Pick<ProjectIdea, "line" | "raw" | "children">, lineAfter: string | undefined): WritePlan {
	if (lines[idea.line] !== lineAfter || idea.line > lines.length) return refuse("changed");
	return { ok: true, edits: [{ at: idea.line, remove: 0, lines: [idea.raw, ...idea.children] }] };
}
