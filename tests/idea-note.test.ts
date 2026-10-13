import { describe, expect, it } from "vitest";

import { startOfDay } from "../src/core/dates";
import { classifyLine, type JournalTags } from "../src/features/journal/journal-line";
import { planRewrite } from "../src/features/journal/journal-note";
import { buildIdeaItem, classifyIdeaLine, type IdeaItem } from "../src/features/ideas/idea-line";
import { closeParts, trackedLines } from "../src/features/ideas/idea-note";

const TODAY = "2026-10-15";
const JOURNAL: JournalTags = { decisionTag: "decision", predictionTag: "prediction" };

function itemAt(lines: string[], line: number, date = "2026-10-13"): IdeaItem {
	const item = buildIdeaItem("Daily/Log.md", "Log", date, line, lines, "idea");
	if (!item) throw new Error("not an idea");
	return item;
}

describe("closeParts", () => {
	it("closes with the idea's own date and no sub-item for a drop without a note", () => {
		const item = itemAt(["- [ ] Sprint like a kitchen #idea ➕ 2026-10-13"], 0);
		expect(closeParts(item, "idea", "dropped", TODAY, null, "")).toEqual({
			line: "- [x] Sprint like a kitchen #idea [result: dropped] ➕ 2026-10-13 ✅ 2026-10-15",
			subItem: null,
		});
	});

	it("adds the drop note and the link results", () => {
		const item = itemAt(["- [ ] Sprint #idea ➕ 2026-10-13"], 0);
		expect(closeParts(item, "idea", "dropped", TODAY, null, "not now").subItem).toBe("Dropped: not now");
		expect(closeParts(item, "idea", "added", TODAY, "Sprint planning", "").subItem).toBe("Added to [[Sprint planning]]");
		expect(closeParts(item, "idea", "new-note", TODAY, "Kitchen sprint", "to refine").subItem).toBe("New note: [[Kitchen sprint]]: to refine");
	});

	it("gives a plain tagged line its real date, not today's", () => {
		const item = itemAt(["Sprint #idea"], 0, "2026-09-02");
		expect(closeParts(item, "idea", "dropped", TODAY, null, "").line).toBe("- [x] Sprint #idea [result: dropped] ➕ 2026-09-02 ✅ 2026-10-15");
	});
});

describe("trackedLines", () => {
	const entry = { statement: "Run a sprint", confidence: 70, interval: "3m" as const, extras: [["Why", "faster"], ["Expected", ""], ["Signals", "less rework"]] as Array<[string, string]> };
	const today = startOfDay(new Date(2026, 9, 15));

	it("builds the decision sub-task after the idea's children, with its sub-items one level deeper", () => {
		const lines = ["# Notes", "- [ ] Sprint like a kitchen #idea ➕ 2026-10-13", "    - a thought", "", "End"];
		const item = itemAt(lines, 1);
		const { line, subItem } = closeParts(item, "idea", "decision", TODAY, null, "");
		const plan = planRewrite(lines, 1, item.raw, line, subItem, trackedLines("decision", entry, JOURNAL, today));
		expect(plan).toEqual({
			ok: true,
			from: 1,
			to: 2,
			replacement: [
				"- [x] Sprint like a kitchen #idea [result: decision] ➕ 2026-10-13 ✅ 2026-10-15",
				"    - a thought",
				"    - [ ] Run a sprint #decision [confidence: 70%] ➕ 2026-10-15 📅 2027-01-15",
				"        - Why: faster",
				"        - Signals: less rework",
			],
		});
	});

	it("writes entries the journal and the idea models both read, with tabs and a quote prefix", () => {
		const lines = ["> [!note]", "> - [ ] Idea text #idea ➕ 2026-10-13", "> 	- note"];
		const item = itemAt(lines, 1);
		const { line, subItem } = closeParts(item, "idea", "prediction", TODAY, null, "");
		const plan = planRewrite(lines, 1, item.raw, line, subItem, trackedLines("prediction", { ...entry, extras: [["Why", "hunch"]] }, JOURNAL, today));
		if (!plan.ok) throw new Error("refused");
		const [closed, , task, why] = plan.replacement;
		expect(classifyIdeaLine(closed ?? "", "idea")).toMatchObject({ type: "task", entry: { status: "done", result: "prediction", created: "2026-10-13" } });
		const cls = classifyLine(task ?? "", JOURNAL);
		expect(cls).toMatchObject({ type: "entry", entry: { kind: "prediction", status: "open", statement: "Run a sprint", confidence: 70, due: "2027-01-15" } });
		expect(why).toBe("> 		- Why: hunch");
	});
});
