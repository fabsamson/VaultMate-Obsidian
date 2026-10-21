// The first-run check: does the vault already use the idea, decision, prediction or project tag for something else? Pure counting
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

/** Lines of the note that carry exactly `tag` (not a subtag) and are not tasks: the ones VaultMate would show without being asked. */
export function countPlainTagLines(cache: CachedNote | null | undefined, tag: string): number {
	if (!cache?.tags) return 0;
	const wanted = `#${tag}`.toLowerCase();
	const taskLines = new Set((cache.listItems ?? []).filter((item) => item.task !== undefined).map((item) => item.position.start.line));
	const lines = new Set(cache.tags.filter((entry) => entry.tag.toLowerCase() === wanted).map((entry) => entry.position.start.line));
	return [...lines].filter((line) => !taskLines.has(line)).length;
}

export interface TagCheckCounts {
	/** Plain idea lines in the vault; null when Ideas is off. */
	ideaLines: number | null;
	/** Plain decision and prediction lines; null when the journal is off. */
	decisionLines: number | null;
	predictionLines: number | null;
	/** Notes with the project tag; null when Projects is off. */
	projectNotes: number | null;
}

export interface TagCheckOptions {
	ideasOn: boolean;
	ideaTag: string;
	journalOn: boolean;
	decisionTag: string;
	predictionTag: string;
	projectsOn: boolean;
	projectTag: string;
}

/** Counts over the caches of all notes; a feature that is off is not counted. */
export function countTagUse(caches: Iterable<CachedNote | null>, options: TagCheckOptions): TagCheckCounts {
	let ideaLines = 0;
	let decisionLines = 0;
	let predictionLines = 0;
	let projectNotes = 0;
	for (const cache of caches) {
		if (options.ideasOn) ideaLines += countPlainTagLines(cache, options.ideaTag);
		if (options.journalOn) {
			decisionLines += countPlainTagLines(cache, options.decisionTag);
			predictionLines += countPlainTagLines(cache, options.predictionTag);
		}
		if (options.projectsOn && hasProjectTag(cache?.frontmatter, options.projectTag)) projectNotes++;
	}
	return {
		ideaLines: options.ideasOn ? ideaLines : null,
		decisionLines: options.journalOn ? decisionLines : null,
		predictionLines: options.journalOn ? predictionLines : null,
		projectNotes: options.projectsOn ? projectNotes : null,
	};
}

/** Whether the counts are high enough to warn. */
export function needsTagNotice(counts: TagCheckCounts): boolean {
	return [counts.ideaLines, counts.decisionLines, counts.predictionLines, counts.projectNotes].some((count) => (count ?? 0) >= TAG_CHECK_THRESHOLD);
}
