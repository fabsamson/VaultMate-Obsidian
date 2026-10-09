import { describe, expect, it } from "vitest";

import { parseAction, splitFrontmatter, type ActionDefinition } from "../src/features/ai-actions/definition";

const PATH = "VaultMate/AI actions/Challenge this note.md";
const valid = { "vaultmate-action": 1, name: "Challenge", sources: ["note"], output: "questions" };

function ok(frontmatter: unknown, body = "Ask {{count}} questions."): ActionDefinition {
	const entry = parseAction(PATH, frontmatter, body);
	if (!entry.ok) throw new Error(entry.message);
	return entry.action;
}

function message(frontmatter: unknown, body = "Prompt."): string {
	const entry = parseAction(PATH, frontmatter, body);
	if (entry.ok) throw new Error("expected an invalid action");
	return entry.message;
}

describe("splitFrontmatter", () => {
	it("separates the YAML from the body", () => {
		expect(splitFrontmatter("---\nname: A\n---\nBody\nmore")).toEqual({ yaml: "name: A", body: "Body\nmore" });
		expect(splitFrontmatter("---\r\nname: A\r\n---\r\nBody")).toEqual({ yaml: "name: A", body: "Body" });
	});

	it("returns no YAML when there is no frontmatter", () => {
		expect(splitFrontmatter("Just text\n---\nnot yaml\n---")).toEqual({ yaml: null, body: "Just text\n---\nnot yaml\n---" });
	});
});

describe("parseAction", () => {
	it("applies the defaults", () => {
		expect(ok(valid)).toEqual({
			path: PATH,
			name: "Challenge",
			description: "",
			icon: "sparkles",
			command: false,
			sources: ["note"],
			output: "questions",
			count: 5,
			params: [],
			insert: null,
			prompt: "Ask 5 questions.",
		});
	});

	it("reads every field and replaces {{count}} everywhere", () => {
		const action = ok(
			{ ...valid, description: "d", icon: "scale", command: true, sources: ["note", "selection", "note"], count: 3, insert: { heading: "## Questions", line: "- [ ] {{text}} #question" } },
			"{{count}} and {{count}}",
		);
		expect(action).toMatchObject({ description: "d", icon: "scale", command: true, sources: ["note", "selection"], count: 3, prompt: "3 and 3" });
		expect(action.insert).toEqual({ type: "heading", heading: "Questions", line: "- [ ] {{text}} #question" });
	});

	it("accepts insert at the cursor and defaults the line", () => {
		expect(ok({ ...valid, insert: { at: "cursor" } }).insert).toEqual({ type: "cursor", line: "- {{text}}" });
	});

	it("ignores unknown keys, including later features", () => {
		expect(ok({ ...valid, model: "x", whatever: 1 }).name).toBe("Challenge");
	});

	it("rejects a missing or unsupported version", () => {
		expect(message({ name: "A" })).toContain("vaultmate-action: 1");
		expect(message(null)).toContain("vaultmate-action: 1");
		expect(message({ ...valid, "vaultmate-action": 2 })).toContain("Unsupported action version");
		expect(message({ ...valid, "vaultmate-action": "1" })).toContain("Unsupported action version");
	});

	it("keeps the file name when the name is missing", () => {
		const entry = parseAction(PATH, { ...valid, name: " " }, "Prompt.");
		expect(entry).toMatchObject({ ok: false, name: "Challenge this note", message: "The action needs a name." });
	});

	it("rejects bad sources with a clear message", () => {
		expect(message({ ...valid, sources: [] })).toContain("at least one");
		expect(message({ ...valid, sources: undefined })).toContain("at least one");
		expect(message({ ...valid, sources: ["note", "linked-notes"] })).toBe("Source linked-notes is not available yet.");
		expect(message({ ...valid, sources: ["clipboard"] })).toContain('Unknown source "clipboard"');
	});

	it("rejects unavailable and unknown outputs", () => {
		expect(message({ ...valid, output: "items" })).toBe("Output items is not available yet.");
		expect(message({ ...valid, output: "poem" })).toContain('Unknown output "poem"');
		expect(message({ ...valid, output: undefined })).toContain("output");
	});

	it("reads launch parameters and keeps {{name}} in the prompt for the run window", () => {
		const action = ok({ ...valid, params: { type: { label: "Kind", choices: "collection-types" }, other: { choices: " collection-types " } } }, "Recommend {{count}} {{type}}.");
		expect(action.params).toEqual([
			{ name: "type", label: "Kind", choices: "collection-types" },
			{ name: "other", label: "other", choices: "collection-types" },
		]);
		expect(action.prompt).toBe("Recommend 5 {{type}}.");
		expect(ok({ ...valid, params: null }).params).toEqual([]);
	});

	it("rejects bad parameters with a clear message", () => {
		expect(message({ ...valid, params: { type: { label: "Type", choices: "tags" } } })).toBe('Unknown choices "tags" for parameter type. Use collection-types, collection-entries.');
		expect(message({ ...valid, params: { type: { label: "Type" } } })).toContain("Unknown choices");
		expect(message({ ...valid, params: { type: "collection-types" } })).toBe("Parameter type needs a label and choices.");
		expect(message({ ...valid, params: ["type"] })).toContain("params must list parameters");
		expect(message({ ...valid, params: { count: { choices: "collection-types" } } })).toContain("cannot be the name");
		expect(message({ ...valid, params: { "my type": { choices: "collection-types" } } })).toContain("cannot be the name");
	});

	it("accepts collection-entries only after the type parameter", () => {
		const type = { label: "Type", choices: "collection-types" };
		const entry = { label: "Based on", choices: "collection-entries" };
		expect(ok({ ...valid, params: { type, entry } }).params).toEqual([
			{ name: "type", label: "Type", choices: "collection-types" },
			{ name: "entry", label: "Based on", choices: "collection-entries" },
		]);
		expect(message({ ...valid, params: { entry } })).toBe("Parameter entry (collection-entries) needs the type parameter, with choices: collection-types, declared before it.");
		expect(message({ ...valid, params: { entry, type } })).toContain("declared before it");
		expect(message({ ...valid, params: { kind: type, entry } })).toContain("needs the type parameter");
	});

	it("accepts collection-profile with a type parameter and requires that parameter", () => {
		const params = { type: { label: "Type", choices: "collection-types" } };
		expect(ok({ ...valid, sources: ["collection-profile"], params }).sources).toEqual(["collection-profile"]);
		expect(message({ ...valid, sources: ["collection-profile"] })).toContain("needs the type parameter");
		expect(message({ ...valid, sources: ["collection-profile"], params: { kind: params.type } })).toContain("needs the type parameter");
	});

	it("accepts the suggestions output with the collection profile, and nothing to insert", () => {
		const recommend = { ...valid, sources: ["collection-profile"], output: "suggestions", params: { type: { label: "Type", choices: "collection-types" } } };
		expect(ok(recommend).output).toBe("suggestions");
		expect(message({ ...recommend, sources: ["note"] })).toBe("Output suggestions needs the collection-profile source.");
		expect(message({ ...recommend, insert: { at: "cursor" } })).toContain("cannot be inserted");
	});

	it("rejects a bad count", () => {
		for (const count of [0, 11, 2.5, "5", null]) expect(message({ ...valid, count }), String(count)).toContain("count");
	});

	it("rejects a bad insert", () => {
		expect(message({ ...valid, insert: { heading: "Q", line: "- no placeholder" } })).toContain("{{text}}");
		expect(message({ ...valid, insert: { line: "- {{text}}" } })).toContain("heading or at: cursor");
		expect(message({ ...valid, insert: "Questions" })).toContain("heading or at: cursor");
		expect(message({ ...valid, insert: { heading: "Q", at: "cursor" } })).toContain("not both");
	});

	it("rejects an empty prompt", () => {
		expect(message(valid, "  \n")).toContain("prompt is empty");
	});
});
