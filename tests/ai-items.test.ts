import { describe, expect, it } from "vitest";

import { itemsContract, MAX_ITEM_LENGTH, parseItems } from "../src/features/ai-actions/items";

const options = { count: 3 };

function answer(...items: unknown[]): string {
	return JSON.stringify({ items });
}

describe("itemsContract", () => {
	it("describes the JSON shape and the limits", () => {
		const contract = itemsContract(4);
		expect(contract).toContain('{"items":["..."]}');
		expect(contract).toContain("At most 4 strings");
		expect(contract).toContain("at most 100 characters");
	});
});

describe("parseItems", () => {
	it("keeps well-formed items, trimmed, in order", () => {
		expect(parseItems(answer("  Sand the shelf by hand ", "Buy two litres of white paint"), options)).toEqual(["Sand the shelf by hand", "Buy two litres of white paint"]);
	});

	it("finds the JSON in a chatty answer with a code fence and prose around it", () => {
		const chatty = `Sure! Here are some ideas:\n\`\`\`json\n${answer("Measure the wall")}\n\`\`\`\nGood luck with the project!`;
		expect(parseItems(chatty, options)).toEqual(["Measure the wall"]);
	});

	it("accepts a bare array", () => {
		expect(parseItems(JSON.stringify(["Measure the wall"]), options)).toEqual(["Measure the wall"]);
	});

	it("keeps at most count items", () => {
		expect(parseItems(answer("One a", "Two b", "Three c", "Four d"), options)).toEqual(["One a", "Two b", "Three c"]);
	});

	it("drops items that are not plain single lines", () => {
		const bad = [
			"- Sand the shelf",
			"* Sand the shelf",
			"1. Sand the shelf",
			"2) Sand the shelf",
			"[ ] Sand the shelf",
			"# Plan",
			"> Quote",
			"Sand the shelf\nthen paint it",
			"Sand the shelf by 2026-11-03",
			"Sand the shelf \u{1F4C5} soon",
			"Sand the shelf ⏳ later",
			"Sand the shelf ✅",
			"Sand the shelf #idea",
			"Here are three concrete steps:",
			"",
			"   ",
			"— —",
			"x".repeat(MAX_ITEM_LENGTH + 1),
			42,
			null,
			{ text: "Sand the shelf" },
		];
		expect(parseItems(answer(...bad), { count: 30 })).toEqual([]);
	});

	it("keeps an item of exactly the maximum length and counts characters, not code units", () => {
		const exact = "a".repeat(MAX_ITEM_LENGTH);
		expect(parseItems(answer(exact), options)).toEqual([exact]);
		expect(parseItems(answer("\u{1F600}".repeat(MAX_ITEM_LENGTH - 2) + " a"), options)).toHaveLength(1);
	});

	it("removes duplicates and items already in the track", () => {
		const items = answer("Sand the shelf", "sand the shelf!", "Paint the shelf", "Buy brushes");
		expect(parseItems(items, { count: 5, existing: ["Paint the shelf"] })).toEqual(["Sand the shelf", "Buy brushes"]);
	});

	it("falls back to list lines, without their marker, when there is no JSON", () => {
		const text = "Here are three next steps:\n1. Measure the wall\n- [ ] Buy paint\n* **Call Marie**\nHope this helps!";
		expect(parseItems(text, options)).toEqual(["Measure the wall", "Buy paint", "Call Marie"]);
	});

	it("gives nothing for prose, empty answers, broken JSON or the wrong shape", () => {
		expect(parseItems("I think you should start by thinking about it.", options)).toEqual([]);
		expect(parseItems("", options)).toEqual([]);
		expect(parseItems('{"items":["Measure the wall"', options)).toEqual([]);
		expect(parseItems('{"tasks":["Measure the wall"]}', options)).toEqual([]);
		expect(parseItems('{"items":"Measure the wall"}', options)).toEqual([]);
	});

	it("keeps French and Japanese text as written", () => {
		expect(parseItems(answer("Poncer l'étagère à la main", "棚を磨く"), options)).toEqual(["Poncer l'étagère à la main", "棚を磨く"]);
	});
});
