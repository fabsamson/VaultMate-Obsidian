import { describe, expect, it } from "vitest";

import type { ActionDefinition } from "../src/features/ai-actions/definition";
import { normalizeForCompare, parseQuestions, questionsContract } from "../src/features/ai-actions/questions";
import { applyParams, buildMessages, collectSources, sourceProblem } from "../src/features/ai-actions/request";
import { noteSource, selectionSource } from "../src/features/ai-actions/sources";

const parse = (answer: string, count = 5, noteText = ""): ReturnType<typeof parseQuestions> => parseQuestions(answer, { count, noteText });
const texts = (answer: string, count = 5, noteText = ""): string[] => parse(answer, count, noteText).map((question) => question.text);

describe("parseQuestions: well-formed answers", () => {
	it("reads the JSON contract", () => {
		const answer = '{"questions":[{"kind":"assumption","text":"What if rents rise?"},{"kind":"Evidence ","text":"Which listings did you compare?"}]}';
		expect(parse(answer)).toEqual([
			{ kind: "assumption", text: "What if rents rise?" },
			{ kind: "evidence", text: "Which listings did you compare?" },
		]);
	});

	it("drops an unknown or missing kind but keeps the question", () => {
		expect(parse('{"questions":[{"kind":"feelings","text":"Why now?"},{"text":"Why Lyon?"},{"kind":3,"text":"Why not Nantes?"}]}')).toEqual([
			{ kind: null, text: "Why now?" },
			{ kind: null, text: "Why Lyon?" },
			{ kind: null, text: "Why not Nantes?" },
		]);
	});

	it("accepts full-width question marks and Japanese text", () => {
		expect(texts('{"questions":[{"kind":"personal","text":"なぜリヨンなのですか？"},{"kind":"personal","text":"Pourquoi Lyon ?"}]}')).toEqual(["なぜリヨンなのですか？", "Pourquoi Lyon ?"]);
	});

	it("accepts a bare array and an array of strings", () => {
		expect(texts('[{"kind":"evidence","text":"Why?"}]')).toEqual(["Why?"]);
		expect(texts('{"questions":["Who decides?","What changes?"]}')).toEqual(["Who decides?", "What changes?"]);
	});
});

describe("parseQuestions: chatty answers", () => {
	it("finds the JSON inside a code fence", () => {
		const answer = 'Sure! Here you go:\n```json\n{"questions":[{"kind":"alternative","text":"What else could you try?"}]}\n```\nHope this helps.';
		expect(parse(answer)).toEqual([{ kind: "alternative", text: "What else could you try?" }]);
	});

	it("finds the JSON in the middle of prose, with braces in the prose", () => {
		const answer = 'I considered {several} angles. {"questions":[{"kind":"consequence","text":"What happens if you wait?"}]} Let me know if you want more!';
		expect(texts(answer)).toEqual(["What happens if you wait?"]);
	});

	it("handles braces and quotes inside question text", () => {
		expect(texts('{"questions":[{"kind":"assumption","text":"Does {x} really mean \\"done\\"?"}]}')).toEqual(['Does {x} really mean "done"?']);
	});

	it("falls back to lines ending with a question mark when there is no JSON", () => {
		const answer = [
			"Here are some questions about your note:",
			"",
			"1. What are you assuming about the rent?",
			"- **Which visits did you plan?**",
			"* \"Who else is affected?\"",
			"These questions should help you think.",
			"2. Pourquoi pas Nantes ?",
			"3. Not a question.",
			"- [ ] Is the train really two hours？",
		].join("\n");
		expect(texts(answer)).toEqual(["What are you assuming about the rent?", "Which visits did you plan?", "Who else is affected?", "Pourquoi pas Nantes ?", "Is the train really two hours？"]);
	});

	it("falls back when the JSON is malformed", () => {
		expect(texts('{"questions": [{"kind": "evidence", "text": "Why?",}]\nWhat do you expect?')).toEqual(["What do you expect?"]);
	});

	it("returns nothing for prose without questions or for an empty answer", () => {
		expect(parse("I'm sorry, I cannot help with that. This note is great!")).toEqual([]);
		expect(parse("")).toEqual([]);
		expect(parse('{"questions":[]}')).toEqual([]);
		expect(parse('{"answer":"42"}')).toEqual([]);
	});
});

describe("parseQuestions: the guard", () => {
	it("drops statements, advice and prose posing as questions", () => {
		const items = [
			{ kind: "assumption", text: "You should move to Lyon." },
			{ kind: "assumption", text: "This is a great plan, well done!" },
			{ kind: "assumption", text: "Consider the rent. Why is it lower?" },
			{ kind: "assumption", text: "Is it lower? Is it stable?" },
			{ kind: "assumption", text: "Great plan! What about the rent?" },
			{ kind: "assumption", text: "Ok。なぜですか？" },
			{ kind: "assumption", text: "?" },
			{ kind: "assumption", text: "" },
			{ kind: "assumption", text: 42 },
			{ kind: "assumption" },
			null,
			"What is left?",
		];
		expect(texts(JSON.stringify({ questions: items }))).toEqual(["What is left?"]);
	});

	it("keeps decimals, versions and abbreviations without a following space", () => {
		expect(texts('{"questions":[{"text":"Is 3.5% per year realistic for lyon.fr listings?"}]}')).toHaveLength(1);
	});

	it("drops questions with a line break", () => {
		expect(texts(JSON.stringify({ questions: [{ text: "What about\nthe rent?" }, { text: "What about the rent?" }] }))).toEqual(["What about the rent?"]);
	});

	it("drops questions longer than 160 characters and keeps exactly 160", () => {
		const long = `${"a".repeat(160)}?`;
		const ok = `${"a".repeat(159)}?`;
		expect(texts(JSON.stringify({ questions: [{ text: long }, { text: ok }] }))).toEqual([ok]);
		expect(texts(JSON.stringify({ questions: [{ text: `${"字".repeat(159)}？` }] }))).toHaveLength(1);
	});

	it("drops duplicates, ignoring case, spacing and punctuation", () => {
		const items = ["Why now?", "why  now ?", "WHY NOW？", "Why, now?", "Why later?"];
		expect(texts(JSON.stringify({ questions: items }))).toEqual(["Why now?", "Why later?"]);
	});

	it("drops questions the note already contains", () => {
		const note = "## Questions\n- [ ] Why Lyon? #question\n- who pays for the move ?";
		const items = ["Why Lyon?", "Who pays for the move?", "Where is the train station?"];
		expect(texts(JSON.stringify({ questions: items }), 5, note)).toEqual(["Where is the train station?"]);
	});

	it("keeps at most count questions, after dropping the bad ones", () => {
		const items = ["No.", "A?", "B?", "C?", "D?"];
		expect(texts(JSON.stringify({ questions: items }), 2)).toEqual(["A?", "B?"]);
		expect(texts(JSON.stringify({ questions: items }), 1)).toEqual(["A?"]);
	});

	it("caps the fallback lines too", () => {
		expect(texts("A one?\nB two?\nC three?", 2)).toEqual(["A one?", "B two?"]);
	});
});

describe("normalizeForCompare", () => {
	it("ignores case, spaces, punctuation and width", () => {
		expect(normalizeForCompare("Why, NOW ?")).toBe(normalizeForCompare("why now？"));
		expect(normalizeForCompare("？")).toBe("");
	});
});

describe("request messages", () => {
	const action: ActionDefinition = {
		path: "a.md",
		name: "A",
		description: "",
		icon: "sparkles",
		command: false,
		sources: ["note", "selection"],
		output: "questions",
		count: 3,
		params: [],
		insert: null,
		prompt: "Ask 3 questions. Reply in prose please.",
	};

	it("appends the output contract after the prompt", () => {
		const { system } = buildMessages(action, []);
		expect(system.startsWith("Ask 3 questions. Reply in prose please.\n\n")).toBe(true);
		expect(system.endsWith(questionsContract(3))).toBe(true);
		expect(system).toContain('{"questions":[{"kind"');
		expect(system).toContain("At most 3 items");
		expect(system).toContain("assumption, evidence, consequence, alternative, connection, personal");
	});

	it("replaces {{name}} with the chosen label, before the contract", () => {
		expect(applyParams("Pick {{type}}, then {{type}}.", { type: "Movies" })).toBe("Pick Movies, then Movies.");
		const { system } = buildMessages({ ...action, prompt: "About {{type}}." }, [], { type: "Board games" });
		expect(system.startsWith("About Board games.\n\n")).toBe(true);
	});

	it("labels each source in the user message", () => {
		const { user } = buildMessages(action, [noteSource("Lyon", "Body"), selectionSource("picked")]);
		expect(user).toBe("### Note\nTitle: Lyon\n\nBody\n\n### Selection\npicked");
	});
});

describe("collectSources", () => {
	const action = (sources: ActionDefinition["sources"]): ActionDefinition => ({
		path: "a.md", name: "A", description: "", icon: "sparkles", command: false, sources, output: "questions", count: 5, params: [], insert: null, prompt: "P",
	});
	const input = { title: "Lyon", raw: "---\nstatus: open\n---\nBody [[Link]]", selection: " picked ", frontmatter: { status: "open" }, collection: [], notInterested: {} };

	it("reads each source in the action's order", () => {
		const sources = collectSources(action(["properties", "note", "selection"]), input);
		expect(sources.map((source) => source.name)).toEqual(["properties", "note", "selection"]);
		expect(sources.map((source) => source.text)).toEqual(["status: open", "Title: Lyon\n\nBody Link", "picked"]);
	});

	it("reports an empty selection", () => {
		expect(sourceProblem(collectSources(action(["selection"]), { ...input, selection: "  " }))).toBe("Select some text first.");
		expect(sourceProblem(collectSources(action(["selection", "note"]), input))).toBeNull();
		expect(sourceProblem(collectSources(action(["note"]), { ...input, selection: "" }))).toBeNull();
	});
});
