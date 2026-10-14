// Converting a legacy project note (sections Ideas, Improvements, Backlog, In progress, Done holding
// sub-headings and bullets) to tracks: plan §11.4. Pure: no Obsidian import, so Vitest tests it.
import { findHeadings, lastNonBlank, type Heading, type InsertPlan } from "../ai-actions/insertion";
import { DEFAULT_TRACKS_TITLE, trackFromIdea } from "./project-write";
import { fenceMask, parseTrackHeading, readProject, scanIdeas, STATUS_INFO, type SectionKind, type TrackStatus } from "./project-note";

export interface Conversion {
	/** The converted lines; the input itself (same array) when there was nothing to convert. */
	lines: string[];
	tracksCreated: number;
	sectionsRemoved: number;
}

/** Status of the tracks made from each legacy section. */
const SECTION_STATUS: Partial<Record<SectionKind, TrackStatus>> = {
	ideas: "explore",
	improve: "explore",
	backlog: "backlog",
	doing: "progress",
	done: "done",
};

/** Sections whose top-level bullets become tracks too, and that are removed once empty. */
const BULLET_SECTIONS: ReadonlySet<SectionKind> = new Set(["improve", "backlog", "doing"]);

/**
 * The sub-heading in its canonical form `<#…> <marker> <title>`, without indentation. A missing marker
 * or an existing ★ or ⭐ becomes the written marker of `status`; any other marker is kept as written.
 */
function convertHeading(level: number, status: TrackStatus, text: string): string {
	const { status: own, marker, title } = parseTrackHeading(text);
	const written = own === "explore" ? STATUS_INFO[status].marker : (marker ?? "");
	return `${"#".repeat(level)} ${written}${title === "" ? "" : ` ${title}`}`;
}

/** One edit replacing the lines that differ between `before` and `after` (common start and end kept); null when equal. */
export function diffEdit(before: readonly string[], after: readonly string[]): InsertPlan | null {
	let start = 0;
	while (start < before.length && start < after.length && before[start] === after[start]) start++;
	let tail = 0;
	while (tail < before.length - start && tail < after.length - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
	if (start === before.length && start === after.length) return null;
	return { at: start, remove: before.length - start - tail, lines: after.slice(start, after.length - tail) };
}

/**
 * Turns the legacy sections of a note into tracks at the end of the Tracks section (created after the
 * Ideas block, or at the end of the note, with `tracksTitle`). Sub-headings of the sections become
 * tracks with their blocks; top-level non-task bullets of Improvements, Backlog and In progress become
 * tracks like a promotion. Tasks and prose stay, and a section that was emptied is removed.
 */
export function convertProject(lines: readonly string[], tracksTitle: string = DEFAULT_TRACKS_TITLE): Conversion {
	const unchanged: Conversion = { lines: lines as string[], tracksCreated: 0, sectionsRemoved: 0 };
	const model = readProject(lines);
	if (model.level === null) return unchanged;
	const headings: Heading[] = findHeadings([...lines]);
	const fence = fenceMask(lines);
	const removed = new Array<boolean>(lines.length).fill(false);
	const moves: Array<{ line: number; lines: string[] }> = [];
	const trackLevel = model.level + 1;
	const remove = (from: number, to: number): void => void removed.fill(true, from, to);

	for (const section of model.sections) {
		const status = SECTION_STATUS[section.kind];
		if (!status) continue;
		const touch = (line: number, block: string[], from: number, to: number): void => {
			moves.push({ line, lines: block });
			remove(from, to);
		};
		for (const heading of headings) {
			if (heading.line <= section.line || heading.line >= section.end || heading.level !== trackLevel) continue;
			const next = headings.find((candidate) => candidate.line > heading.line && candidate.level <= heading.level)?.line ?? lines.length;
			const end = lastNonBlank([...lines], heading.line + 1, next) + 1;
			touch(heading.line, [convertHeading(heading.level, status, heading.text), ...lines.slice(heading.line + 1, end)], heading.line, end);
		}
		if (!BULLET_SECTIONS.has(section.kind)) continue;
		for (const idea of scanIdeas(lines, section.line + 1, section.end, fence)) {
			if (!removed[idea.line]) touch(idea.line, trackFromIdea(trackLevel, status, idea), idea.line, idea.end);
		}
	}

	let sectionsRemoved = 0;
	for (const section of model.sections) {
		if (!BULLET_SECTIONS.has(section.kind)) continue;
		let empty = true;
		for (let i = section.line + 1; i < section.end; i++) if (!removed[i] && (lines[i] ?? "").trim() !== "") empty = false;
		if (!empty) continue;
		remove(section.line, section.end);
		sectionsRemoved++;
	}
	if (moves.length === 0 && sectionsRemoved === 0 && model.tracksSection) return unchanged;

	moves.sort((a, b) => a.line - b.line);
	const appended = moves.flatMap((move) => ["", ...move.lines]);
	const { tracksSection, ideasSection } = model;
	const title = tracksTitle.trim() || DEFAULT_TRACKS_TITLE;
	let anchor: number;
	let inserted: string[];
	if (tracksSection) {
		anchor = lastNonBlank([...lines], tracksSection.line + 1, tracksSection.end) + 1;
		inserted = appended;
	} else {
		anchor = ideasSection ? lastNonBlank([...lines], ideasSection.line + 1, ideasSection.end) + 1 : lastNonBlank([...lines], 0, lines.length) + 1;
		inserted = ["", `${"#".repeat(model.level)} ${title}`, ...appended];
	}

	// Rebuild the note, keeping at most one blank line where lines were removed or inserted.
	const out: string[] = [];
	let fresh = false;
	const push = (line: string): void => {
		const blank = line.trim() === "";
		if (blank && fresh && out.length > 0 && (out[out.length - 1] ?? "").trim() === "") return;
		out.push(line);
		if (!blank) fresh = false;
	};
	const insert = (): void => {
		fresh = true;
		inserted.forEach(push);
		fresh = true;
	};
	for (let i = 0; i < lines.length; i++) {
		if (i === anchor) insert();
		if (removed[i]) {
			fresh = true;
			continue;
		}
		push(lines[i] ?? "");
	}
	if (anchor >= lines.length) insert();
	return { lines: out, tracksCreated: moves.length, sectionsRemoved };
}
