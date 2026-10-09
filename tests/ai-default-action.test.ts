import { describe, expect, it } from "vitest";

import { CHALLENGE_ACTION } from "../src/features/ai-actions/challenge-action";
import { parseAction, splitFrontmatter } from "../src/features/ai-actions/definition";

describe("Challenge this note", () => {
	const { yaml, body } = splitFrontmatter(CHALLENGE_ACTION);

	it("has the frontmatter of the plan, with the public default line", () => {
		expect(yaml).toBe(
			[
				"vaultmate-action: 1",
				"name: Challenge this note",
				"description: A few open questions that challenge the current note.",
				"icon: message-circle-question",
				"command: true",
				"sources:",
				"  - note",
				"output: questions",
				"count: 5",
				"insert:",
				"  heading: Questions",
				'  line: "- {{text}}"',
			].join("\n"),
		);
	});

	it("parses as a valid action that sends the note and inserts under Questions", () => {
		const frontmatter = {
			"vaultmate-action": 1,
			name: "Challenge this note",
			description: "A few open questions that challenge the current note.",
			icon: "message-circle-question",
			command: true,
			sources: ["note"],
			output: "questions",
			count: 5,
			insert: { heading: "Questions", line: "- {{text}}" },
		};
		const entry = parseAction("VaultMate/AI actions/Challenge this note.md", frontmatter, body);
		expect(entry.ok).toBe(true);
		if (!entry.ok) return;
		expect(entry.action).toMatchObject({ command: true, sources: ["note"], count: 5, insert: { type: "heading", heading: "Questions", line: "- {{text}}" } });
		expect(entry.action.prompt).toContain("Ask 5 open questions");
		expect(entry.action.prompt).not.toContain("{{count}}");
	});
});
