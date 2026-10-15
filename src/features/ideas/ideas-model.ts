// What the idea badge, the portal and the hub page show: labels, grouping, filtering and counts.
// Pure: no Obsidian import, so Vitest tests it.
import { formatDate } from "../../core/dates";
import { ageGroup, ideaAge, isProjectSeed, type AgeGroup, type IdeaClass, type IdeaItem, type IdeaResult } from "./idea-line";

type OpenOrProcessed = Extract<IdeaClass, { type: "task" | "plain" }>;

/** Whether the idea still waits for a decision: a tagged line, or a task that is not done or cancelled. */
export function isOpenIdea(idea: OpenOrProcessed): boolean {
	return idea.type === "plain" || idea.entry.status === "open";
}

function plural(count: number, unit: string): string {
	return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** `today`, `1 day`, `5 days`; a future or unreadable date counts as today. */
export function ageText(days: number | null): string {
	return days === null || days <= 0 ? "today" : plural(days, "day");
}

/** `Planted today`, `Planted 1 day ago`, `Planted 3 days ago`. */
export function plantedText(days: number | null): string {
	return days === null || days <= 0 ? "Planted today" : `Planted ${plural(days, "day")} ago`;
}

// ---- Badge ------------------------------------------------------------------------------------------

export interface IdeaBadgeInfo {
	/** Visible text. */
	text: string;
	/** What a click does: open the portal for an open idea, open the note it went to, nothing. */
	action: "portal" | "note" | "none";
	/** Accessible name of a button badge. */
	label: string;
}

export const RESULT_LABELS: Record<IdeaResult, string> = {
	"new-note": "New note",
	added: "Added",
	decision: "Decision",
	prediction: "Prediction",
	dropped: "Dropped",
};

/** The label of how an idea was processed; `Done` when the result is unknown. */
export function resultLabel(result: IdeaResult | null): string {
	return result === null ? "Done" : RESULT_LABELS[result];
}

/** The badge of an idea line. `target` is the link text of the note a processed idea went to, or null. */
export function ideaBadge(idea: OpenOrProcessed, today: Date, target: string | null): IdeaBadgeInfo {
	if (idea.type === "plain") return { text: "Idea", action: "portal", label: "Process this idea. Idea" };
	const { entry } = idea;
	if (entry.status === "open") {
		const age = entry.created === null ? null : ideaAge(entry.created, today);
		const text = age === null ? "Idea" : `Idea · ${ageText(age)}`;
		return { text, action: "portal", label: `Process this idea. ${text}` };
	}
	const word = resultLabel(entry.result);
	if (target !== null && (entry.result === "added" || entry.result === "new-note")) {
		const text = `${word} · ${target}`;
		return { text, action: "note", label: `Open ${target}. ${text}` };
	}
	return { text: word, action: "none", label: word };
}

// ---- Hub page ---------------------------------------------------------------------------------------

/** The items whose note path is in `allowed`; all of them when `allowed` is null (whole vault). */
export function inScope(items: readonly IdeaItem[], allowed: ReadonlySet<string> | null): IdeaItem[] {
	return allowed === null ? [...items] : items.filter((item) => allowed.has(item.path));
}

function byAge(a: IdeaItem, b: IdeaItem): number {
	return a.date.localeCompare(b.date) || a.path.localeCompare(b.path) || a.line - b.line;
}

/** The project seeds: open ideas tagged `#<tag>/<subtag>`. Seeds wait for a project, so they are not tended. */
export interface SeedFilter {
	/** The idea tag, without #. */
	tag: string;
	/** The seed sub-tag; empty = no seeds. */
	subtag: string;
}

function isOpenSeed(item: IdeaItem, seed: SeedFilter | undefined): boolean {
	return seed !== undefined && isOpenIdea(item.idea) && isProjectSeed(item.raw, seed.tag, seed.subtag);
}

/** How many project seeds wait in these items. */
export function seedCount(items: readonly IdeaItem[], seed: SeedFilter): number {
	return items.filter((item) => isOpenSeed(item, seed)).length;
}

export type OpenGroups = Record<AgeGroup, IdeaItem[]>;

/** The open ideas by age group, the oldest first in each; project seeds (when `seed` is given) are left out. */
export function groupOpen(items: readonly IdeaItem[], today: Date, seed?: SeedFilter): OpenGroups {
	const groups: OpenGroups = { fresh: [], waiting: [], wilting: [] };
	for (const item of [...items].sort(byAge)) {
		if (isOpenIdea(item.idea) && !isOpenSeed(item, seed)) groups[ageGroup(item.date, today)].push(item);
	}
	return groups;
}

/** The fresh ideas, oldest first: what Tend mode goes through. */
export function tendQueue(items: readonly IdeaItem[], today: Date, seed?: SeedFilter): IdeaItem[] {
	return groupOpen(items, today, seed).fresh;
}

/** `3 fresh · 2 waiting · 5 wilting` (zero parts left out), or `Nothing to tend`. */
export function tendSummary(items: readonly IdeaItem[], today: Date, seed?: SeedFilter): string {
	const groups = groupOpen(items, today, seed);
	const parts = [
		groups.fresh.length > 0 ? `${groups.fresh.length} fresh` : "",
		groups.waiting.length > 0 ? `${groups.waiting.length} waiting` : "",
		groups.wilting.length > 0 ? `${groups.wilting.length} wilting` : "",
	].filter(Boolean);
	return parts.length > 0 ? parts.join(" · ") : "Nothing to tend";
}

export type ProcessedFilter = "all" | IdeaResult;

export const PROCESSED_FILTERS: ReadonlyArray<{ value: ProcessedFilter; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "new-note", label: "New note" },
	{ value: "added", label: "Added" },
	{ value: "decision", label: "Decision" },
	{ value: "prediction", label: "Prediction" },
	{ value: "dropped", label: "Dropped" },
];

/** The result of a processed item, or null for an open one or an unknown result. */
export function itemResult(item: IdeaItem): IdeaResult | null {
	return item.idea.type === "task" ? item.idea.entry.result : null;
}

/** The done date of a processed item, or null. */
export function doneDate(item: IdeaItem): string | null {
	return item.idea.type === "task" ? item.idea.entry.done : null;
}

/** The statement of an item, as the index read it. */
export function itemStatement(item: IdeaItem): string {
	return item.idea.type === "task" ? item.idea.entry.statement : item.idea.statement;
}

/** The processed ideas matching `filter`, newest done date first (no date last). */
export function processedRows(items: readonly IdeaItem[], filter: ProcessedFilter): IdeaItem[] {
	const rows = items.filter((item) => !isOpenIdea(item.idea) && (filter === "all" || itemResult(item) === filter));
	return rows.sort((a, b) => (doneDate(b) ?? "").localeCompare(doneDate(a) ?? "") || byAge(b, a));
}

/** `This month: 12 planted · 3 new notes · 2 added · 1 decision · 6 dropped`: planted by creation month, results by done month, zero results left out. */
export function monthSummary(items: readonly IdeaItem[], today: Date): string {
	const month = formatDate(today).slice(0, 7);
	const planted = items.filter((item) => item.date.startsWith(month)).length;
	const count = (result: IdeaResult): number => items.filter((item) => doneDate(item)?.startsWith(month) === true && itemResult(item) === result).length;
	const parts = [`${planted} planted`];
	const results: Array<[IdeaResult, (n: number) => string]> = [
		["new-note", (n) => plural(n, "new note")],
		["added", (n) => `${n} added`],
		["decision", (n) => plural(n, "decision")],
		["prediction", (n) => plural(n, "prediction")],
		["dropped", (n) => `${n} dropped`],
	];
	for (const [result, text] of results) {
		const n = count(result);
		if (n > 0) parts.push(text(n));
	}
	return `This month: ${parts.join(" · ")}`;
}
