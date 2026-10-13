import { describe, expect, it } from "vitest";

import { startOfDay } from "../src/core/dates";
import { classifyLine, type JournalTags } from "../src/features/journal/journal-line";
import { planRewrite } from "../src/features/journal/journal-note";
import { buildIdeaItem, classifyIdeaLine, type IdeaItem } from "../src/features/ideas/idea-line";
import { applyPlan } from "../src/features/ai-actions/insertion";
import {
	childLines,
	closeParts,
	defaultIdeaHeading,
	DEFAULT_NEW_NOTE,
	ideaChildren,
	ideaText,
	indentUnit,
	listHeadings,
	nearestLine,
	newNotePath,
	planAddIdea,
	renderNewNote,
	trackedLines,
} from "../src/features/ideas/idea-note";

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

describe("newNotePath", () => {
	it("puts a plain name in the setting folder, else in the default parent", () => {
		expect(newNotePath("Kitchen sprint", "Ideas/Notes", "Inbox")).toBe("Ideas/Notes/Kitchen sprint.md");
		expect(newNotePath("Kitchen sprint", "", "Inbox")).toBe("Inbox/Kitchen sprint.md");
		expect(newNotePath("Kitchen sprint", "", "/")).toBe("Kitchen sprint.md");
		expect(newNotePath("Kitchen sprint", "", "")).toBe("Kitchen sprint.md");
	});

	it("treats a name with a slash as a vault path and ignores the folder setting", () => {
		expect(newNotePath("Projects/Cooking/Sprint", "Ideas", "Inbox")).toBe("Projects/Cooking/Sprint.md");
		expect(newNotePath("/Projects//Sprint/", "Ideas", "Inbox")).toBe("Projects/Sprint.md");
	});

	it("drops a trailing .md and the forbidden characters of each segment", () => {
		expect(newNotePath("Sprint.md", "", "/")).toBe("Sprint.md");
		expect(newNotePath("Sprint.MD", "", "/")).toBe("Sprint.md");
		expect(newNotePath('What: a "sprint"? [x] #1', "", "/")).toBe("What a sprint x 1.md");
		expect(newNotePath("A|B/C*D^e", "", "/")).toBe("AB/CDe.md");
		expect(newNotePath("A\\B/C", "", "/")).toBe("AB/C.md");
		expect(newNotePath("../../up/Note", "", "/")).toBe("up/Note.md");
	});

	it("refuses an empty name", () => {
		for (const name of ["", "   ", ".md", "/", '??:"', "../.."]) expect(newNotePath(name, "Ideas", "Inbox")).toBeNull();
	});
});

describe("renderNewNote", () => {
	const values = { title: "Kitchen sprint", idea: "Prepare a sprint\n- first", source: "[[Daily]]", date: "2026-10-15" };

	it("fills the four placeholders everywhere they appear", () => {
		expect(renderNewNote("# {{title}}\n{{date}} from {{source}}\n\n{{idea}}\n{{title}}", values)).toBe(
			"# Kitchen sprint\n2026-10-15 from [[Daily]]\n\nPrepare a sprint\n- first\nKitchen sprint",
		);
	});

	it("leaves other placeholders and Templater tags alone, and does not expand filled values", () => {
		const template = "{{other}} <% tp.date.now() %> {{TITLE}} {{idea}}";
		expect(renderNewNote(template, { ...values, idea: "uses {{date}} and $& text" })).toBe("{{other}} <% tp.date.now() %> {{TITLE}} uses {{date}} and $& text");
	});

	it("has a default with the idea, a blank line and the source", () => {
		expect(renderNewNote(DEFAULT_NEW_NOTE, values)).toBe("Prepare a sprint\n- first\n\nSource: [[Daily]]\n");
	});
});

describe("ideaText", () => {
	it("is the statement, then the sub-bullets de-indented", () => {
		expect(ideaText("Prepare", [{ level: 0, text: "- a" }, { level: 1, text: "- b" }], "    ")).toBe("Prepare\n- a\n    - b");
		expect(ideaText("Prepare", [], "    ")).toBe("Prepare");
	});
});

describe("nearestLine", () => {
	const lines = ["- [ ] a #idea", "x", "- [ ] b #idea", "- [ ] a #idea", "y", "- [ ] a #idea"];
	it("finds the same line when it did not move", () => expect(nearestLine(lines, "- [ ] a #idea", 3)).toBe(3));
	it("follows a line that moved down", () => expect(nearestLine(lines, "- [ ] b #idea", 1)).toBe(2));
	it("takes the nearest of equal lines, the earlier on a tie", () => {
		expect(nearestLine(lines, "- [ ] a #idea", 4)).toBe(3);
		expect(nearestLine(lines, "- [ ] a #idea", 2)).toBe(0);
	});
	it("returns null when the line is gone", () => expect(nearestLine(lines, "- [ ] c #idea", 0)).toBeNull());
});
