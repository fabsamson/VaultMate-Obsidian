import { describe, expect, it } from "vitest";

import { normalizeTitle, type CollectionNote } from "../src/features/ai-actions/collection";
import { collectionProfile } from "../src/features/ai-actions/collection-profile";
import { SOURCE_CAPS } from "../src/features/ai-actions/sources";

function movie(title: string, rating: number | null, extra: Partial<CollectionNote> = {}): CollectionNote {
	return { path: `${title}.md`, title, type: "movie", year: null, rating, genres: [], creators: [], ...extra };
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
		expect(rated.slice(0, 25).every((item) => item.rating >= (sorted[24]?.rating ?? 0))).toBe(true);
		expect(rated.slice(25).every((item) => item.rating <= (sorted[29]?.rating ?? 0))).toBe(true);
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
