import { describe, expect, it } from "vitest";

import { buildIdeaItem, classifyIdeaLine, type IdeaItem } from "../src/features/ideas/idea-line";
import { ageText, groupOpen, ideaBadge, inScope, isOpenIdea, monthSummary, plantedText, processedRows, tendQueue, tendSummary } from "../src/features/ideas/ideas-model";

const TODAY = new Date(2026, 9, 13);

function item(line: string, path = "A.md", created = "2026-10-01"): IdeaItem {
	const found = buildIdeaItem(path, "A", created, 0, [line], "idea");
	if (!found) throw new Error("not an idea");
	return found;
}

function badge(line: string, target: string | null = null) {
	const cls = classifyIdeaLine(line, "idea");
	if (cls?.type !== "task" && cls?.type !== "plain") throw new Error("not an idea");
	return ideaBadge(cls, TODAY, target);
}

describe("ages", () => {
	it("writes days", () => {
		expect(ageText(0)).toBe("today");
		expect(ageText(-2)).toBe("today");
		expect(ageText(null)).toBe("today");
		expect(ageText(1)).toBe("1 day");
		expect(ageText(5)).toBe("5 days");
		expect(plantedText(0)).toBe("Planted today");
		expect(plantedText(1)).toBe("Planted 1 day ago");
		expect(plantedText(3)).toBe("Planted 3 days ago");
	});
});

describe("ideaBadge", () => {
	it("shows the age of an open task", () => {
		expect(badge("- [ ] Try it #idea ➕ 2026-10-13")).toMatchObject({ text: "Idea · today", action: "portal" });
		expect(badge("- [ ] Try it #idea ➕ 2026-10-12").text).toBe("Idea · 1 day");
		expect(badge("- [ ] Try it #idea ➕ 2026-10-08").text).toBe("Idea · 5 days");
	});
	it("shows Idea for a task without date and for a plain tagged line", () => {
		expect(badge("- [ ] Try it #idea").text).toBe("Idea");
		expect(badge("Try it #idea")).toMatchObject({ text: "Idea", action: "portal" });
		expect(badge("- Try it #idea").label).toBe("Process this idea. Idea");
	});
	it("names the target of an idea sent to a note", () => {
		expect(badge("- [x] Try it #idea [result: added] ➕ 2026-10-01 ✅ 2026-10-02", "Target")).toMatchObject({
			text: "Added · Target",
			action: "note",
			label: "Open Target. Added · Target",
		});
		expect(badge("- [x] Try it #idea [result: new-note] ✅ 2026-10-02", "Target").text).toBe("New note · Target");
	});
	it("shows the other results as plain text", () => {
		expect(badge("- [x] Try it #idea [result: added] ✅ 2026-10-02")).toMatchObject({ text: "Added", action: "none" });
		expect(badge("- [x] Try it #idea [result: decision] ✅ 2026-10-02", "Target").text).toBe("Decision");
		expect(badge("- [x] Try it #idea [result: prediction] ✅ 2026-10-02").text).toBe("Prediction");
		expect(badge("- [x] Try it #idea [result: dropped] ✅ 2026-10-02").text).toBe("Dropped");
		expect(badge("- [x] Try it #idea ✅ 2026-10-02").text).toBe("Done");
		expect(badge("- [-] Try it #idea").text).toBe("Done");
	});
});

describe("open ideas", () => {
	const items = [
		item("- [ ] Fresh #idea ➕ 2026-10-12", "A.md", "2026-10-12"),
		item("- [ ] Wait #idea ➕ 2026-10-05", "B.md"),
		item("- [ ] Old b #idea ➕ 2026-09-02", "B.md"),
		item("- [ ] Old a #idea ➕ 2026-09-01", "C.md"),
		item("Plain #idea", "D.md", "2026-10-13"),
		item("- [x] Done #idea [result: dropped] ➕ 2026-10-01 ✅ 2026-10-02"),
	];
	it("tells open ideas from processed ones", () => {
		expect(items.map((entry) => isOpenIdea(entry.idea))).toEqual([true, true, true, true, true, false]);
	});
	it("groups by age, oldest first", () => {
		const groups = groupOpen(items, TODAY);
		expect(groups.fresh.map((entry) => entry.path)).toEqual(["A.md", "D.md"]);
		expect(groups.waiting.map((entry) => entry.path)).toEqual(["B.md"]);
		expect(groups.wilting.map((entry) => entry.date)).toEqual(["2026-09-01", "2026-09-02"]);
		expect(tendQueue(items, TODAY).map((entry) => entry.path)).toEqual(["A.md", "D.md"]);
	});
	it("summarizes, leaving zero parts out", () => {
		expect(tendSummary(items, TODAY)).toBe("2 fresh · 1 waiting · 2 wilting");
		expect(tendSummary([items[1]], TODAY)).toBe("1 waiting");
		expect(tendSummary([items[5]], TODAY)).toBe("Nothing to tend");
		expect(tendSummary([], TODAY)).toBe("Nothing to tend");
	});
	it("filters by scope", () => {
		expect(inScope(items, null)).toHaveLength(6);
		expect(inScope(items, new Set(["B.md"]))).toHaveLength(2);
	});
});

describe("processed ideas", () => {
	const items = [
		item("- [x] One #idea [result: added] ✅ 2026-10-02", "A.md"),
		item("- [x] Two #idea [result: dropped] ✅ 2026-10-09", "B.md"),
		item("- [x] Three #idea ✅ 2026-10-05", "C.md"),
		item("- [-] Four #idea", "D.md"),
		item("- [ ] Open #idea", "E.md"),
	];
	it("sorts by done date, newest first, undated last", () => {
		expect(processedRows(items, "all").map((entry) => entry.path)).toEqual(["B.md", "C.md", "A.md", "D.md"]);
	});
	it("filters by result", () => {
		expect(processedRows(items, "added").map((entry) => entry.path)).toEqual(["A.md"]);
		expect(processedRows(items, "decision")).toEqual([]);
	});
});

describe("monthSummary", () => {
	it("counts planted by creation month and results by done month", () => {
		const items = [
			item("- [x] A #idea [result: new-note] ➕ 2026-09-30 ✅ 2026-10-02"),
			item("- [x] B #idea [result: new-note] ➕ 2026-10-01 ✅ 2026-10-03"),
			item("- [x] C #idea [result: added] ➕ 2026-10-01 ✅ 2026-10-04"),
			item("- [x] D #idea [result: decision] ➕ 2026-10-02 ✅ 2026-10-05"),
			item("- [x] E #idea [result: dropped] ➕ 2026-10-02 ✅ 2026-09-05"),
			item("- [ ] F #idea ➕ 2026-10-10"),
		];
		expect(monthSummary(items, TODAY)).toBe("This month: 5 planted · 2 new notes · 1 added · 1 decision");
	});
	it("says 0 planted when there is nothing", () => {
		expect(monthSummary([], TODAY)).toBe("This month: 0 planted");
	});
});
