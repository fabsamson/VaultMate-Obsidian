import { describe, expect, it } from "vitest";

import { collectionNoteOf, collectionTypes, entryChoices, inFolder, parseRating, ratingLabel, typeLabel, type CollectionNote, type CollectionProperties } from "../src/features/ai-actions/collection";

const PROPS: CollectionProperties = { folder: "", typeProperty: "type", ratingProperty: "rating" };

function note(type: string, rating: number | null, title = `${type} ${rating}`): CollectionNote {
	return { path: `${title}.md`, title, type, year: null, rating, genres: [], creators: [] };
}

describe("parseRating", () => {
	it("reads numbers and numeric text, as the Android app does", () => {
		expect(parseRating(8)).toBe(8);
		expect(parseRating("7,5")).toBe(7.5);
		expect(parseRating("8/10")).toBe(8);
		expect(parseRating(" 6 ")).toBe(6);
	});

	it("treats zero, negative, empty and unreadable values as not rated, and caps at 10", () => {
		for (const value of [0, "0", -3, "", "abc", null, undefined, [], {}, Number.NaN, Infinity]) expect(parseRating(value)).toBeNull();
		expect(parseRating(15)).toBe(10);
	});
});

describe("ratingLabel", () => {
	it("shows whole numbers and one decimal", () => {
		expect(ratingLabel(8)).toBe("8/10");
		expect(ratingLabel(7.5)).toBe("7.5/10");
	});
});

describe("collectionNoteOf", () => {
	it("reads a Media DB movie note", () => {
		const frontmatter = { type: "movie", title: "Heat", year: "1995", genres: ["Crime", "Drama"], director: ["Michael Mann"], actors: ["Al Pacino"], rating: 9 };
		expect(collectionNoteOf("Heat - (1995)", frontmatter, PROPS)).toEqual({ path: "Heat - (1995)", title: "Heat", type: "movie", year: "1995", rating: 9, genres: ["Crime", "Drama"], creators: ["Michael Mann"] });
	});

	it("takes the file name from a vault path", () => {
		expect(collectionNoteOf("Films/Psycho-Pass - (2012).md", { type: "series" }, PROPS)).toMatchObject({ path: "Films/Psycho-Pass - (2012).md", title: "Psycho-Pass" });
	});

	it("falls back to the file name for the title, without a trailing year", () => {
		expect(collectionNoteOf("Psycho-Pass - (2012)", { type: "series", title: "" }, PROPS)?.title).toBe("Psycho-Pass");
		expect(collectionNoteOf("The Gang", { type: "boardgame" }, PROPS)?.title).toBe("The Gang");
	});

	it("picks the first creator property that has a value, and reads year numbers and wikilinks", () => {
		const manga = collectionNoteOf("Frieren", { type: "manga", year: 2022, author: "[[Kanehito Yamada]]", studio: "Other" }, PROPS);
		expect(manga).toMatchObject({ year: "2022", creators: ["Kanehito Yamada"] });
		expect(collectionNoteOf("Persona", { type: "game", director: [], developers: ["ATLUS"] }, PROPS)?.creators).toEqual(["ATLUS"]);
		expect(collectionNoteOf("Dune", { type: "book", authors: "Frank Herbert, Brian Herbert" }, PROPS)?.creators).toEqual(["Frank Herbert", "Brian Herbert"]);
	});

	it("follows the configured properties", () => {
		const props = { folder: "", typeProperty: "kind", ratingProperty: "score" };
		expect(collectionNoteOf("A", { kind: "Movie", score: "4,5", type: "x", rating: 9 }, props)).toMatchObject({ type: "movie", rating: 4.5 });
	});

	it("ignores notes without a type or without properties", () => {
		expect(collectionNoteOf("A", undefined, PROPS)).toBeNull();
		expect(collectionNoteOf("A", { title: "A" }, PROPS)).toBeNull();
		expect(collectionNoteOf("A", { type: "  " }, PROPS)).toBeNull();
		expect(collectionNoteOf("A", { type: [""] }, PROPS)).toBeNull();
	});
});

describe("inFolder", () => {
	it("matches the folder and its subfolders only", () => {
		expect(inFolder("40-Collections/Films/A.md", "40-Collections")).toBe(true);
		expect(inFolder("40-Collections-old/A.md", "40-Collections")).toBe(false);
		expect(inFolder("Anything/A.md", "")).toBe(true);
	});
});

describe("typeLabel", () => {
	it("names the known types and capitalises the others", () => {
		expect(["movie", "series", "manga", "game", "book", "boardgame"].map(typeLabel)).toEqual(["Movies", "Series", "Manga", "Games", "Books", "Board games"]);
		expect(typeLabel("anime")).toBe("Anime");
	});
});

describe("collectionTypes", () => {
	it("counts notes and rated notes per type, most notes first", () => {
		const notes = [note("game", 5), note("movie", 8), note("movie", null), note("movie", 3), note("anime", null), note("game", null)];
		expect(collectionTypes(notes)).toEqual([
			{ id: "movie", label: "Movies", notes: 3, rated: 2 },
			{ id: "game", label: "Games", notes: 2, rated: 1 },
			{ id: "anime", label: "Anime", notes: 1, rated: 0 },
		]);
	});

	it("breaks ties by label and handles an empty list", () => {
		expect(collectionTypes([note("movie", 1), note("book", 1)]).map((type) => type.id)).toEqual(["book", "movie"]);
		expect(collectionTypes([])).toEqual([]);
	});
});

describe("entryChoices", () => {
	const entry = (title: string, rating: number | null, extra: Partial<CollectionNote> = {}): CollectionNote => ({ ...note("movie", rating, title), path: `Films/${title}.md`, ...extra });

	it("lists the entries of the type, rated or not, best first then by title", () => {
		const notes = [entry("Dune", 7), entry("Cats", null), entry("Alien", 7.5, { year: "1979" }), entry("Heat", 9), entry("Brazil", null), { ...entry("Frieren", 10), type: "manga" }];
		expect(entryChoices(notes, "movie")).toEqual([
			{ id: "Films/Heat.md", label: "Heat · 9/10" },
			{ id: "Films/Alien.md", label: "Alien (1979) · 7.5/10" },
			{ id: "Films/Dune.md", label: "Dune · 7/10" },
			{ id: "Films/Brazil.md", label: "Brazil · not rated" },
			{ id: "Films/Cats.md", label: "Cats · not rated" },
		]);
	});

	it("is empty for a type without notes", () => {
		expect(entryChoices([entry("Heat", 9)], "book")).toEqual([]);
	});
});
