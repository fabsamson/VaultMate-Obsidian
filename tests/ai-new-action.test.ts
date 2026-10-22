import { describe, expect, it } from "vitest";

import { ACTIONS_GUIDE_URL, freeActionPath, NEW_ACTION } from "../src/features/ai-actions/action-template";
import { parseAction, splitFrontmatter } from "../src/features/ai-actions/definition";
import { buildMessages } from "../src/features/ai-actions/request";
import { noteSource } from "../src/features/ai-actions/sources";

describe("the New action template", () => {
	const { yaml, body } = splitFrontmatter(NEW_ACTION);

	it("parses as a valid, runnable action", () => {
		expect(yaml).not.toBeNull();
		const frontmatter = {
			"vaultmate-action": 1,
			name: "Find the gaps",
			description: "Questions about what the current note leaves out.",
			icon: "search",
			command: false,
			sources: ["note"],
			output: "questions",
			count: 5,
		};
		const entry = parseAction("VaultMate/AI actions/New action.md", frontmatter, body);
		expect(entry.ok).toBe(true);
		if (!entry.ok) return;
		expect(entry.action).toMatchObject({ name: "Find the gaps", sources: ["note"], output: "questions", count: 5, insert: null });
		expect(entry.action.prompt).toContain("{{count}}");
	});

	it("keeps its explanations out of the prompt and out of the messages", () => {
		const entry = parseAction("A/New action.md", { "vaultmate-action": 1, name: "x", sources: ["note"], output: "questions" }, body);
		if (!entry.ok) throw new Error(entry.message);
		expect(body).toContain("%%");
		expect(body).toContain("sources:");
		expect(body).toContain(ACTIONS_GUIDE_URL);
		expect(entry.action.prompt).not.toContain("%%");
		expect(entry.action.prompt).not.toContain("sources:");
		const { system } = buildMessages(entry.action, [noteSource("Lyon", "Body")], {}, "", 7);
		expect(system).toMatch(/^You help the user see what their own note leaves out\./);
		expect(system).toContain("Ask 7 open questions");
		expect(system).not.toContain("%%");
	});

	it("explains every property of the format", () => {
		for (const word of ["name:", "description:", "icon:", "command:", "sources:", "output:", "count:", "insert:", "params:", "collection-profile", "project-tracks", "{{text}}", "{{based_on}}"]) {
			expect(body).toContain(word);
		}
	});
});

describe("freeActionPath", () => {
	it("uses New action.md, then New action 2.md, 3, and never an existing path", () => {
		const taken = new Set<string>();
		expect(freeActionPath("A", (path) => taken.has(path))).toBe("A/New action.md");
		taken.add("A/New action.md");
		expect(freeActionPath("A", (path) => taken.has(path))).toBe("A/New action 2.md");
		taken.add("A/New action 2.md");
		expect(freeActionPath("A", (path) => taken.has(path))).toBe("A/New action 3.md");
	});
});
