import { describe, expect, it } from "vitest";

import { noteContent, noteSource, propertiesSource, selectionSource, SOURCE_CAPS } from "../src/features/ai-actions/sources";

describe("noteContent", () => {
	it("drops the frontmatter", () => {
		expect(noteContent("---\ntitle: x\n# comment\n---\n# Heading\nText")).toBe("# Heading\nText");
	});

	it("drops fenced code blocks, keeping the text around them", () => {
		const raw = "Before\n```ts\nconst secret = 1;\n```\nBetween\n~~~~\n```\nstill code\n~~~~\nAfter";
		expect(noteContent(raw)).toBe("Before\nBetween\nAfter");
	});

	it("drops an unclosed code block to the end", () => {
		expect(noteContent("Before\n```\ncode\nmore code")).toBe("Before");
	});

	it("replaces wikilinks, embeds and Markdown links by their text", () => {
		const raw = "See [[Lyon move]], [[Lyon move|the move]], [[Lyon move#Costs]], ![[plan.png]], [site](https://example.com/x) and ![alt](img.png).";
		expect(noteContent(raw)).toBe("See Lyon move, the move, Lyon move, plan.png, site and alt.");
	});

	it("keeps French and Japanese text as written", () => {
		expect(noteContent("Déménager à Lyon : décision 決定")).toBe("Déménager à Lyon : décision 決定");
	});
});

describe("source caps", () => {
	it("prefixes the note with its title and does not flag a short note", () => {
		const source = noteSource("Lyon", "Body");
		expect(source).toEqual({ name: "note", text: "Title: Lyon\n\nBody", chars: 17, truncated: false });
	});

	it("truncates the note at its cap and says so", () => {
		const source = noteSource("T", "x".repeat(30_000));
		expect(source.chars).toBe(SOURCE_CAPS.note);
		expect(source.text).toHaveLength(SOURCE_CAPS.note);
		expect(source.truncated).toBe(true);
	});

	it("truncates the selection at 8 000 characters", () => {
		const source = selectionSource(`  ${"y".repeat(9_000)}  `);
		expect(source).toMatchObject({ name: "selection", chars: 8_000, truncated: true });
		expect(selectionSource("  short ")).toMatchObject({ text: "short", chars: 5, truncated: false });
		expect(selectionSource("   ").chars).toBe(0);
	});
});

describe("propertiesSource", () => {
	it("writes key: value lines, joining lists and skipping the cache position", () => {
		const source = propertiesSource({ status: "open", tags: ["a", "b"], rating: 7, done: false, position: { start: 0 } });
		expect(source.text).toBe("status: open\ntags: a, b\nrating: 7\ndone: false");
		expect(source.truncated).toBe(false);
	});

	it("is empty without properties and truncated at 2 000 characters", () => {
		expect(propertiesSource(undefined).chars).toBe(0);
		expect(propertiesSource({ long: "z".repeat(3_000) })).toMatchObject({ chars: 2_000, truncated: true });
	});
});
