import { describe, expect, it } from "vitest";

import { makeDoc, TextIndex } from "../src/features/context/text-index";
import { cleanText, foldText, hasCjk, tokenize } from "../src/features/context/tokenizer";

describe("tokenize", () => {
	it("lowercases, folds accents and drops stopwords in French and English", () => {
		expect(tokenize("Le Déménagement à Lyon est the BEST des choses")).toEqual(["demenagement", "lyon", "best", "choses"]);
		expect(foldText("Été Œuvre Straße")).toBe("ete oeuvre strasse");
	});

	it("keeps digits and drops one-letter words and very long tokens", () => {
		expect(tokenize("a 2026 b x1 " + "z".repeat(60))).toEqual(["2026", "x1"]);
	});

	it("splits Chinese and Japanese runs into bigrams, keeping Latin words apart", () => {
		expect(tokenize("里昂大学")).toEqual(["里昂", "昂大", "大学"]);
		expect(tokenize("Lyon里昂 trip")).toEqual(["lyon", "里昂", "trip"]);
		expect(tokenize("東京")).toEqual(["東京"]);
		expect(tokenize("が")).toEqual(["が"]);
		expect(tokenize("カード")).toEqual(["カー", "ード"]);
		expect(hasCjk("abc 日本")).toBe(true);
		expect(hasCjk("abc")).toBe(false);
	});

	it("handles other scripts as words", () => {
		expect(tokenize("Привет мир")).toEqual(["привет", "мир"]);
	});
});

describe("cleanText", () => {
	it("removes frontmatter, code, link targets and URLs", () => {
		const note = [
			"---",
			"title: hidden",
			"---",
			"Visible [[Target note]] words [[Other|shown alias]] and [md link](https://x.example/path).",
			"```js",
			"secretcode()",
			"```",
			"Inline `codeword` stays out. See https://example.com/page now. ![[image.png]]",
		].join("\n");
		const tokens = tokenize(cleanText(note));
		expect(tokens).toEqual(expect.arrayContaining(["visible", "words", "shown", "alias", "md", "link", "inline", "stays", "out", "see", "now"]));
		for (const hidden of ["hidden", "target", "other", "secretcode", "codeword", "example", "image", "png"]) expect(tokens).not.toContain(hidden);
	});

	it("keeps text that only looks like a frontmatter delimiter later in the note", () => {
		expect(tokenize(cleanText("intro\n---\nkept\n---\nend"))).toContain("kept");
	});
});

describe("TextIndex", () => {
	function build(notes: Record<string, string>): TextIndex {
		const index = new TextIndex();
		for (const [path, text] of Object.entries(notes)) index.put(path, makeDoc(text, 1), tokenize(path.replace(/.md$/, "")));
		return index;
	}

	it("counts the title three times as much as the body", () => {
		const index = new TextIndex();
		index.put("x.md", makeDoc("filler words here gardening", 1), ["gardening"]);
		expect(index.count("x.md", "gardening")).toBe(4);
		expect(index.count("x.md", "filler")).toBe(1);
		expect(index.count("x.md", "missing")).toBe(0);
		expect(index.termsOf("x.md").sort()).toEqual(["filler", "gardening", "here", "words"]);
	});

	it("gives rare terms a higher idf and knows which notes have a term", () => {
		const index = build({
			"a.md": "common common common rareword",
			"b.md": "common stuff",
			"c.md": "common things",
		});
		expect(index.idf("rareword")).toBeGreaterThan(index.idf("common"));
		expect(index.documentFrequency("common")).toBe(3);
		expect([...index.pathsWith("rareword")]).toEqual(["a.md"]);
	});

	it("updates incrementally on put and remove", () => {
		const index = build({ "a.md": "alpha beta", "b.md": "beta gamma" });
		expect(index.size).toBe(2);
		index.put("a.md", makeDoc("delta", 2), ["a"]);
		expect(index.documentFrequency("alpha")).toBe(0);
		expect(index.pathsWith("delta").has("a.md")).toBe(true);
		index.remove("b.md");
		expect(index.size).toBe(1);
		expect(index.bodyPaths("gamma")).toEqual([]);
	});

	it("lists only body matches in bodyPaths, not title-only matches", () => {
		const index = new TextIndex();
		index.put("lyon.md", makeDoc("nothing here", 1), ["lyon"]);
		index.put("trip.md", makeDoc("a trip to lyon", 1), ["trip"]);
		expect(index.bodyPaths("lyon")).toEqual(["trip.md"]);
	});
});
