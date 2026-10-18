// The counting cases shared with the Android app (tests/contract/counts). The app runs the same notes and
// expected.json (copied by `npm run sync-contract`); both sides must give the same counts and statements.
import { describe, expect, it } from "vitest";

import { parseDate } from "../src/core/dates";
import { buildIdeaItem, type IdeaItem } from "../src/features/ideas/idea-line";
import { groupOpen, itemStatement, seedCount } from "../src/features/ideas/ideas-model";
import { groupByDue, indexedEntry, type JournalTags } from "../src/features/journal/journal-line";

interface Group {
	count: number;
	statements: string[];
}
interface Expected {
	today: string;
	fallbackDate: string;
	tags: { idea: string; seedSubtag: string; decision: string; prediction: string };
	ignoredFolders: string[];
	ideas: Record<"fresh" | "waiting" | "wilting" | "seeds", Group>;
	reviews: Record<"overdue" | "today" | "week" | "upcoming" | "undated", Group>;
	gaps: Record<string, { line: string; plugin: string; app: string }>;
}

const expected = JSON.parse(
	Object.values(import.meta.glob<string>("./contract/counts/expected.json", { query: "?raw", import: "default", eager: true }))[0] ?? "",
) as Expected;
const notes = Object.entries(import.meta.glob<string>("./contract/counts/vault/**/*.md", { query: "?raw", import: "default", eager: true })).map(([key, text]) => {
	const path = key.slice("./contract/counts/vault/".length);
	return { path, basename: (path.split("/").pop() ?? "").replace(/\.md$/, ""), lines: text.split(/\r?\n/) };
});

const today = parseDate(expected.today) as Date;
const tags: JournalTags = { decisionTag: expected.tags.decision, predictionTag: expected.tags.prediction };
const seed = { tag: expected.tags.idea, subtag: expected.tags.seedSubtag };

function counted(paths: (path: string) => boolean): typeof notes {
	return notes.filter((note) => paths(note.path));
}
const main = counted((path) => !expected.ignoredFolders.some((folder) => path.startsWith(`${folder}/`)));

function ideaItems(from: typeof notes): IdeaItem[] {
	return from.flatMap((note) =>
		note.lines.flatMap((_line, index) => buildIdeaItem(note.path, note.basename, expected.fallbackDate, index, note.lines, expected.tags.idea) ?? []),
	);
}

function reviewEntries(from: typeof notes) {
	return from.flatMap((note) => note.lines.flatMap((line) => indexedEntry(line, tags) ?? []).map(({ entry }) => ({ entry })));
}

const shown = (group: { entry: { statement: string } }[]): string[] => group.map((item) => item.entry.statement).sort();

describe("shared counting cases: ideas", () => {
	const items = ideaItems(main);
	const groups = groupOpen(items, today, seed);
	const statements = (group: IdeaItem[]): string[] => group.map(itemStatement).sort();

	it.each(["fresh", "waiting", "wilting"] as const)("%s ideas", (name) => {
		expect(statements(groups[name])).toEqual(expected.ideas[name].statements);
		expect(groups[name]).toHaveLength(expected.ideas[name].count);
	});

	it("project seeds", () => {
		const tended = Object.values(groups).flat();
		const seeds = Object.values(groupOpen(items, today)).flat().filter((item) => !tended.includes(item));
		expect(statements(seeds)).toEqual(expected.ideas.seeds.statements);
		expect(seedCount(items, seed)).toBe(expected.ideas.seeds.count);
	});
});

describe("shared counting cases: reviews", () => {
	const groups = groupByDue(reviewEntries(main), today);
	const dueToday = groups.week.filter((item) => item.entry.due === expected.today);

	it.each(["overdue", "week", "upcoming", "undated"] as const)("%s reviews", (name) => {
		expect(shown(groups[name])).toEqual(expected.reviews[name].statements);
		expect(groups[name]).toHaveLength(expected.reviews[name].count);
	});

	it("reviews due today", () => {
		expect(shown(dueToday)).toEqual(expected.reviews.today.statements);
		expect(dueToday).toHaveLength(expected.reviews.today.count);
	});
});

describe("shared counting cases: known gaps", () => {
	const gaps = counted((path) => path.startsWith("Gaps/"));

	it("a review with only a scheduled date is undated in the plugin (the app counts it as overdue)", () => {
		const groups = groupByDue(reviewEntries(gaps), today);
		expect(expected.gaps.reviewWithOnlyScheduledDate).toMatchObject({ plugin: "undated" });
		expect(shown(groups.undated)).toEqual([expected.gaps.reviewWithOnlyScheduledDate?.line]);
		expect(groups.overdue).toHaveLength(0);
	});

	it("a plain line with the idea tag is an open idea in the plugin (the app does not see it)", () => {
		const groups = groupOpen(ideaItems(gaps), today, seed);
		expect(expected.gaps.plainTaggedIdeaLine).toMatchObject({ plugin: "fresh" });
		expect(groups.fresh.map(itemStatement)).toEqual([expected.gaps.plainTaggedIdeaLine?.line]);
	});
});
