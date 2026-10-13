import { describe, expect, it } from "vitest";

import { startOfDay } from "../src/core/dates";
import { classifyLine, type JournalTags } from "../src/features/journal/journal-line";
import { planRewrite } from "../src/features/journal/journal-note";
import { buildIdeaItem, classifyIdeaLine, type IdeaItem } from "../src/features/ideas/idea-line";
import { applyPlan } from "../src/features/ai-actions/insertion";
import { childLines, closeParts, defaultIdeaHeading, ideaChildren, indentUnit, listHeadings, planAddIdea, trackedLines } from "../src/features/ideas/idea-note";

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

describe("ideaChildren and childLines", () => {
	it("strips the idea's indentation and keeps the relative structure", () => {
		const lines = ["  - [ ] Idea #idea", "      - first", "          - deeper", "      - second", "", "x"];
		expect(ideaChildren(lines, 0)).toEqual([
			{ level: 0, text: "- first" },
			{ level: 1, text: "- deeper" },
			{ level: 0, text: "- second" },
		]);
	});

	it("drops the quote prefix and reads tabs", () => {
		const lines = ["> - [ ] Idea #idea", "> \t- first", "> \t\t- deeper"];
		expect(ideaChildren(lines, 0)).toEqual([
			{ level: 0, text: "- first" },
			{ level: 1, text: "- deeper" },
		]);
	});

	it("has no children for a lone line", () => {
		expect(ideaChildren(["- [ ] Idea #idea", "next"], 0)).toEqual([]);
	});

	it("re-indents with the target's unit", () => {
		const children = [{ level: 0, text: "- a" }, { level: 1, text: "- b" }];
		expect(childLines(children, "\t", 1)).toEqual(["\t- a", "\t\t- b"]);
		expect(childLines(children, "    ")).toEqual(["- a", "    - b"]);
		expect(indentUnit(["- a", "\t- b"])).toBe("\t");
		expect(indentUnit(["- a", "  - b"])).toBe("    ");
	});
});

describe("listHeadings and defaultIdeaHeading", () => {
	it("lists headings outside frontmatter and code", () => {
		const lines = ["---", "# not a heading", "---", "# Title", "```", "# code", "```", "## Part two ##"];
		expect(listHeadings(lines)).toEqual([
			{ line: 3, level: 1, text: "Title" },
			{ line: 7, level: 2, text: "Part two" },
		]);
	});

	it("finds the idea section, ignoring case, accents and markup", () => {
		const find = (...texts: string[]): string | null => defaultIdeaHeading(texts.map((text) => ({ text })));
		expect(find("Plan", "💡 Idées à explorer", "Idea")).toBe("💡 Idées à explorer");
		expect(find("Plan", "💡 **Notes/Idées connexes**")).toBe("💡 **Notes/Idées connexes**");
		expect(find("IDEAS", "x")).toBe("IDEAS");
		expect(find("Idee")).toBe("Idee");
		expect(find("Plan", "Notes")).toBeNull();
		expect(defaultIdeaHeading([])).toBeNull();
	});
});

describe("planAddIdea", () => {
	const children = [{ level: 0, text: "- first" }, { level: 1, text: "- deeper" }];

	it("goes to the end of the note without a heading, before trailing blank lines", () => {
		const lines = ["# Sprint planning", "", "- existing", "", ""];
		const plan = planAddIdea(lines, null, "Kitchen sprint", children);
		expect(plan).toEqual({ at: 3, remove: 0, lines: ["- Kitchen sprint", "    - first", "        - deeper"] });
		expect(applyPlan(lines, plan)).toEqual(["# Sprint planning", "", "- existing", "- Kitchen sprint", "    - first", "        - deeper", "", ""]);
	});

	it("fills an empty note", () => {
		expect(planAddIdea([""], null, "x", [])).toEqual({ at: 0, remove: 0, lines: ["- x"] });
		expect(planAddIdea([], null, "x", [])).toEqual({ at: 0, remove: 0, lines: ["- x"] });
	});

	it("goes to the end of the section under the heading, tabs following the note", () => {
		const lines = ["# Ideas", "- old", "\t- sub", "", "# Other", "- keep"];
		const plan = planAddIdea(lines, "Ideas", "New", children);
		expect(plan.at).toBe(3);
		expect(plan.lines).toEqual(["- New", "\t- first", "\t\t- deeper"]);
	});

	it("keeps lines the section already holds", () => {
		const lines = ["## Ideas", "- first", "- New"];
		expect(planAddIdea(lines, "Ideas", "New", [{ level: 0, text: "- first" }]).lines).toEqual(["- New", "    - first"]);
	});

	it("starts the section when the heading is gone", () => {
		const plan = planAddIdea(["text"], "Ideas", "New", []);
		expect(plan).toEqual({ at: 1, remove: 0, lines: ["", "## Ideas", "- New"] });
	});
});
