import { describe, expect, it } from "vitest";

import { matchesQuery } from "../src/core/search";

describe("matchesQuery", () => {
	it("ignores case", () => {
		expect(matchesQuery("Buy the Tent", "TENT")).toBe(true);
		expect(matchesQuery("buy the tent", "Buy")).toBe(true);
	});

	it("ignores accents in both directions", () => {
		expect(matchesQuery("Café du matin", "cafe")).toBe(true);
		expect(matchesQuery("cafe du matin", "CAFÉ")).toBe(true);
		expect(matchesQuery("résumé", "resume")).toBe(true);
	});

	it("needs every word, in any order", () => {
		expect(matchesQuery("Plan the spring trip with Anna", "trip anna")).toBe(true);
		expect(matchesQuery("Plan the spring trip with Anna", "anna  spring")).toBe(true);
		expect(matchesQuery("Plan the spring trip with Anna", "trip bob")).toBe(false);
	});

	it("splits on the ideographic space", () => {
		expect(matchesQuery("Plan the spring trip", "spring\u3000trip")).toBe(true);
	});

	it("folds full-width letters", () => {
		expect(matchesQuery("ＡＢＣ project", "abc")).toBe(true);
		expect(matchesQuery("abc project", "ＡＢＣ")).toBe(true);
	});

	it("finds Japanese text", () => {
		expect(matchesQuery("新しいノートを書く", "ノート")).toBe(true);
		expect(matchesQuery("ひらがなのメモ", "メモ ひらがな")).toBe(true);
		expect(matchesQuery("かんたん", "がんたん")).toBe(false);
	});

	it("matches everything with a blank query", () => {
		expect(matchesQuery("anything", "")).toBe(true);
		expect(matchesQuery("anything", "  \u3000 ")).toBe(true);
		expect(matchesQuery("", "")).toBe(true);
	});
});
