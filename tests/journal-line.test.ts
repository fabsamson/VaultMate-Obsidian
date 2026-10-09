import { describe, expect, it } from "vitest";

import {
	badgeFor,
	classifyLine,
	closeEntry,
	convertToEntry,
	countDue,
	groupByDue,
	parseConfidence,
	parseJournalLine,
	parsePercentInput,
	reviewAgain,
	statementOffset,
	type ConvertOptions,
	type JournalTags,
} from "../src/features/journal/journal-line";

const TAGS: JournalTags = { decisionTag: "decision", predictionTag: "prediction" };
const TODAY = new Date(2026, 9, 9);
const FE0F = "️";

function entry(line: string) {
	const parsed = parseJournalLine(line, TAGS);
	if (!parsed) throw new Error(`not an entry: ${line}`);
	return parsed;
}

describe("parseJournalLine", () => {
	it("reads an open decision", () => {
		expect(entry("- [ ] Switch the team to a four-day week #decision [confidence: 60%] ➕ 2026-08-25 📅 2026-09-25")).toEqual({
			kind: "decision",
			status: "open",
			statement: "Switch the team to a four-day week",
			confidence: 60,
			created: "2026-08-25",
			due: "2026-09-25",
			done: null,
			outcome: null,
			quality: null,
			result: null,
		});
	});

	it("reads a closed decision", () => {
		const parsed = entry("- [x] Move to Lyon #decision [confidence: 70%] [outcome: better] [quality: good] ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-08");
		expect(parsed).toMatchObject({ status: "done", outcome: "better", quality: "good", done: "2027-01-08", due: "2027-01-08" });
	});

	it("reads predictions and their result", () => {
		const parsed = entry("- [x] The release needs no hotfix #prediction [confidence: 80%] [result: partly] ➕ 2026-09-01 📅 2026-09-08 ✅ 2026-09-08");
		expect(parsed).toMatchObject({ kind: "prediction", status: "done", confidence: 80, result: "partly" });
	});

	it("maps the status characters", () => {
		expect(entry("- [-] Dropped #decision").status).toBe("cancelled");
		expect(entry("- [X] Done #decision").status).toBe("done");
		expect(entry("- [/] In progress #decision").status).toBe("open");
		expect(entry("- [ ] Open #decision").status).toBe("open");
	});

	it("accepts several confidence formats and rejects the others", () => {
		expect(parseConfidence("70%")).toBe(70);
		expect(parseConfidence("70")).toBe(70);
		expect(parseConfidence("0.7")).toBe(70);
		expect(parseConfidence("0,55")).toBe(55);
		expect(parseConfidence("62.5%")).toBe(62.5);
		expect(parseConfidence("100%")).toBe(100);
		expect(parseConfidence("120%")).toBeNull();
		expect(parseConfidence("high")).toBeNull();
		expect(parseConfidence("")).toBeNull();
		expect(parseConfidence(null)).toBeNull();
		expect(entry("- [ ] x #decision [confidence: lots]").confidence).toBeNull();
	});

	it("reads a percentage typed in a form", () => {
		expect(parsePercentInput("1")).toBe(1);
		expect(parsePercentInput(" 70 % ")).toBe(70);
		expect(parsePercentInput("101")).toBeNull();
		expect(parsePercentInput("-5")).toBeNull();
	});

	it("ignores outcome values that are not allowed, and fields of the other kind", () => {
		const parsed = entry("- [x] x #decision [outcome: great] [quality: GOOD] [result: yes]");
		expect(parsed.outcome).toBeNull();
		expect(parsed.quality).toBe("good");
		expect(parsed.result).toBeNull();
	});

	it("handles missing dates", () => {
		expect(entry("- [ ] Choose a new phone plan #decision")).toMatchObject({ created: null, due: null, statement: "Choose a new phone plan" });
	});

	it("counts nested tags and any case, and uses the configured tags", () => {
		expect(entry("- [ ] x #Decision/work").kind).toBe("decision");
		expect(parseJournalLine("- [ ] x #choix", { decisionTag: "choix", predictionTag: "pari" })?.kind).toBe("decision");
		expect(parseJournalLine("- [ ] x #decision", { decisionTag: "choix", predictionTag: "pari" })).toBeNull();
	});

	it("handles callouts, numbered lists, star markers and tabs", () => {
		expect(entry("> 1. [ ] Pick the venue #decision [confidence: 70%] ➕ 2026-10-07 📅 2026-10-30").statement).toBe("Pick the venue");
		expect(entry("* [ ] Star marker decision #decision ➕ 2026-10-08 📅 2026-12-08").due).toBe("2026-12-08");
		expect(entry("\t- [ ] Tab-indented decision #decision [confidence: 65%] ➕ 2026-10-08 📅 2026-11-08").confidence).toBe(65);
	});

	it("handles Japanese, French and variation selectors", () => {
		const jp = entry("- [ ] 新しいノートアプリに移行する #decision [confidence: 60%] ➕ 2026-10-06 📅 2027-01-06");
		expect(jp.statement).toBe("新しいノートアプリに移行する");
		expect(entry("- [ ] Décider du menu du dîner de Noël #decision [confidence: 75%] ➕ 2026-10-09 📅 2026-12-01").statement).toBe("Décider du menu du dîner de Noël");
		const vs = entry(`- [ ] Decide on the garden shed #decision [confidence: 60%] ➕${FE0F} 2026-10-01 📅${FE0F} 2026-11-01`);
		expect(vs).toMatchObject({ created: "2026-10-01", due: "2026-11-01" });
	});

	it("keeps priority, recurrence and block id out of the statement", () => {
		const parsed = entry("- [ ] Review the household budget #decision [confidence: 70%] ⏫ 🔁 every month ➕ 2026-09-09 📅 2026-10-09 ^budget-review");
		expect(parsed).toMatchObject({ statement: "Review the household budget", due: "2026-10-09", created: "2026-09-09" });
	});

	it("ignores tags in code, links and URLs, and lines without a checkbox", () => {
		expect(parseJournalLine("- [ ] Write about the `#decision` tag in the docs", TAGS)).toBeNull();
		expect(parseJournalLine("- [ ] Read https://example.com/#decision-log and [log](https://example.com/#decision)", TAGS)).toBeNull();
		expect(parseJournalLine("- [ ] See [[Decisions - open#Overdue]] for more", TAGS)).toBeNull();
		expect(parseJournalLine("- Plain item #decision", TAGS)).toBeNull();
		expect(parseJournalLine("- [ ] Ordinary task #question", TAGS)).toBeNull();
	});
});

describe("classifyLine", () => {
	it.each([
		["Decision: switch the notes backup to a weekly schedule", "decision", "switch the notes backup to a weekly schedule"],
		["Décision : arrêter le café après quinze heures", "decision", "arrêter le café après quinze heures"],
		["Decision：move the standup to 9:30", "decision", "move the standup to 9:30"],
		["Prediction: the new release will not need a hotfix", "prediction", "the new release will not need a hotfix"],
		["Prédiction : le train de 8h12 aura du retard demain", "prediction", "le train de 8h12 aura du retard demain"],
		["Prediction： our monthly budget will stay under 2,000", "prediction", "our monthly budget will stay under 2,000"],
		["- Decision: ask for a salary review in January", "decision", "ask for a salary review in January"],
		["- [ ] DECISION : shout", "decision", "shout"],
		["> Decision: in a callout", "decision", "in a callout"],
		["> - Prédiction : in a callout list", "prediction", "in a callout list"],
		["Decision:", "decision", ""],
		["decision :  ", "decision", ""],
	])("recognises the prose line %j", (line, kind, statement) => {
		expect(classifyLine(line, TAGS)).toEqual({ type: "prose", kind, statement });
	});

	it("leaves ordinary sentences alone", () => {
		for (const line of [
			"An ordinary sentence mentioning a decision, which should be left alone.",
			"Decisions were made",
			"Decisions: a list",
			"Prediction markets are fun",
			"The decision: later",
			"Predictions - open",
			"",
			"## Decision: heading",
		]) {
			expect(classifyLine(line, TAGS), line).toBeNull();
		}
	});

	it("recognises a plain line that carries the tag", () => {
		expect(classifyLine("Move to Lyon #decision", TAGS)).toEqual({ type: "plain", kind: "decision", statement: "Move to Lyon" });
		expect(classifyLine("- Move to Lyon #prediction", TAGS)).toEqual({ type: "plain", kind: "prediction", statement: "Move to Lyon" });
		expect(classifyLine("## Heading #decision", TAGS)).toBeNull();
	});

	it("prefers the entry over the prose reading of a task", () => {
		expect(classifyLine("- [ ] Decision: should we? #decision", TAGS)?.type).toBe("entry");
	});
});

const OPTIONS: ConvertOptions = { kind: "decision", tags: TAGS, today: "2026-10-09", due: "2027-01-09", confidence: null };

describe("convertToEntry", () => {
	it("converts a prose line", () => {
		expect(convertToEntry("Decision: switch the notes backup", OPTIONS)).toBe("- [ ] Switch the notes backup #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(convertToEntry("Prédiction : il pleuvra demain", { ...OPTIONS, kind: "prediction", confidence: 70 })).toBe(
			"- [ ] Il pleuvra demain #prediction [confidence: 70%] ➕ 2026-10-09 📅 2027-01-09",
		);
		expect(convertToEntry("Decision：move the standup", OPTIONS)).toBe("- [ ] Move the standup #decision ➕ 2026-10-09 📅 2027-01-09");
	});

	it("capitalizes a cased first letter of a prose statement only", () => {
		expect(convertToEntry("Prediction: the new release will not need a hotfix", { ...OPTIONS, kind: "prediction" })).toBe(
			"- [ ] The new release will not need a hotfix #prediction ➕ 2026-10-09 📅 2027-01-09",
		);
		expect(convertToEntry("Décision : économiser plus", OPTIONS)).toBe("- [ ] Économiser plus #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(convertToEntry("Decision: 来週引っ越す", OPTIONS)).toBe("- [ ] 来週引っ越す #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(convertToEntry("- [ ] buy a desk #decision", OPTIONS)).toBe("- [ ] buy a desk #decision ➕ 2026-10-09 📅 2027-01-09");
	});

	it("keeps the list marker, checkbox and callout prefix", () => {
		expect(convertToEntry("- Decision: ask for a raise", OPTIONS)).toBe("- [ ] Ask for a raise #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(convertToEntry("> * Decision: in a callout", OPTIONS)).toBe("> * [ ] In a callout #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(convertToEntry("  - [ ] Decision: indented", OPTIONS)).toBe("  - [ ] Indented #decision ➕ 2026-10-09 📅 2027-01-09");
	});

	it("converts a tagged line, with or without a trailing space", () => {
		expect(convertToEntry("Move to Lyon #decision ", OPTIONS)).toBe("- [ ] Move to Lyon #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(convertToEntry("- [ ] Move to Lyon #decision", { ...OPTIONS, confidence: 70 })).toBe(
			"- [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-09 📅 2027-01-09",
		);
	});

	it("adds the tag to a line that has none, before existing fields", () => {
		expect(convertToEntry("Buy a desk [confidence: 60%]", OPTIONS)).toBe("- [ ] Buy a desk #decision [confidence: 60%] ➕ 2026-10-09 📅 2027-01-09");
	});

	it("keeps an existing created date and confidence, and other signifiers", () => {
		expect(convertToEntry("- [ ] Pay #decision [confidence: 60%] ⏫ ➕ 2026-10-01 ^pay", OPTIONS)).toBe(
			"- [ ] Pay #decision [confidence: 60%] ⏫ ➕ 2026-10-01 📅 2027-01-09 ^pay",
		);
	});

	it("replaces the confidence only when one is given", () => {
		expect(convertToEntry("- [ ] x #decision [confidence: 60%]", { ...OPTIONS, confidence: 80 })).toContain("[confidence: 80%]");
	});

	it("leaves two spaces before the tag for an empty statement and finds the cursor spot", () => {
		const line = convertToEntry("Décision : ", OPTIONS);
		expect(line).toBe("- [ ]  #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(statementOffset(line)).toBe(6);
		const typed = `${line.slice(0, 6)}Move${line.slice(6)}`;
		expect(typed).toBe("- [ ] Move #decision ➕ 2026-10-09 📅 2027-01-09");
		expect(statementOffset(convertToEntry("> Decision:", OPTIONS))).toBe("> - [ ] ".length);
	});

	it("produces a line that parses back", () => {
		const parsed = entry(convertToEntry("Prediction: it rains", { ...OPTIONS, kind: "prediction", confidence: 65 }));
		expect(parsed).toMatchObject({ kind: "prediction", statement: "It rains", confidence: 65, created: "2026-10-09", due: "2027-01-09" });
	});
});

describe("closeEntry and reviewAgain", () => {
	const OPEN = "- [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08";

	it("closes a decision", () => {
		expect(closeEntry(OPEN, { kind: "decision", outcome: "better", quality: "good", today: "2027-01-08" })).toBe(
			"- [x] Move to Lyon #decision [confidence: 70%] [outcome: better] [quality: good] ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-08",
		);
	});

	it("closes a prediction", () => {
		expect(closeEntry("- [ ] It rains #prediction [confidence: 80%] ➕ 2026-10-01 📅 2026-10-08", { kind: "prediction", result: "no", today: "2026-10-09" })).toBe(
			"- [x] It rains #prediction [confidence: 80%] [result: no] ➕ 2026-10-01 📅 2026-10-08 ✅ 2026-10-09",
		);
	});

	it("keeps priority, recurrence and block id when closing", () => {
		const line = "- [ ] Review the budget #decision [confidence: 70%] ⏫ 🔁 every month ➕ 2026-09-09 📅 2026-10-09 ^budget-review";
		expect(closeEntry(line, { kind: "decision", outcome: "worse", quality: "bad", today: "2026-10-09" })).toBe(
			"- [x] Review the budget #decision [confidence: 70%] [outcome: worse] [quality: bad] ⏫ 🔁 every month ➕ 2026-09-09 📅 2026-10-09 ✅ 2026-10-09 ^budget-review",
		);
	});

	it("closes a task in a callout and replaces existing outcome fields", () => {
		const line = "> - [ ] Hire #decision [outcome: worse] ➕ 2026-10-05 📅 2026-11-05";
		expect(closeEntry(line, { kind: "decision", outcome: "better", quality: "unsure", today: "2026-11-05" })).toBe(
			"> - [x] Hire #decision [outcome: better] [quality: unsure] ➕ 2026-10-05 📅 2026-11-05 ✅ 2026-11-05",
		);
	});

	it("closes a tagged task without dates", () => {
		expect(closeEntry("- [ ] Choose a plan #decision", { kind: "decision", outcome: "better", quality: "good", today: "2026-10-09" })).toBe(
			"- [x] Choose a plan #decision [outcome: better] [quality: good] ✅ 2026-10-09",
		);
	});

	it("reviews again: the box stays open and the date moves", () => {
		expect(reviewAgain(OPEN, "2027-04-08")).toBe("- [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-04-08");
		expect(reviewAgain("- [ ] x #decision ⏫ 📅 2026-10-09 ^id", "2027-01-09")).toBe("- [ ] x #decision ⏫ 📅 2027-01-09 ^id");
		expect(reviewAgain(`- [ ] x #decision 📅${FE0F} 2026-10-09`, "2027-01-09")).toBe(`- [ ] x #decision 📅${FE0F} 2027-01-09`);
	});
});

describe("groupByDue", () => {
	const item = (due: string | null, status = " ") => ({ entry: entry(`- [${status}] x #decision${due ? ` 📅 ${due}` : ""}`), due });

	it("groups open entries by review date", () => {
		const items = [item("2027-01-01"), item("2026-10-08"), item("2026-10-09"), item("2026-10-15"), item("2026-10-16"), item(null), item("2026-09-25"), item("2026-10-10")];
		const groups = groupByDue(items, TODAY);
		expect(groups.overdue.map((i) => i.due)).toEqual(["2026-09-25", "2026-10-08"]);
		expect(groups.week.map((i) => i.due)).toEqual(["2026-10-09", "2026-10-10", "2026-10-15"]);
		expect(groups.upcoming.map((i) => i.due)).toEqual(["2026-10-16", "2027-01-01"]);
		expect(groups.undated).toHaveLength(1);
	});

	it("skips closed and cancelled entries and treats an invalid date as none", () => {
		const groups = groupByDue([item("2026-09-01", "x"), item("2026-09-01", "-"), item("2026-13-45")], TODAY);
		expect(groups.overdue).toHaveLength(0);
		expect(groups.undated).toHaveLength(1);
	});

	it("counts what is due today or earlier", () => {
		expect(countDue([item("2026-10-08"), item("2026-10-09"), item("2026-10-10"), item(null), item("2026-10-01", "x")], TODAY)).toBe(2);
	});
});

describe("badgeFor", () => {
	const badge = (line: string) => {
		const cls = classifyLine(line, TAGS);
		if (!cls) throw new Error(line);
		return badgeFor(cls, TODAY);
	};

	it("describes open decisions", () => {
		expect(badge("- [ ] x #decision ➕ 2026-10-09 📅 2027-01-09")).toEqual({ text: "⚖ Decision · review in 3 months", action: "review", kind: "decision" });
		expect(badge("- [ ] x #decision 📅 2026-10-06").text).toBe("⚖ Decision · 3 days overdue");
		expect(badge("- [ ] x #decision 📅 2026-10-09").text).toBe("⚖ Decision · review today");
		expect(badge("- [ ] x #decision")).toMatchObject({ text: "⚖ Decision · no review date", action: "track" });
	});

	it("describes closed decisions", () => {
		expect(badge("- [x] x #decision [outcome: better] [quality: good] 📅 2026-10-06 ✅ 2026-10-06")).toEqual({
			text: "⚖ Decision · reviewed: better, good decision",
			action: "none",
			kind: "decision",
		});
		expect(badge("- [x] x #decision [outcome: as-expected] [quality: unsure]").text).toBe("⚖ Decision · reviewed: as expected, unsure decision");
		expect(badge("- [x] x #decision").text).toBe("⚖ Decision · reviewed");
		expect(badge("- [-] x #decision 📅 2026-10-06").text).toBe("⚖ Decision · cancelled");
	});

	it("describes predictions", () => {
		expect(badge("- [ ] x #prediction [confidence: 70%] 📅 2026-12-09").text).toBe("◔ Prediction · 70% · review in 2 months");
		expect(badge("- [ ] x #prediction 📅 2026-12-09").text).toBe("◔ Prediction · add a probability");
		expect(badge("- [x] x #prediction [confidence: 70%] [result: yes]").text).toBe("◔ Prediction · 70% · resolved: yes");
	});

	it("offers to track prose and plain lines", () => {
		expect(badge("Decision: x")).toEqual({ text: "⚖ Track as decision", action: "track", kind: "decision" });
		expect(badge("Prédiction : x").text).toBe("◔ Track as prediction");
		expect(badge("Plain #decision").action).toBe("track");
	});
});
