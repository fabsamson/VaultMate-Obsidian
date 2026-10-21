// Reading a project note: its sections, the ideas of the Ideas section and the tracks of the Tracks
// section. Pure: no Obsidian import, so Vitest tests it. The data contract is plan §2 "Projets : idées et
// pistes". Lines are given without their line break.
import { checkboxState, getDescription, getTaskDate, hasTag, isRecurring, parseTaskLine } from "../../core/task-line";
import { findHeadings, lastNonBlank, type Heading } from "../ai-actions/insertion";
import { classifyIdeaLine, isProjectSeed } from "../ideas/idea-line";
import { getChildren } from "../journal/journal-note";

// ---- Statuses and markers -----------------------------------------------------------------------------

export type TrackStatus = "explore" | "backlog" | "progress" | "done" | "dropped";

export const TRACK_STATUSES: readonly TrackStatus[] = ["explore", "backlog", "progress", "done", "dropped"];

/** The marker the tools write, and the status name of the English interface. */
export const STATUS_INFO: Record<TrackStatus, { marker: string; label: string }> = {
	explore: { marker: "★", label: "Explore" },
	backlog: { marker: "\u{1F4E5}", label: "Backlog" },
	progress: { marker: "\u{1F528}", label: "In progress" },
	done: { marker: "✅", label: "Done" },
	dropped: { marker: "\u{1F5D1}️", label: "Dropped" },
};

// Read forms: the star may be the emoji, the wastebasket may lack U+FE0F; any may carry a variation selector.
const MARKER_CHARS = "\\u2605|\\u2B50|\\u{1F4E5}|\\u{1F528}|\\u2705|\\u{1F5D1}";
const MARKER_RE = new RegExp(`^(?:${MARKER_CHARS})[\\uFE0E\\uFE0F]?`, "u");
/** A heading line cut into its `#` prefix, the marker as written (if any), the gap after it and the rest. */
const HEADING_MARKER_RE = new RegExp(`^( {0,3}#{1,6}[ \\t]+)(?:((?:${MARKER_CHARS})[\\uFE0E\\uFE0F]?)([ \\t]*))?`, "u");

function statusOfMarker(marker: string): TrackStatus {
	switch (marker.codePointAt(0)) {
		case 0x1f4e5:
			return "backlog";
		case 0x1f528:
			return "progress";
		case 0x2705:
			return "done";
		case 0x1f5d1:
			return "dropped";
		default:
			return "explore";
	}
}

export interface ParsedHeading {
	status: TrackStatus;
	/** The marker as written, or null when the heading has none (read as Explore). */
	marker: string | null;
	/** The rest of the heading text, untouched. */
	title: string;
}

/** Status and title of the text of a track heading (without the `#`s). */
export function parseTrackHeading(text: string): ParsedHeading {
	const match = MARKER_RE.exec(text);
	if (!match) return { status: "explore", marker: null, title: text };
	return { status: statusOfMarker(match[0]), marker: match[0], title: text.slice(match[0].length).trimStart() };
}

/**
 * The heading line with its marker set to the written marker of `status`: the marker is replaced in
 * place (the gap after it is kept) or added with one space. Null when the line already has exactly that
 * marker, or is not a heading. Nothing else on the line changes.
 */
export function withMarker(line: string, status: TrackStatus): string | null {
	const match = HEADING_MARKER_RE.exec(line);
	if (!match) return null;
	const wanted = STATUS_INFO[status].marker;
	const [whole, prefix = "", marker, gap = ""] = match;
	const rest = line.slice(whole.length);
	if (marker === wanted && (gap !== "" || rest === "")) return null;
	return `${prefix}${wanted}${gap === "" && rest !== "" ? " " : gap}${rest}`;
}

// ---- Sections -----------------------------------------------------------------------------------------

export type SectionKind = "tracks" | "ideas" | "improve" | "backlog" | "doing" | "done";

function fold(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// In this order: the first match wins. Text is folded (no accents, lower case) before the test.
const KIND_PATTERNS: ReadonlyArray<[SectionKind, RegExp]> = [
	["tracks", /\u{1F9ED}|\bpistes?\b|\btracks?\b/u],
	["ideas", /idea|idee/],
	["improve", /✨|amelior|improvement/u],
	["backlog", /\u{1F4E5}|backlog/u],
	["doing", /\u{1F528}|en cours|in progress|doing/u],
	["done", /✅|realis|done|achiev/u],
];

/** What a section heading means for a project note, or null. */
export function sectionKind(text: string): SectionKind | null {
	const folded = fold(text);
	return KIND_PATTERNS.find(([, pattern]) => pattern.test(folded))?.[0] ?? null;
}

/** Whether a heading text names the Tracks section (🧭, `piste(s)` or `track(s)`). */
export function isTracksHeading(text: string): boolean {
	return sectionKind(text) === "tracks";
}

export interface Section {
	kind: SectionKind;
	/** Index of the heading line. */
	line: number;
	level: number;
	/** Heading text as written. */
	title: string;
	/** Index after the section's last line: the next heading of the same or a higher level, else the line count. */
	end: number;
}

function endOfBlock(headings: readonly Heading[], heading: Heading, lineCount: number): number {
	return headings.find((candidate) => candidate.line > heading.line && candidate.level <= heading.level)?.line ?? lineCount;
}

/**
 * The sections of the template, at the level of the Tracks section, else at the level that holds most
 * recognized sections (the smaller one on a tie). Null level when nothing is recognized.
 */
function findSections(headings: readonly Heading[], lineCount: number): { level: number | null; sections: Section[] } {
	const recognized = headings.flatMap((heading) => {
		const kind = sectionKind(heading.text);
		return kind ? [{ heading, kind }] : [];
	});
	// A heading that says "track" below the level of the other sections is a sub-heading (a track of an
	// older note, "Track record"), not the Tracks section.
	const otherLevels = recognized.filter((entry) => entry.kind !== "tracks").map((entry) => entry.heading.level);
	const shallowest = otherLevels.length > 0 ? Math.min(...otherLevels) : Infinity;
	let level: number | null = null;
	for (const { heading, kind } of recognized) if (kind === "tracks" && heading.level <= shallowest && (level === null || heading.level < level)) level = heading.level;
	if (level === null) {
		const counts = new Map<number, number>();
		for (const { heading, kind } of recognized) if (kind !== "tracks") counts.set(heading.level, (counts.get(heading.level) ?? 0) + 1);
		let best = 0;
		for (const [candidate, count] of [...counts].sort((a, b) => a[0] - b[0])) {
			if (count > best) {
				best = count;
				level = candidate;
			}
		}
	}
	if (level === null) return { level, sections: [] };
	return {
		level,
		sections: recognized
			.filter((entry) => entry.heading.level === level && (entry.kind !== "tracks" || entry.heading.level <= shallowest))
			.map(({ heading, kind }) => ({ kind, line: heading.line, level: heading.level, title: heading.text, end: endOfBlock(headings, heading, lineCount) })),
	};
}

// ---- Fences and list items ----------------------------------------------------------------------------

/** For each line, whether it is inside a fenced code block (fence lines included). */
export function fenceMask(lines: readonly string[]): boolean[] {
	const mask: boolean[] = [];
	let fence: { char: string; length: number } | null = null;
	for (const line of lines) {
		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
		if (fence) {
			mask.push(true);
			if (marker && marker.charAt(0) === fence.char && marker.length >= fence.length && /^\s*(`{3,}|~{3,})\s*$/.test(line)) fence = null;
		} else if (marker) {
			fence = { char: marker.charAt(0), length: marker.length };
			mask.push(true);
		} else {
			mask.push(false);
		}
	}
	return mask;
}

/** The tag names (without `#`) that tell the lines of a project note apart. */
export interface ProjectTags {
	idea: string;
	decision: string;
	prediction: string;
	/** Sub-tag of the project seeds (`idea/<seed>`); empty when the setting is off. */
	seed: string;
}

/** A bullet is a plain list item of the Ideas section; a tagged idea is an open line with the idea tag, wherever it is. */
export type IdeaKind = "bullet" | "tagged";

export interface ProjectIdea {
	kind: IdeaKind;
	/** Index of the item's line. */
	line: number;
	raw: string;
	/** The item's text without its list marker (a tagged idea: its description, without checkbox, tags, fields and Tasks emojis). */
	text: string;
	/** Index after the item's last more-indented line. */
	end: number;
	/** The more-indented lines, as written. */
	children: string[];
}

const ITEM_RE = /^(?:[-*+]|\d{1,9}[.)])[ \t]+\S/;

/**
 * Top-level list items that are not tasks, in lines [from, to), outside fenced code, with their more-indented
 * lines. With `tags`, an item that carries the idea tag is left to `scanTaggedIdeas`.
 */
export function scanIdeas(lines: readonly string[], from: number, to: number, fence: readonly boolean[], tags?: ProjectTags): ProjectIdea[] {
	const ideas: ProjectIdea[] = [];
	for (let i = from; i < to; i++) {
		const raw = lines[i] ?? "";
		if (fence[i] || !ITEM_RE.test(raw) || parseTaskLine(raw).status !== null) continue;
		const end = Math.min(getChildren(lines, i).end + 1, to);
		if (!(tags && hasTag(parseTaskLine(raw).body, tags.idea))) ideas.push({ kind: "bullet", line: i, raw, text: parseTaskLine(raw).body.trim(), end, children: lines.slice(i + 1, end) });
		i = end - 1;
	}
	return ideas;
}

/** The first line after the frontmatter, where the Markdown body starts. */
function bodyStart(lines: readonly string[]): number {
	if (lines[0]?.trim() !== "---") return 0;
	const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	return end > 0 ? end + 1 : 0;
}

/**
 * The open ideas written with the idea tag, anywhere in the note outside fenced code: task lines and
 * tagged lines that are not tasks. Closed and cancelled ideas and project seeds are left out.
 */
export function scanTaggedIdeas(lines: readonly string[], fence: readonly boolean[], tags: ProjectTags): ProjectIdea[] {
	const ideas: ProjectIdea[] = [];
	for (let i = bodyStart(lines); i < lines.length; i++) {
		const raw = lines[i] ?? "";
		if (fence[i]) continue;
		const idea = classifyIdeaLine(raw, tags.idea);
		if (idea?.type !== "task" && idea?.type !== "plain") continue;
		const end = getChildren(lines, i).end + 1;
		const open = idea.type === "plain" || idea.entry.status === "open";
		if (open && !isProjectSeed(raw, tags.idea, tags.seed)) ideas.push({ kind: "tagged", line: i, raw, text: idea.type === "task" ? idea.entry.statement : idea.statement, end, children: lines.slice(i + 1, end) });
		i = end - 1; // the sub-items belong to the idea
	}
	return ideas;
}

// ---- Tracks -------------------------------------------------------------------------------------------

export interface TrackTask {
	line: number;
	raw: string;
	state: "open" | "done" | "cancelled";
	/** The description without tags, fields and Tasks emojis. */
	text: string;
	/** `YYYY-MM-DD` after 📅, or null. */
	due: string | null;
	/** The body has a 🔁 rule: only the Tasks plugin can create the next occurrence. */
	recurring: boolean;
}

export interface ProjectTrack {
	status: TrackStatus;
	/** The heading text after the marker, untouched. */
	title: string;
	/** Index of the heading line (the block's first line). */
	line: number;
	/** The heading line as written. */
	raw: string;
	level: number;
	/** Index after the block's last line, trailing blank lines included. */
	end: number;
	/** The task lines of the block at any depth, in order. */
	tasks: TrackTask[];
}

export interface ProjectModel {
	/** Level of the section headings, null when the note has no recognized section. */
	level: number | null;
	/** Every recognized section at that level, in order. */
	sections: Section[];
	ideasSection: Section | null;
	tracksSection: Section | null;
	doneSection: Section | null;
	ideas: ProjectIdea[];
	tracks: ProjectTrack[];
}

function firstOfKind(sections: readonly Section[], kind: SectionKind): Section | null {
	return sections.find((section) => section.kind === kind) ?? null;
}

/** `question` is the tag the README recommends for the questions of a note, whatever the settings. */
const QUESTION_TAG = "question";

/**
 * The task lines of a block. A track's tasks are all of them except the lines tagged with the idea,
 * decision or prediction tag (`tags`) or `question`: those are ideas, reviews and questions, not work.
 */
function readTasks(lines: readonly string[], from: number, to: number, fence: readonly boolean[], tags?: ProjectTags): TrackTask[] {
	const tasks: TrackTask[] = [];
	const aside = [QUESTION_TAG, ...(tags ? [tags.idea, tags.decision, tags.prediction] : [])];
	for (let i = from; i < to; i++) {
		const raw = lines[i] ?? "";
		const parsed = parseTaskLine(raw);
		if (fence[i] || parsed.marker === "" || parsed.status === null || aside.some((tag) => hasTag(parsed.body, tag))) continue;
		tasks.push({ line: i, raw, state: checkboxState(parsed.status), text: getDescription(parsed.body), due: getTaskDate(parsed.body, "due"), recurring: isRecurring(parsed.body) });
	}
	return tasks;
}

/**
 * Reads a project note. A note without a Tracks section has `tracksSection` null and no tracks. With
 * `tags`, the ideas also hold the note's open tagged ideas (see `scanTaggedIdeas`), and a track's tasks
 * leave out the idea, decision and prediction lines.
 */
export function readProject(lines: readonly string[], tags?: ProjectTags): ProjectModel {
	const headings = findHeadings([...lines]);
	const { level, sections } = findSections(headings, lines.length);
	const ideasSection = firstOfKind(sections, "ideas");
	const tracksSection = firstOfKind(sections, "tracks");
	const fence = fenceMask(lines);
	const tracks: ProjectTrack[] = [];
	if (tracksSection && level !== null) {
		for (const heading of headings) {
			if (heading.line <= tracksSection.line || heading.line >= tracksSection.end || heading.level !== level + 1) continue;
			const { status, title } = parseTrackHeading(heading.text);
			const end = endOfBlock(headings, heading, lines.length);
			tracks.push({ status, title, line: heading.line, raw: lines[heading.line] ?? "", level: heading.level, end, tasks: readTasks(lines, heading.line + 1, end, fence, tags) });
		}
	}
	return {
		level,
		sections,
		ideasSection,
		tracksSection,
		doneSection: firstOfKind(sections, "done"),
		ideas: [...(ideasSection ? scanIdeas(lines, ideasSection.line + 1, ideasSection.end, fence, tags) : []), ...(tags ? scanTaggedIdeas(lines, fence, tags) : [])].sort((a, b) => a.line - b.line),
		tracks,
	};
}

/** Where lines are appended to a block: after its last non-blank line (right after the heading when it has no content). */
export function appendPoint(lines: readonly string[], from: number, to: number): number {
	return lastNonBlank([...lines], from, to) + 1;
}

export function trackCounts(tracks: readonly ProjectTrack[]): Record<TrackStatus, number> {
	const counts: Record<TrackStatus, number> = { explore: 0, backlog: 0, progress: 0, done: 0, dropped: 0 };
	for (const track of tracks) counts[track.status]++;
	return counts;
}

export function openTasks(track: ProjectTrack): TrackTask[] {
	return track.tasks.filter((task) => task.state === "open");
}
