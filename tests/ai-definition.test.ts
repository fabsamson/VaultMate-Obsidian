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
		expect(ok({ ...valid, model: "x", params: { type: {} }, whatever: 1 }).name).toBe("Challenge");
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
		expect(message({ ...valid, sources: ["note", "collection-profile"] })).toBe("Source collection-profile is not available yet.");
		expect(message({ ...valid, sources: ["clipboard"] })).toContain('Unknown source "clipboard"');
	});

	it("rejects unavailable and unknown outputs", () => {
		expect(message({ ...valid, output: "suggestions" })).toBe("Output suggestions is not available yet.");
		expect(message({ ...valid, output: "poem" })).toContain('Unknown output "poem"');
		expect(message({ ...valid, output: undefined })).toContain("output");
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
