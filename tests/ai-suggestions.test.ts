import { describe, expect, it } from "vitest";

import { becauseLine, parseSuggestions, searchUrl, suggestionsContract, type Suggestion } from "../src/features/ai-actions/suggestions";

const rated = [
	{ title: "Heat", rating: 9 },
	{ title: "Alien", rating: 8 },
	{ title: "Cats", rating: 2 },
];
const excluded = ["Alien", "Cats", "Heat", "Unrated film", "Joker"];
const options = { count: 5, rated, excluded };

function answer(...suggestions: unknown[]): string {
	return JSON.stringify({ suggestions });
}

const good = { title: "Collateral", year: "2004", creator: "Michael Mann", because: ["Heat"], why: "Another Los Angeles night thriller by the director of Heat." };

describe("suggestionsContract", () => {
	it("describes the JSON shape, the limits and the exclusion list", () => {
		const contract = suggestionsContract(4);
		expect(contract).toContain('{"suggestions":[{"title"');
		expect(contract).toContain("At most 4 items");
		expect(contract).toContain("at most 120 characters");
		expect(contract).toContain("at most 160 characters");
		expect(contract).toContain("Already in the vault");
	});
});

describe("parseSuggestions", () => {
	it("keeps a well-formed suggestion", () => {
		expect(parseSuggestions(answer(good), options)).toEqual([{ title: "Collateral", year: "2004", creator: "Michael Mann", because: ["Heat"], why: good.why }]);
	});

	it("finds the JSON in a chatty answer with a code fence and prose around it", () => {
		const chatty = `Sure! Here are my picks:\n\`\`\`json\n${answer(good)}\n\`\`\`\nHope you enjoy {them}!`;
		expect(parseSuggestions(chatty, options).map((s) => s.title)).toEqual(["Collateral"]);
		expect(parseSuggestions(`Intro text ${answer(good)} outro`, options)).toHaveLength(1);
	});

	it("accepts a bare array", () => {
		expect(parseSuggestions(JSON.stringify([good]), options)).toHaveLength(1);
	});

	it("gives nothing for free text, broken JSON or the wrong shape", () => {
		const texts = ["", "I recommend Collateral and Thief.", '{"suggestions":[{"title":"A"', '{"questions":["Why?"]}', "null", '{"suggestions":"Collateral"}', '[1,2,null,"x"]'];
		for (const text of texts) expect(parseSuggestions(text, options), text).toEqual([]);
	});

	it("drops titles already in the vault, ignoring case, accents, punctuation, articles and a year", () => {
		const items = ["HEAT", "heat (1995)", "The Alien!", "Cäts", "unrated   film", "JOKER", "Joker (2019)"].map((title) => ({ ...good, title }));
		expect(parseSuggestions(answer(...items), options)).toEqual([]);
	});

	it("drops titles of the Not interested list", () => {
		expect(parseSuggestions(answer({ ...good, title: "Les Misérables" }, good), { ...options, excluded: [...excluded, "Misérables"] }).map((s) => s.title)).toEqual(["Collateral"]);
	});

	it("drops duplicates, whatever their year or case", () => {
		const titles = parseSuggestions(answer(good, { ...good, year: "2005" }, { ...good, title: "COLLATERAL" }, { ...good, title: "The Collateral" }), options).map((s) => s.title);
		expect(titles).toEqual(["Collateral"]);
	});

	it("requires a one-line title of at most 120 characters", () => {
		const items = [{ ...good, title: "" }, { ...good, title: "  " }, { ...good, title: 12 }, { ...good, title: "Two\nlines" }, { ...good, title: "x".repeat(121) }, { ...good, title: "!!!" }, { ...good, title: undefined }, "Collateral", null, 5];
		expect(parseSuggestions(answer(...items), options)).toEqual([]);
		expect(parseSuggestions(answer({ ...good, title: "x".repeat(120) }), options)).toHaveLength(1);
	});

	it("moves a trailing (year) from the title to the year", () => {
		expect(parseSuggestions(answer({ ...good, title: "Collateral (2004)", year: undefined }), options)[0]).toMatchObject({ title: "Collateral", year: "2004" });
		expect(parseSuggestions(answer({ ...good, title: "Collateral (2004)", year: "2005" }), options)[0]).toMatchObject({ title: "Collateral", year: "2005" });
	});

	it("keeps the year only when it has four digits", () => {
		const years = [2004, "2004", " 2004 ", "04", "circa 2004", "20045", null, undefined, {}].map((year) => parseSuggestions(answer({ ...good, year }), options)[0]?.year);
		expect(years).toEqual(["2004", "2004", "2004", null, null, null, null, null, null]);
	});

	it("keeps the creator only when it is one short line", () => {
		const creators = ["Michael Mann", "", "A\nB", "x".repeat(81), 3, null].map((creator) => parseSuggestions(answer({ ...good, creator }), options)[0]?.creator);
		expect(creators).toEqual(["Michael Mann", null, null, null, null, null]);
		expect(parseSuggestions(answer({ ...good, creator: "x".repeat(80) }), options)[0]?.creator).toHaveLength(80);
	});

	it("limits because to rated titles of the profile, at most two, with the vault's spelling", () => {
		const because = (value: unknown): string[] | undefined => parseSuggestions(answer({ ...good, because: value }), options)[0]?.because;
		expect(because(["heat", "ALIEN", "Cats"])).toEqual(["Heat", "Alien"]);
		expect(because(["Joker", "Invented film", "Alien"])).toEqual(["Alien"]);
		expect(because(["Heat", "The Heat (1995)"])).toEqual(["Heat"]);
		expect(because("Heat")).toEqual(["Heat"]);
		expect(because(["Unrated film", 7, null])).toEqual([]);
		expect(because(undefined)).toEqual([]);
	});

	it("keeps why only as one sentence of at most 160 characters", () => {
		const why = (value: unknown): string | null | undefined => parseSuggestions(answer({ ...good, why: value }), options)[0]?.why;
		expect(why("Slow, stylish and tense.")).toBe("Slow, stylish and tense.");
		expect(why("No final stop")).toBe("No final stop");
		expect(why("First sentence. Second sentence.")).toBeNull();
		expect(why("Line one\nline two")).toBeNull();
		expect(why("x".repeat(161))).toBeNull();
		expect(why("x".repeat(160))).toHaveLength(160);
		expect(why("")).toBeNull();
		expect(why(42)).toBeNull();
		expect(why("Love it! Really.")).toBeNull();
	});

	it("keeps at most count suggestions, in order", () => {
		const items = ["A", "B", "C", "D"].map((title) => ({ ...good, title }));
		expect(parseSuggestions(answer(...items), { ...options, count: 2 }).map((s) => s.title)).toEqual(["A", "B"]);
	});

	it("counts only the suggestions that survived", () => {
		const items = [{ ...good, title: "Heat" }, { ...good, title: "A" }, { ...good, title: "B" }];
		expect(parseSuggestions(answer(...items), { ...options, count: 2 }).map((s) => s.title)).toEqual(["A", "B"]);
	});

	it("never lets extra fields through", () => {
		const [suggestion] = parseSuggestions(answer({ ...good, url: "https://evil.example", html: "<b>x</b>" }), options);
		expect(Object.keys(suggestion ?? {}).sort()).toEqual(["because", "creator", "title", "why", "year"]);
	});
});

describe("becauseLine", () => {
	const suggestion = (because: string[]): Suggestion => ({ title: "T", year: null, creator: null, because, why: null });

	it("uses the real rating from the vault for the first title", () => {
		expect(becauseLine(suggestion(["Alien", "Heat"]), rated)).toBe("Because you rated Alien 8/10");
		expect(becauseLine(suggestion(["Heat"]), [{ title: "Heat", rating: 7.5 }])).toBe("Because you rated Heat 7.5/10");
	});

	it("says Close to for a title that is not rated", () => {
		expect(becauseLine(suggestion(["Cats"]), [{ title: "Cats", rating: null }])).toBe("Close to Cats");
	});

	it("is omitted without a reason", () => {
		expect(becauseLine(suggestion([]), rated)).toBeNull();
		expect(becauseLine(suggestion(["Gone"]), rated)).toBeNull();
	});
});

describe("searchUrl", () => {
	it("searches the title, year and creator, encoded", () => {
		expect(searchUrl({ title: "Léon & Co", year: "1994", creator: "Luc Besson", because: [], why: null })).toBe("https://duckduckgo.com/?q=L%C3%A9on%20%26%20Co%201994%20Luc%20Besson");
		expect(searchUrl({ title: "Heat", year: null, creator: null, because: [], why: null })).toBe("https://duckduckgo.com/?q=Heat");
	});
});

describe("parseSuggestions with one entry", () => {
	const entryOptions = { count: 5, rated: [{ title: "Cats", rating: null }], excluded };

	it("keeps only the chosen title in because", () => {
		const [suggestion] = parseSuggestions(answer({ ...good, because: ["Heat", "Cats"] }), entryOptions);
		expect(suggestion?.because).toEqual(["Cats"]);
		expect(parseSuggestions(answer({ ...good, because: ["Heat"] }), entryOptions)[0]?.because).toEqual([]);
	});
});
