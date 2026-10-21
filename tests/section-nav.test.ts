import { describe, expect, it } from "vitest";

import { buildIdeaItem, type IdeaItem } from "../src/features/ideas/idea-line";
import { ideasSections } from "../src/features/ideas/ideas-model";
import { indexedEntry } from "../src/features/journal/journal-line";
import { journalSections } from "../src/features/journal/journal-sections";
import { visibleChips } from "../src/ui/section-chips";

describe("visibleChips", () => {
	it("leaves out empty sections", () => {
		expect(visibleChips([{ count: 2 }, { count: 0 }, { count: 1 }])).toEqual([{ count: 2 }, { count: 1 }]);
	});
	it("shows nothing for fewer than two chips", () => {
		expect(visibleChips([{ count: 3 }, { count: 0 }])).toEqual([]);
		expect(visibleChips([])).toEqual([]);
	});
});

const TODAY = new Date(2026, 9, 21);
const idea = (line: string): IdeaItem => {
	const found = buildIdeaItem("A.md", "A", "2026-10-01", 0, [line], "idea");
	if (!found) throw new Error("not an idea");
	return found;
};
const IDEAS = [
	idea("- [ ] Fresh one #idea ➕ 2026-10-20"),
	idea("- [ ] Waiting one #idea ➕ 2026-10-14"),
	idea("- [ ] Waiting two #idea ➕ 2026-10-10"),
	idea("- [ ] Wilting one #idea ➕ 2026-09-01"),
	idea("- [ ] A seed #idea/seed ➕ 2026-10-20"),
	idea("- [x] Done one #idea [result: dropped] ✅ 2026-10-15"),
];
const counts = (sections: Array<{ id: string; count: number }>) => Object.fromEntries(sections.map((section) => [section.id, section.count]));

describe("ideasSections", () => {
	it("counts each age group, the seeds and the processed ideas", () => {
		expect(counts(ideasSections(IDEAS, TODAY, { tag: "idea", subtag: "seed" }))).toEqual({ fresh: 1, waiting: 2, wilting: 1, seeds: 1, processed: 1 });
	});
	it("has no seeds when the sub-tag is off", () => {
		const sections = counts(ideasSections(IDEAS, TODAY, { tag: "idea", subtag: "" }));
		expect(sections.seeds).toBe(0);
		expect(sections.fresh).toBe(2);
	});
	it("follows the items it is given (the page passes the search result)", () => {
		const kept = IDEAS.filter((item) => item.raw.includes("Waiting"));
		expect(counts(ideasSections(kept, TODAY, { tag: "idea", subtag: "seed" }))).toEqual({ fresh: 0, waiting: 2, wilting: 0, seeds: 0, processed: 0 });
	});
});

const TAGS = { decisionTag: "decision", predictionTag: "prediction" };
const entry = (line: string) => ({ path: "A.md", line: 0, raw: line, children: [], entry: indexedEntry(line, TAGS)!.entry });
const ENTRIES = [
	entry("- [ ] Plain #decision"),
	entry("- [ ] Late #decision 📅 2026-10-10"),
	entry("- [ ] Soon #decision 📅 2026-10-24"),
	entry("- [ ] Later #decision 📅 2026-12-01"),
	entry("- [ ] Later too #decision 📅 2026-12-02"),
	entry("- [x] Ticked #decision ✅ 2026-10-10"),
	entry("- [x] Reviewed #decision [outcome: better] [quality: good] ✅ 2026-10-10"),
];

describe("journalSections", () => {
	it("counts the review groups, Tidy up and the reviews done", () => {
		expect(counts(journalSections(ENTRIES, TODAY, false))).toEqual({ untracked: 1, overdue: 1, week: 1, upcoming: 2, tidy: 1, record: 1 });
	});
	it("drops the track record while searching", () => {
		expect(counts(journalSections(ENTRIES, TODAY, true)).record).toBe(0);
	});
	it("counts only what the search kept", () => {
		const kept = ENTRIES.filter((item) => item.entry.statement.startsWith("Later"));
		expect(counts(journalSections(kept, TODAY, true))).toEqual({ untracked: 0, overdue: 0, week: 0, upcoming: 2, tidy: 0, record: 0 });
	});
	it("gives a navigation row only when two sections have something", () => {
		const only = ENTRIES.slice(0, 1);
		expect(visibleChips(journalSections(only, TODAY, false))).toEqual([]);
		expect(visibleChips(journalSections(ENTRIES, TODAY, false))).toHaveLength(6);
	});
});
