import { describe, expect, it } from "vitest";

import { findRelated, MIN_SCORE, WEIGHTS, type RelatedNote } from "../src/features/context/engine";
import { buildNoteMeta, dayFromText, dayNumber, haversineKm, isExcluded, type MetaOptions, type NoteMeta } from "../src/features/context/note-meta";
import { formatDistance, singular } from "../src/features/context/signals";
import { makeDoc, TextIndex } from "../src/features/context/text-index";
import { tokenize } from "../src/features/context/tokenizer";

const OPTIONS: MetaOptions = { peopleProperties: ["author", "people"], latitudeProperty: "latitude", longitudeProperty: "longitude" };

interface Fixture {
	text?: string;
	links?: string[];
	tags?: string[];
	frontmatter?: Record<string, unknown>;
}

/** A tiny vault: `Name` -> note. Filler notes make the statistics meaningful. */
async function related(active: string, vault: Record<string, Fixture>, extra: { limit?: number } = {}): Promise<RelatedNote[]> {
	const notes = new Map<string, NoteMeta>();
	const texts = new Map<string, string>();
	const text = new TextIndex();
	for (const [name, note] of Object.entries(vault)) {
		const path = `${name}.md`;
		const meta = buildNoteMeta({ path, links: (note.links ?? []).map((link) => `${link}.md`), tags: note.tags ?? [], frontmatter: note.frontmatter }, OPTIONS);
		notes.set(path, meta);
		texts.set(path, note.text ?? "");
		text.put(path, makeDoc(note.text ?? "", 1), tokenize(name));
	}
	return findRelated({ active: `${active}.md`, notes, text, readText: (path) => Promise.resolve(texts.get(path) ?? ""), limit: extra.limit ?? 8 });
}

function filler(count: number, prefix = "Filler"): Record<string, Fixture> {
	const notes: Record<string, Fixture> = {};
	for (let i = 0; i < count; i++) notes[`${prefix} ${i}`] = { text: `miscellaneous filler content number ${i} about nothing in particular`, tags: ["common"] };
	return notes;
}

function reasonsOf(result: RelatedNote[], name: string): string[] {
	return result.find((note) => note.path === `${name}.md`)?.reasons.map((reason) => reason.text) ?? [];
}

describe("note-meta", () => {
	it("reads dates from the name, then date and created, never the creation time", () => {
		expect(dayFromText("2026-10-08")).toBe(dayNumber(2026, 10, 8));
		expect(dayFromText("2026-10-08 Standup")).toBe(dayNumber(2026, 10, 8));
		expect(dayFromText("2026-13-01")).toBeNull();
		expect(dayFromText("20261008")).toBeNull();
		const day = (frontmatter: Record<string, unknown> | undefined, path = "n.md") => buildNoteMeta({ path, links: [], tags: [], frontmatter }, OPTIONS).day;
		expect(day(undefined, "2026-10-08.md")).toBe(dayNumber(2026, 10, 8));
		expect(day({ date: "2026-05-02" })).toBe(dayNumber(2026, 5, 2));
		expect(day({ created: "2026-05-03T10:00" })).toBe(dayNumber(2026, 5, 3));
		expect(day({})).toBeNull();
	});

	it("reads aliases, people values with wikilinks and coordinates", () => {
		const meta = buildNoteMeta(
			{ path: "dir/Note.md", links: ["a.md", "a.md", "dir/Note.md"], tags: ["#Idea", "idea"], frontmatter: { Aliases: "Foo, Bar", author: ["[[Jane Doe|Jane]]", "John"], latitude: "45,76", longitude: 4.83 } },
			OPTIONS,
		);
		expect(meta.title).toBe("Note");
		expect(meta.aliases).toEqual(["Foo", "Bar"]);
		expect(meta.people.map((value) => value.label)).toEqual(["Jane", "John"]);
		expect(meta.links).toEqual(["a.md"]);
		expect(meta.tags).toEqual(["idea"]);
		expect(meta.geo).toEqual({ lat: 45.76, lon: 4.83 });
		expect(buildNoteMeta({ path: "x.md", links: [], tags: [], frontmatter: { latitude: 120, longitude: 1 } }, OPTIONS).geo).toBeNull();
	});

	it("excludes folders and measures distances", () => {
		expect(isExcluded("Templates/a.md", ["Templates"])).toBe(true);
		expect(isExcluded("Templates2/a.md", ["Templates"])).toBe(false);
		expect(isExcluded("a.md", [""])).toBe(false);
		expect(haversineKm({ lat: 48.8566, lon: 2.3522 }, { lat: 45.764, lon: 4.8357 })).toBeCloseTo(392, -1);
		expect(formatDistance(0.85)).toBe("850 m away");
		expect(formatDistance(1.24)).toBe("1.2 km away");
		expect(singular("authors")).toBe("author");
		expect(singular("people")).toBe("people");
		expect(singular("address")).toBe("address");
	});
});

describe("findRelated", () => {
	it("finds an unlinked mention in both directions, with the reason", async () => {
		const result = await related("Lyon move", {
			...filler(10),
			"Lyon move": { text: "Planning the relocation. Also see Marie Curie biography for inspiration." },
			Journal: { text: "Today I thought about the Lyon move again and it makes sense." },
			"Marie Curie biography": { text: "Physics and chemistry pioneer." },
		});
		expect(reasonsOf(result, "Journal")).toContain("Mentions Lyon move without a link");
		expect(reasonsOf(result, "Marie Curie biography")).toContain("Named in this note without a link: Marie Curie biography");
	});

	it("matches aliases and ignores a name that is already linked", async () => {
		const result = await related("Big city", {
			...filler(10),
			"Big city": { frontmatter: { aliases: ["Metropolis"] } },
			Diary: { text: "We visited the Metropolis last summer." },
			Linked: { text: "The metropolis is large.", links: ["Big city"] },
		});
		expect(reasonsOf(result, "Diary")).toContain("Mentions Metropolis without a link");
		expect(result.map((note) => note.path)).not.toContain("Linked.md");
	});

	it("does not take a mention inside code, a wikilink or frontmatter", async () => {
		const result = await related("Quantum garden", {
			...filler(10),
			"Quantum garden": { text: "x" },
			Code: { text: "```\nquantum garden\n```" },
			Wiki: { text: "See [[Quantum garden]] for details" },
			Props: { text: "---\ntopic: quantum garden\n---\nnothing" },
		});
		expect(result).toEqual([]);
	});

	it("excludes the active note and the notes already linked either way", async () => {
		const result = await related("Hub", {
			...filler(5),
			Hub: { links: ["Out"], text: "shared topic words tomato" },
			Out: { text: "tomato tomato tomato shared topic words" },
			Back: { links: ["Hub"], text: "tomato shared topic words" },
			Free: { text: "tomato shared topic words tomato" },
		});
		expect(result.map((note) => note.path)).toEqual(["Free.md"]);
	});

	it("weights shared outgoing links by rarity and names the rarest", async () => {
		const popular = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`Reader ${i}`, { links: ["Hub page"] }]));
		const result = await related("Active", {
			...filler(10),
			...popular,
			"Hub page": {},
			"Rare topic": {},
			Active: { links: ["Hub page", "Rare topic"] },
			Sibling: { links: ["Rare topic", "Hub page"] },
		});
		expect(result[0]?.path).toBe("Sibling.md");
		expect(reasonsOf(result, "Sibling")[0]).toBe("Links to 2 of the same notes, including Rare topic");
		const hubOnly = result.find((note) => note.path === "Reader 0.md");
		expect(hubOnly?.score ?? 0).toBeLessThan(result[0]?.score ?? 0);
	});

	it("finds co-cited notes", async () => {
		const result = await related("Alpha", {
			...filler(8),
			Alpha: {},
			Beta: {},
			Gamma: {},
			"List one": { links: ["Alpha", "Beta"] },
			"List two": { links: ["Alpha", "Beta", "Gamma"] },
		});
		expect(reasonsOf(result, "Beta")).toEqual(["Often linked together with this note"]);
		expect(reasonsOf(result, "Gamma")).toEqual(["Linked together with this note in List two"]);
	});

	it("uses the rare tag, not the common one", async () => {
		const result = await related("Active", {
			...filler(30),
			Active: { tags: ["common", "#sailing"] },
			Boat: { tags: ["common", "sailing"] },
			Plain: { tags: ["common"] },
		});
		expect(reasonsOf(result, "Boat")).toEqual(["Shares the rare tag #sailing"]);
		expect(result.map((note) => note.path)).not.toContain("Plain.md");
	});

	it("matches people property values, ignoring case and accents", async () => {
		const result = await related("Active", {
			...filler(10),
			Active: { frontmatter: { author: ["Émile Zola"] } },
			Other: { frontmatter: { author: "emile zola" } },
			Different: { frontmatter: { author: "Someone Else" } },
		});
		expect(reasonsOf(result, "Other")).toEqual(["Same author: Émile Zola"]);
		expect(result.map((note) => note.path)).not.toContain("Different.md");
	});

	it("finds similar wording and lists the shared terms", async () => {
		const result = await related("Active", {
			...filler(10),
			Active: { text: "sourdough starter hydration fermentation proofing sourdough" },
			Close: { text: "my sourdough starter needs hydration and long fermentation" },
			Far: { text: "tax declaration deadline reminder" },
		});
		expect(result[0]?.path).toBe("Close.md");
		const text = reasonsOf(result, "Close")[0] ?? "";
		expect(text.startsWith("Similar wording: ")).toBe(true);
		expect(text).toContain("sourdough");
		expect(result.map((note) => note.path)).not.toContain("Far.md");
	});

	it("finds notes of the same week, by file name, but never on time alone", async () => {
		const result = await related("2026-10-08", {
			...filler(10),
			"2026-10-08": { text: "alpha" },
			"2026-10-10": { text: "beta" },
			"2026-10-20": { text: "gamma" },
		});
		expect(result).toEqual([]);
		const withTag = await related("2026-10-08", {
			...filler(10),
			"2026-10-08": { tags: ["trip"] },
			"2026-10-10": { tags: ["trip"] },
		});
		expect(reasonsOf(withTag, "2026-10-10")).toEqual(expect.arrayContaining(["Written the same week"]));
	});

	it("ignores notes without an explicit date, however close their files are", async () => {
		const result = await related("Alpha", {
			...filler(10),
			Alpha: { tags: ["trip"] },
			Beta: { tags: ["trip"] },
		});
		expect(reasonsOf(result, "Beta").join()).not.toContain("same week");
		const dated = await related("Alpha", {
			...filler(10),
			Alpha: { tags: ["trip"], frontmatter: { date: "2026-10-08" } },
			Beta: { tags: ["trip"], frontmatter: { created: "2026-10-09T08:00" } },
		});
		expect(reasonsOf(dated, "Beta")).toContain("Written the same week");
	});

	it("finds nearby places, strongest under one kilometre", async () => {
		const at = (lat: number, lon: number) => ({ frontmatter: { latitude: lat, longitude: lon } });
		const result = await related("Here", {
			...filler(10),
			Here: at(45.764, 4.8357),
			Near: at(45.77, 4.8357),
			Town: at(45.8, 4.9),
			Faraway: at(48.8566, 2.3522),
		});
		expect(reasonsOf(result, "Near")).toEqual(["670 m away"]);
		expect(result.map((note) => note.path)).toEqual(["Near.md"]);
		expect(WEIGHTS.place * 0.3).toBeLessThan(MIN_SCORE);
	});

	it("keeps at most three reasons, largest first, and honours the limit", async () => {
		const result = await related(
			"Active",
			{
				...filler(10),
				Active: { text: "orchid cultivation greenhouse humidity", tags: ["plants"], frontmatter: { author: "Ann" }, links: ["Shared"] },
				Shared: {},
				Rich: { text: "orchid cultivation greenhouse humidity and the Active note", tags: ["plants"], frontmatter: { author: "Ann" }, links: ["Shared"] },
				Weak: { frontmatter: { author: "Ann" } },
			},
			{ limit: 1 },
		);
		expect(result).toHaveLength(1);
		const [best] = result;
		expect(best?.path).toBe("Rich.md");
		expect(best?.reasons).toHaveLength(3);
		const weights = best?.reasons.map((reason) => reason.weight) ?? [];
		expect([...weights].sort((a, b) => b - a)).toEqual(weights);
		expect(best?.score).toBeGreaterThan(weights.reduce((a, b) => a + b, 0));
	});

	it("returns nothing for an unknown note", async () => {
		expect(await related("Missing", { Other: {} })).toEqual([]);
	});
});
