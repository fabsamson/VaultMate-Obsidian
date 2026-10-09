import { describe, expect, it } from "vitest";

import {
	ensureTag,
	getDescription,
	getInlineField,
	getTags,
	getTaskDate,
	hasTag,
	parseTaskLine,
	removeInlineField,
	removeTaskDate,
	serializeTaskLine,
	setInlineField,
	setTaskDate,
	setTaskStatus,
	toTaskLine,
} from "../src/core/task-line";

const VS = "️";

const FIXTURES = [
	"",
	"   ",
	"Just a sentence.",
	"Decision: move to Lyon",
	"Décision : déménager à Lyon",
	"Prédiction：il pleuvra demain",
	"## Heading #decision",
	"- plain item",
	"- [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08",
	"- [x] Move to Lyon #decision [outcome: better] ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-08",
	"- [-] Cancelled idea #decision",
	"- [/] Custom status",
	"* [ ] star marker",
	"+ [ ] plus marker",
	"1. [ ] numbered",
	"12) [X] numbered paren",
	"\t- [ ] tab indented",
	"    - [ ] space indented",
	"  \t - [ ] mixed indent",
	"> - [ ] in a callout",
	"> > - [ ] nested callout",
	">- [ ] tight quote",
	"> [!info] Callout title",
	"-  [ ]  wide spaces #decision",
	"- [ ]",
	"- ",
	"-",
	"- [ ] 引っ越すかどうか #decision [confidence: 60%] ➕ 2026-10-08 📅 2027-01-08",
	"- [ ] ＃全角 テスト：決める #decision",
	"- [ ] Réunion à Zürich #décision 📅 2026-10-12",
	"- [ ] Repeat 🔁 every week on Monday 📅 2026-10-12",
	"- [ ] Priority ⏫ 🔁 every day 📅 2026-10-12 ^abc-1",
	"- [ ] Ids 🆔 abc123 ⛔ def456 📅 2026-10-12",
	"- [ ] Link [text](https://x.test/#frag) and [[Note#Heading]] and `#code`",
	"---",
	"**bold** text",
	"- [x](url) not a checkbox",
	"- [link](url) not a checkbox",
	`- [ ] Variation ➕${VS} 2026-10-08 📅${VS} 2027-01-08`,
	"- [ ] Trailing space #decision ",
];

describe("parseTaskLine and serializeTaskLine", () => {
	it("round-trips every fixture exactly", () => {
		for (const line of FIXTURES) {
			expect(serializeTaskLine(parseTaskLine(line)), JSON.stringify(line)).toBe(line);
		}
	});

	it("reads the prefix of a task", () => {
		expect(parseTaskLine("- [ ] Move #decision")).toEqual({ lead: "", marker: "-", gap: " ", status: " ", statusGap: " ", body: "Move #decision" });
		expect(parseTaskLine("12) [X] Done")).toMatchObject({ marker: "12)", status: "X", body: "Done" });
		expect(parseTaskLine("* [-] Cancelled")).toMatchObject({ marker: "*", status: "-" });
		expect(parseTaskLine("+ [/] Other")).toMatchObject({ marker: "+", status: "/" });
	});

	it("reads quote and callout prefixes", () => {
		expect(parseTaskLine("> - [ ] In a callout")).toMatchObject({ lead: "> ", marker: "-", status: " ", body: "In a callout" });
		expect(parseTaskLine("> > 1. [x] Nested")).toMatchObject({ lead: "> > ", marker: "1.", status: "x", body: "Nested" });
	});

	it("reads indentation made of tabs or spaces", () => {
		expect(parseTaskLine("\t\t- [ ] Deep")).toMatchObject({ lead: "\t\t", marker: "-" });
		expect(parseTaskLine("    * [ ] Spaces")).toMatchObject({ lead: "    ", marker: "*" });
	});

	it("tells list items without a checkbox from plain lines", () => {
		expect(parseTaskLine("- plain item")).toMatchObject({ marker: "-", status: null, body: "plain item" });
		expect(parseTaskLine("Decision: move")).toMatchObject({ marker: "", status: null, body: "Decision: move" });
		expect(parseTaskLine("- [link](url)")).toMatchObject({ status: null, body: "[link](url)" });
		expect(parseTaskLine("- [x](url)")).toMatchObject({ status: null, body: "[x](url)" });
		expect(parseTaskLine("---")).toMatchObject({ marker: "", body: "---" });
		expect(parseTaskLine("**bold**")).toMatchObject({ marker: "", body: "**bold**" });
	});

	it("keeps an empty task", () => {
		expect(parseTaskLine("- [ ]")).toMatchObject({ status: " ", body: "" });
	});
});

describe("toTaskLine and setTaskStatus", () => {
	const convert = (line: string): string => serializeTaskLine(toTaskLine(parseTaskLine(line)));

	it("turns a plain list item into a task, keeping prefix and marker", () => {
		expect(convert("- Move to Lyon")).toBe("- [ ] Move to Lyon");
		expect(convert("    * Move")).toBe("    * [ ] Move");
		expect(convert("2. Move")).toBe("2. [ ] Move");
		expect(convert("> - Move")).toBe("> - [ ] Move");
	});

	it("turns a plain line into a task with the same indentation or quote", () => {
		expect(convert("Decision: move")).toBe("- [ ] Decision: move");
		expect(convert("  Decision: move")).toBe("  - [ ] Decision: move");
		expect(convert("> Decision: move")).toBe("> - [ ] Decision: move");
		expect(convert("\tDécision : déménager")).toBe("\t- [ ] Décision : déménager");
	});

	it("leaves a task as it is", () => {
		expect(convert("- [x] Done")).toBe("- [x] Done");
	});

	it("handles an empty list item", () => {
		expect(convert("- ")).toBe("- [ ] ");
		expect(convert("-")).toBe("- [ ] ");
	});

	it("sets the checkbox status", () => {
		const status = (line: string, char: string): string => serializeTaskLine(setTaskStatus(parseTaskLine(line), char));
		expect(status("- [ ] Move #decision", "x")).toBe("- [x] Move #decision");
		expect(status("> - [x] Move", " ")).toBe("> - [ ] Move");
		expect(status("1. [ ] Move", "-")).toBe("1. [-] Move");
		expect(status("- Move", "x")).toBe("- [x] Move");
		expect(status("Move", "x")).toBe("- [x] Move");
	});
});

describe("tags", () => {
	it("lists tags in order, nested and Unicode ones included", () => {
		expect(getTags("Move #decision #work/lyon and #décision")).toEqual(["decision", "work/lyon", "décision"]);
		expect(getTags("引っ越し #決定 #日本語/タグ")).toEqual(["決定", "日本語/タグ"]);
		expect(getTags("snake #my_tag-1 end")).toEqual(["my_tag-1"]);
	});

	it("ignores what is not a tag", () => {
		expect(getTags("Issue #123 and #2026")).toEqual([]);
		expect(getTags("C# and a#b and word#tag")).toEqual([]);
		expect(getTags("## Heading")).toEqual([]);
		expect(getTags("`#code` and ``#also code``")).toEqual([]);
		expect(getTags("see [text](https://x.test/#frag) and https://x.test/#anchor and www.x.test/#a")).toEqual([]);
		expect(getTags("see [[Note#Heading]]")).toEqual([]);
	});

	it("still finds a tag next to ignored spans", () => {
		expect(getTags("`code` #real [x](y) #also")).toEqual(["real", "also"]);
		expect(getTags("(#in-parens)")).toEqual(["in-parens"]);
	});

	it("matches case-insensitively, nested tags counting for their parent", () => {
		expect(hasTag("Move #Decision", "decision")).toBe(true);
		expect(hasTag("Move #decision", "#DECISION")).toBe(true);
		expect(hasTag("Move #decision/career", "decision")).toBe(true);
		expect(hasTag("Move #decisions", "decision")).toBe(false);
		expect(hasTag("Move `#decision`", "decision")).toBe(false);
		expect(hasTag("Décision #DÉCISION", "décision")).toBe(true);
	});

	it("adds a tag after the description and before fields and emojis", () => {
		expect(ensureTag("Move to Lyon", "decision")).toBe("Move to Lyon #decision");
		expect(ensureTag("Move to Lyon #housing", "decision")).toBe("Move to Lyon #housing #decision");
		expect(ensureTag("Move [confidence: 70%]", "decision")).toBe("Move #decision [confidence: 70%]");
		expect(ensureTag("Move 📅 2027-01-08", "decision")).toBe("Move #decision 📅 2027-01-08");
		expect(ensureTag("Move [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08", "#decision")).toBe("Move #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08");
		expect(ensureTag("Move 📅 2027-01-08 ^abc", "decision")).toBe("Move #decision 📅 2027-01-08 ^abc");
		expect(ensureTag("", "decision")).toBe("#decision");
		expect(ensureTag("引っ越す", "decision")).toBe("引っ越す #decision");
	});

	it("leaves a body that already has the tag alone", () => {
		const body = "Move #Decision [confidence: 70%]";
		expect(ensureTag(body, "decision")).toBe(body);
	});
});

describe("inline fields", () => {
	const body = "Move #decision [confidence: 70%] [outcome: better] ➕ 2026-10-08 📅 2027-01-08";

	it("reads fields", () => {
		expect(getInlineField(body, "confidence")).toBe("70%");
		expect(getInlineField(body, "Outcome")).toBe("better");
		expect(getInlineField(body, "quality")).toBeNull();
		expect(getInlineField("Move [source: https://x.test/a?b=1]", "source")).toBe("https://x.test/a?b=1");
		expect(getInlineField("Move [note: très bien ]", "note")).toBe("très bien");
		expect(getInlineField("Move [note: 決める]", "note")).toBe("決める");
	});

	it("ignores fields in code and the checkbox-like brackets", () => {
		expect(getInlineField("Use `[confidence: 70%]` syntax", "confidence")).toBeNull();
		expect(getInlineField("Move [x] and [a b]", "x")).toBeNull();
	});

	it("replaces a field in place", () => {
		expect(setInlineField(body, "confidence", "80%")).toBe("Move #decision [confidence: 80%] [outcome: better] ➕ 2026-10-08 📅 2027-01-08");
	});

	it("adds a field after the existing fields and before the emojis", () => {
		expect(setInlineField(body, "quality", "good")).toBe("Move #decision [confidence: 70%] [outcome: better] [quality: good] ➕ 2026-10-08 📅 2027-01-08");
		expect(setInlineField("Move #decision ➕ 2026-10-08 📅 2027-01-08", "confidence", "70%")).toBe("Move #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08");
		expect(setInlineField("Move #decision", "confidence", "70%")).toBe("Move #decision [confidence: 70%]");
		expect(setInlineField("Move 📅 2027-01-08 ^abc", "confidence", "70%")).toBe("Move [confidence: 70%] 📅 2027-01-08 ^abc");
		expect(setInlineField("", "confidence", "70%")).toBe("[confidence: 70%]");
	});

	it("keeps priorities and recurrence untouched when adding a field", () => {
		expect(setInlineField("Move #decision ⏫ 🔁 every week 📅 2027-01-08", "confidence", "70%")).toBe("Move #decision [confidence: 70%] ⏫ 🔁 every week 📅 2027-01-08");
	});

	it("removes a field", () => {
		expect(removeInlineField(body, "outcome")).toBe("Move #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08");
		expect(removeInlineField(body, "confidence")).toBe("Move #decision [outcome: better] ➕ 2026-10-08 📅 2027-01-08");
		expect(removeInlineField("Move [confidence: 70%]", "confidence")).toBe("Move");
		expect(removeInlineField("Move [confidence: 70%] 📅 2027-01-08", "confidence")).toBe("Move 📅 2027-01-08");
		expect(removeInlineField(body, "missing")).toBe(body);
	});
});

describe("Tasks emoji dates", () => {
	const body = "Move #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08";

	it("reads dates", () => {
		expect(getTaskDate(body, "created")).toBe("2026-10-08");
		expect(getTaskDate(body, "due")).toBe("2027-01-08");
		expect(getTaskDate(body, "done")).toBeNull();
		expect(getTaskDate("Move ⏳ 2026-10-10 🛫 2026-10-01 ❌ 2026-10-11", "scheduled")).toBe("2026-10-10");
		expect(getTaskDate("Move ⏳ 2026-10-10 🛫 2026-10-01 ❌ 2026-10-11", "start")).toBe("2026-10-01");
		expect(getTaskDate("Move ⏳ 2026-10-10 🛫 2026-10-01 ❌ 2026-10-11", "cancelled")).toBe("2026-10-11");
		expect(getTaskDate("Move ✅ 2026-10-09", "done")).toBe("2026-10-09");
	});

	it("accepts a variation selector of either kind", () => {
		expect(getTaskDate(`Move ➕${VS} 2026-10-08 📅${VS} 2027-01-08 ✅︎ 2027-01-09`, "due")).toBe("2027-01-08");
		expect(getTaskDate(`Move ➕${VS} 2026-10-08 📅${VS} 2027-01-08 ✅︎ 2027-01-09`, "created")).toBe("2026-10-08");
		expect(getTaskDate(`Move ➕${VS} 2026-10-08 📅${VS} 2027-01-08 ✅︎ 2027-01-09`, "done")).toBe("2027-01-09");
		expect(getTaskDate("Move 📅2027-01-08", "due")).toBe("2027-01-08");
	});

	it("ignores dates that are not in the emoji block at the end", () => {
		expect(getTaskDate("Call about 📅 2027-01-08 meeting notes", "due")).toBeNull();
	});

	it("replaces a date in place, keeping the variation selector", () => {
		expect(setTaskDate(body, "due", "2027-04-08")).toBe("Move #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-04-08");
		expect(setTaskDate(`Move 📅${VS} 2027-01-08 ^abc`, "due", "2027-04-08")).toBe(`Move 📅${VS} 2027-04-08 ^abc`);
	});

	it("adds a date in the stable order", () => {
		expect(setTaskDate("Move #decision", "created", "2026-10-08")).toBe("Move #decision ➕ 2026-10-08");
		expect(setTaskDate("Move #decision ➕ 2026-10-08", "due", "2027-01-08")).toBe("Move #decision ➕ 2026-10-08 📅 2027-01-08");
		expect(setTaskDate("Move 📅 2027-01-08", "created", "2026-10-08")).toBe("Move ➕ 2026-10-08 📅 2027-01-08");
		expect(setTaskDate("Move ➕ 2026-10-08 📅 2027-01-08", "done", "2027-01-08")).toBe("Move ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-08");
		expect(setTaskDate("Move ➕ 2026-10-08 ✅ 2027-01-08", "due", "2027-01-08")).toBe("Move ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-08");
		expect(setTaskDate("Move ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-08", "cancelled", "2027-01-09")).toBe("Move ➕ 2026-10-08 📅 2027-01-08 ❌ 2027-01-09 ✅ 2027-01-08");
		expect(setTaskDate("Move ⏳ 2026-10-10", "start", "2026-10-09")).toBe("Move 🛫 2026-10-09 ⏳ 2026-10-10");
		expect(setTaskDate("", "due", "2027-01-08")).toBe("📅 2027-01-08");
	});

	it("never writes after the emoji block or the block id", () => {
		expect(setTaskDate("Move ⏫ 🔁 every week ^abc-1", "due", "2027-01-08")).toBe("Move ⏫ 🔁 every week 📅 2027-01-08 ^abc-1");
		expect(setTaskDate("Move 📅 2027-01-08 ^abc", "done", "2027-01-09")).toBe("Move 📅 2027-01-08 ✅ 2027-01-09 ^abc");
		expect(setTaskDate("Move #decision ^abc", "due", "2027-01-08")).toBe("Move #decision 📅 2027-01-08 ^abc");
	});

	it("preserves priorities, recurrence, ids and dependencies", () => {
		const tasks = "Pay rent ⏫ 🔁 every month on the 1st 🆔 rent1 ⛔ prev1,prev2 ➕ 2026-10-08 📅 2026-11-01";
		expect(setTaskDate(tasks, "done", "2026-11-01")).toBe(`${tasks} ✅ 2026-11-01`);
		expect(setTaskDate(tasks, "due", "2026-12-01")).toBe(tasks.replace("2026-11-01", "2026-12-01"));
		expect(getTaskDate(tasks, "due")).toBe("2026-11-01");
		expect(removeTaskDate(tasks, "created")).toBe("Pay rent ⏫ 🔁 every month on the 1st 🆔 rent1 ⛔ prev1,prev2 📅 2026-11-01");
	});

	it("removes a date", () => {
		expect(removeTaskDate(body, "due")).toBe("Move #decision [confidence: 70%] ➕ 2026-10-08");
		expect(removeTaskDate(body, "created")).toBe("Move #decision [confidence: 70%] 📅 2027-01-08");
		expect(removeTaskDate("Move ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-09", "due")).toBe("Move ➕ 2026-10-08 ✅ 2027-01-09");
		expect(removeTaskDate("Move 📅 2027-01-08", "due")).toBe("Move");
		expect(removeTaskDate("Move 📅 2027-01-08 ^abc", "due")).toBe("Move ^abc");
		expect(removeTaskDate(body, "done")).toBe(body);
	});

	it("handles French and Japanese descriptions", () => {
		expect(setTaskDate("Déménager à Lyon #décision [confidence: 70%]", "due", "2027-01-08")).toBe("Déménager à Lyon #décision [confidence: 70%] 📅 2027-01-08");
		expect(setTaskDate("引っ越す：決める #decision", "due", "2027-01-08")).toBe("引っ越す：決める #decision 📅 2027-01-08");
	});
});

describe("whole-line workflow", () => {
	it("converts a quick-capture line into a tracked decision", () => {
		let line = toTaskLine(parseTaskLine("> Décision : déménager à Lyon"));
		line = { ...line, body: ensureTag(line.body, "decision") };
		line = { ...line, body: setInlineField(line.body, "confidence", "70%") };
		line = { ...line, body: setTaskDate(line.body, "created", "2026-10-09") };
		line = { ...line, body: setTaskDate(line.body, "due", "2027-01-09") };
		expect(serializeTaskLine(line)).toBe("> - [ ] Décision : déménager à Lyon #decision [confidence: 70%] ➕ 2026-10-09 📅 2027-01-09");
	});

	it("closes a decision with the contract order", () => {
		let line = parseTaskLine("    - [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08 ^dec1");
		line = setTaskStatus(line, "x");
		line = { ...line, body: setInlineField(line.body, "outcome", "better") };
		line = { ...line, body: setInlineField(line.body, "quality", "good") };
		line = { ...line, body: setTaskDate(line.body, "done", "2027-01-08") };
		expect(serializeTaskLine(line)).toBe("    - [x] Move to Lyon #decision [confidence: 70%] [outcome: better] [quality: good] ➕ 2026-10-08 📅 2027-01-08 ✅ 2027-01-08 ^dec1");
	});
});

describe("getDescription", () => {
	it("returns the text without tags, fields, emojis and block id", () => {
		expect(getDescription("Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08 ^id")).toBe("Move to Lyon");
		expect(getDescription("Buy #decision a desk [confidence: 70%]")).toBe("Buy a desk");
		expect(getDescription("Read `#code` and [[Note#Heading]] #decision ⏫ 🔁 every month")).toBe("Read `#code` and [[Note#Heading]]");
		expect(getDescription("#decision")).toBe("");
	});
});
