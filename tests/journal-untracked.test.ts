import { describe, expect, it } from "vitest";

import { canTrackAs, groupByDue, indexedEntry, isUntracked, tidyUp, type JournalTags } from "../src/features/journal/journal-line";

const TAGS: JournalTags = { decisionTag: "decision", predictionTag: "prediction" };

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

describe("canTrackAs", () => {
	it("tracks a decision line as a decision only, and a prediction line as a prediction only", () => {
		for (const line of ["- Rent will go up #decision", "- [ ] Move the book club #decision", "Decision: switch the backup"]) {
			expect(canTrackAs(line, "decision", TAGS)).toBe(true);
			expect(canTrackAs(line, "prediction", TAGS)).toBe(false);
		}
		for (const line of ["- The bakery reopens #prediction", "- [ ] It rains on Sunday #prediction/weather", "Prediction: it rains"]) {
			expect(canTrackAs(line, "prediction", TAGS)).toBe(true);
			expect(canTrackAs(line, "decision", TAGS)).toBe(false);
		}
	});

	it("lets a line without the tags become either kind", () => {
		expect(canTrackAs("- Book the train", "decision", TAGS)).toBe(true);
		expect(canTrackAs("- Book the train", "prediction", TAGS)).toBe(true);
	});

	it("refuses empty lines and entries already tracked or closed", () => {
		expect(canTrackAs("   ", "decision", TAGS)).toBe(false);
		expect(canTrackAs("- [ ] Move to Lyon #decision ➕ 2026-10-08 📅 2027-01-08", "decision", TAGS)).toBe(false);
		expect(canTrackAs("- [x] Move to Lyon #decision", "decision", TAGS)).toBe(false);
	});
});

describe("tidyUp", () => {
	const item = (line: string) => ({ entry: indexedEntry(line, TAGS)!.entry });

	it("counts untracked entries and entries closed without a review", () => {
		const items = [
			item("- A plain one #decision"),
			item("- [ ] Tracked #decision 📅 2026-10-20"),
			item("- [x] Ticked #decision ✅ 2026-10-10"),
			item("- [x] Reviewed #decision [outcome: better] [quality: good] ✅ 2026-10-10"),
		];
		const tidy = tidyUp(items, new Date(2026, 9, 18));
		expect(tidy.untracked.map((entry) => entry.entry.statement)).toEqual(["A plain one"]);
		expect(tidy.closed.map((entry) => entry.entry.statement)).toEqual(["Ticked"]);
		expect(tidy.total).toBe(2);
	});

	it("is empty when there is nothing to tidy", () => {
		expect(tidyUp([item("- [ ] Tracked #decision 📅 2026-10-20")], new Date(2026, 9, 18)).total).toBe(0);
	});
});
