import { describe, expect, it } from "vitest";

import { normalizeTitle, type CollectionNote } from "../src/features/ai-actions/collection";
import { collectionProfile } from "../src/features/ai-actions/collection-profile";
import { SOURCE_CAPS } from "../src/features/ai-actions/sources";

function movie(title: string, rating: number | null, extra: Partial<CollectionNote> = {}): CollectionNote {
	return { path: `${title}.md`, title, type: "movie", year: null, rating, genres: [], creators: [], plot: null, ...extra };
}

describe("normalizeTitle", () => {
	it("ignores case, accents, punctuation, a leading article and a trailing year", () => {
		expect(normalizeTitle("The Matrix")).toBe("matrix");
		expect(normalizeTitle("MATRIX (1999)")).toBe("matrix");
		expect(normalizeTitle("L'Écume des jours")).toBe(normalizeTitle("Ecume des jours"));
		expect(normalizeTitle("Les Misérables")).toBe(normalizeTitle("miserables"));
		expect(normalizeTitle("Spider-Man: Homecoming")).toBe("spidermanhomecoming");
		expect(normalizeTitle("La  La   Land")).toBe(normalizeTitle("La La Land"));
	});

	it("keeps a title that is only an article, and keeps Japanese marks", () => {
		expect(normalizeTitle("The")).toBe("the");
		expect(normalizeTitle("がんばれ")).not.toBe(normalizeTitle("かんはれ"));
		expect(normalizeTitle("進撃の巨人")).toBe("進撃の巨人");
	});
});

describe("collectionProfile", () => {
	const notes = [
		movie("Heat", 9, { year: "1995", genres: ["Crime", "Drama"], creators: ["Michael Mann"] }),
		movie("Alien", 8, { year: "1979", genres: ["Horror"], creators: ["Ridley Scott"] }),
		movie("Cats", 2),
		movie("Dune", 7),
		movie("Unrated", null),
		{ ...movie("Frieren", 10), type: "manga" },
	];

	it("lists the rated notes of the chosen type, best first, one line each", () => {
		const { source, rated } = collectionProfile(notes, "movie", []);
		expect(source.name).toBe("collection-profile");
		expect(source.text.startsWith("Type: Movies\n")).toBe(true);
		const lines = source.text.split("\n");
		expect(lines.slice(2, 6)).toEqual(["Heat (1995) · 9/10 · Crime, Drama · Michael Mann", "Alien (1979) · 8/10 · Horror · Ridley Scott", "Dune · 7/10", "Cats · 2/10"]);
		expect(source.text).not.toContain("Frieren");
		expect(rated.map((item) => item.title)).toEqual(["Heat", "Alien", "Dune", "Cats"]);
		expect(rated[0]).toEqual({ title: "Heat", rating: 9 });
		expect(source.problem).toBeUndefined();
		expect(source.truncated).toBe(false);
		expect(source.chars).toBe(source.text.length);
	});

	it("excludes every title of the type, rated or not, and the Not interested ones, without duplicates", () => {
		const { source, excluded } = collectionProfile(notes, "movie", ["Joker", "heat", "The Alien"]);
		expect(excluded).toEqual(["Alien", "Cats", "Dune", "Heat", "Unrated", "Joker"]);
		expect(source.text).toContain("Already in the vault (do not suggest):\nAlien; Cats; Dune; Heat; Unrated; Joker");
	});

	it("takes the top 25 and the lowest 10 without overlap, lowest first", () => {
		const many = Array.from({ length: 40 }, (_, index) => movie(`Film ${String(index).padStart(2, "0")}`, (index % 10) + 1));
		const { rated } = collectionProfile(many, "movie", []);
		expect(rated).toHaveLength(35);
		expect(new Set(rated.map((item) => item.title)).size).toBe(35);
		const sorted = [...many].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
		expect(rated.slice(0, 25).every((item) => (item.rating ?? 0) >= (sorted[24]?.rating ?? 0))).toBe(true);
		expect(rated.slice(25).every((item) => (item.rating ?? 0) <= (sorted[29]?.rating ?? 0))).toBe(true);
	});

	it("reports too few rated notes", () => {
		expect(collectionProfile(notes, "manga", []).source.problem).toBe("Rate a few more Manga first (at least 3).");
		expect(collectionProfile([movie("A", 5), movie("B", 6), movie("C", null)], "movie", []).source.problem).toBe("Rate a few more Movies first (at least 3).");
		expect(collectionProfile([movie("A", 5), movie("B", 6), movie("C", 1)], "movie", []).source.problem).toBeUndefined();
	});

	it("caps the text, cuts the exclusion list at a title and flags the truncation", () => {
		const unrated = Array.from({ length: 2000 }, (_, index) => movie(`Unrated film number ${index}`, null));
		const { source, excluded } = collectionProfile([movie("A", 9), movie("B", 8), movie("C", 7), ...unrated], "movie", []);
		expect(source.chars).toBeLessThanOrEqual(SOURCE_CAPS["collection-profile"]);
		expect(source.truncated).toBe(true);
		expect(source.text).toContain("A · 9/10");
		expect(source.text).not.toMatch(/; $/);
		expect(source.text.endsWith("number 1") || /number \d+$/.test(source.text)).toBe(true);
		expect(excluded).toHaveLength(2003);
	});
});

describe("collectionProfile with one entry", () => {
	const plot = "A blade runner hunts replicants in a rainy city. ".repeat(12).trim();
	const notes = [
		movie("Blade Runner", 9, { path: "Films/Blade Runner.md", year: "1982", genres: ["Sci-Fi", "Thriller"], creators: ["Ridley Scott"], plot: "Rick Deckard hunts replicants." }),
		movie("Cats", null, { path: "Films/Cats.md", year: "2019", plot }),
		movie("Heat", 9, { path: "Films/Heat.md" }),
		{ ...movie("Frieren", 10), type: "manga" },
	];

	it("sends the entry line and its plot, then the exclusion list", () => {
		const { source, rated, excluded } = collectionProfile(notes, "movie", ["Joker"], "Films/Blade Runner.md");
		expect(source.text).toBe(
			[
				"Recommend titles close to this one:",
				"Blade Runner (1982) · 9/10 · Sci-Fi, Thriller · Ridley Scott",
				"Plot: Rick Deckard hunts replicants.",
				"",
				"Already in the vault (do not suggest):",
				"Blade Runner; Cats; Heat; Joker",
			].join("\n"),
		);
		expect(source.problem).toBeUndefined();
		expect(rated).toEqual([{ title: "Blade Runner", rating: 9 }]);
		expect(excluded).toEqual(["Blade Runner", "Cats", "Heat", "Joker"]);
	});

	it("accepts an entry that is not rated, even when fewer than three are rated", () => {
		const { source, rated } = collectionProfile(notes, "movie", [], "Films/Cats.md");
		expect(source.text).toContain("Cats (2019) · not rated\nPlot: ");
		expect(source.problem).toBeUndefined();
		expect(rated).toEqual([{ title: "Cats", rating: null }]);
	});

	it("cuts a long plot at a word boundary within 400 characters", () => {
		const text = collectionProfile(notes, "movie", [], "Films/Cats.md").source.text;
		const shown = /Plot: (.*)\n/.exec(text)?.[1] ?? "";
		expect(shown.length).toBeLessThanOrEqual(400);
		expect(shown.endsWith("…")).toBe(true);
		const kept = shown.slice(0, -1);
		expect(plot.startsWith(kept)).toBe(true);
		expect(plot.charAt(kept.length)).toBe(" ");
	});

	it("omits the plot line when there is none, and does not send the other ratings", () => {
		const { source } = collectionProfile(notes, "movie", [], "Films/Heat.md");
		expect(source.text.startsWith("Recommend titles close to this one:\nHeat · 9/10\n\nAlready in the vault")).toBe(true);
		expect(source.text).not.toContain("Rated by the user");
		expect(source.text).not.toContain("Plot:");
	});

	it("keeps the cap and flags the truncation", () => {
		const unrated = Array.from({ length: 2000 }, (_, index) => movie(`Unrated film number ${index}`, null));
		const { source } = collectionProfile([...notes, ...unrated], "movie", [], "Films/Blade Runner.md");
		expect(source.chars).toBeLessThanOrEqual(SOURCE_CAPS["collection-profile"]);
		expect(source.truncated).toBe(true);
	});

	it("reports an entry that is not found", () => {
		expect(collectionProfile(notes, "movie", [], "Films/Gone.md").source.problem).toBe("That entry was not found. Choose another one.");
	});
});
