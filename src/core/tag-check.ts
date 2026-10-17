// The first-run check: does the vault already use the idea or project tag for something else? Pure counting
// over what the metadata cache reports, so Vitest can test it.
import { hasProjectTag } from "../features/projects/project-tag";

/** At this count or more, the check tells the user what VaultMate will read. */
export const TAG_CHECK_THRESHOLD = 20;

interface CachedTag {
	tag: string;
	position: { start: { line: number } };
}

interface CachedListItem {
	task?: string;
	position: { start: { line: number } };
}

/** The part of a note's cache the count needs. */
export interface CachedNote {
	tags?: CachedTag[];
	listItems?: CachedListItem[];
	frontmatter?: Record<string, unknown>;
}

/** Lines of the note that carry exactly the idea tag (not a subtag) and are not tasks: the ones VaultMate would show as ideas without being asked. */
export function countPlainIdeaLines(cache: CachedNote | null | undefined, ideaTag: string): number {
	if (!cache?.tags) return 0;
	const wanted = `#${ideaTag}`.toLowerCase();
	const taskLines = new Set((cache.listItems ?? []).filter((item) => item.task !== undefined).map((item) => item.position.start.line));
	const lines = new Set(cache.tags.filter((tag) => tag.tag.toLowerCase() === wanted).map((tag) => tag.position.start.line));
	return [...lines].filter((line) => !taskLines.has(line)).length;
}

export interface TagCheckCounts {
	/** Plain idea lines in the vault; null when Ideas is off. */
	ideaLines: number | null;
	/** Notes with the project tag; null when Projects is off. */
	projectNotes: number | null;
}

/** Counts over the caches of all notes; a feature that is off is not counted. */
export function countTagUse(caches: Iterable<CachedNote | null>, options: { ideasOn: boolean; ideaTag: string; projectsOn: boolean; projectTag: string }): TagCheckCounts {
	let ideaLines = 0;
	let projectNotes = 0;
	for (const cache of caches) {
		if (options.ideasOn) ideaLines += countPlainIdeaLines(cache, options.ideaTag);
		if (options.projectsOn && hasProjectTag(cache?.frontmatter, options.projectTag)) projectNotes++;
	}
	return { ideaLines: options.ideasOn ? ideaLines : null, projectNotes: options.projectsOn ? projectNotes : null };
}

/** Whether the counts are high enough to warn. */
export function needsTagNotice(counts: TagCheckCounts): boolean {
	return (counts.ideaLines ?? 0) >= TAG_CHECK_THRESHOLD || (counts.projectNotes ?? 0) >= TAG_CHECK_THRESHOLD;
}
