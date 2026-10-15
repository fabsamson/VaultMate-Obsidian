import { describe, expect, it } from "vitest";

import { convertToEntry, groupByDue, indexedEntry, isUntracked, type ConvertOptions, type JournalTags } from "../src/features/journal/journal-line";

const TAGS: JournalTags = { decisionTag: "decision", predictionTag: "prediction" };
const OPTIONS: ConvertOptions = { kind: "prediction", tags: TAGS, today: "2026-10-16", due: "2027-01-16", confidence: 60 };

describe("indexedEntry", () => {
	it("keeps a plain tagged line as an open, undated entry to track", () => {
		const found = indexedEntry("- Move the standup to Tuesday #decision", TAGS);
		expect(found?.plain).toBe(true);
		expect(found?.entry).toMatchObject({ kind: "decision", status: "open", statement: "Move the standup to Tuesday", due: null, created: null });
		expect(found && isUntracked(found.entry)).toBe(true);
	});

	it("ignores the dates of a plain line until it is tracked", () => {
		expect(indexedEntry("- Rent will go up #prediction 📅 2026-12-01", TAGS)?.entry.due).toBeNull();
	});

	it("keeps a task as it is, and nothing for lines without the tags", () => {
		const task = indexedEntry("- [ ] Move to Lyon #decision ➕ 2026-10-08 📅 2027-01-08", TAGS);
		expect(task?.plain).toBe(false);
		expect(task && isUntracked(task.entry)).toBe(false);
		expect(indexedEntry("- [ ] Move to Lyon #decision", TAGS)?.entry.due).toBeNull();
		expect(indexedEntry("- Buy bread #errand", TAGS)).toBeNull();
		expect(indexedEntry("## A heading #decision", TAGS)).toBeNull();
	});

	it("puts plain lines with the undated entries to track", () => {
		const items = ["- A plain one #decision", "- [ ] An undated task #decision", "- [ ] Tracked #decision 📅 2026-10-20"].map((line) => ({ entry: indexedEntry(line, TAGS)!.entry }));
		const groups = groupByDue(items, new Date(2026, 9, 16));
		expect(groups.undated.map((item) => item.entry.statement)).toEqual(["A plain one", "An undated task"]);
		expect(groups.week).toHaveLength(1);
	});
});

describe("convertToEntry as the other kind", () => {
	it("turns the decision tag of a plain line into the prediction tag", () => {
		expect(convertToEntry("- Rent will go up next year #decision", OPTIONS)).toBe("- [ ] Rent will go up next year #prediction [confidence: 60%] ➕ 2026-10-16 📅 2027-01-16");
	});

	it("keeps the sub-tag and the place of the tag", () => {
		expect(convertToEntry("- [ ] The client signs #decision/work before Friday", OPTIONS)).toBe(
			"- [ ] The client signs #prediction/work before Friday [confidence: 60%] ➕ 2026-10-16 📅 2027-01-16",
		);
	});

	it("tracks a prediction line as a decision the same way", () => {
		expect(convertToEntry("- Take the train #prediction", { ...OPTIONS, kind: "decision", confidence: null })).toBe("- [ ] Take the train #decision ➕ 2026-10-16 📅 2027-01-16");
	});

	it("leaves a line that already has the tag of the kind as it was", () => {
		expect(convertToEntry("- Take the train #decision", { ...OPTIONS, kind: "decision", confidence: null })).toBe("- [ ] Take the train #decision ➕ 2026-10-16 📅 2027-01-16");
	});
});
