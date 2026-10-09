import { describe, expect, it } from "vitest";

import { findConnections, hubBonus, MIN_SCORE, noveltyOf, type Connection } from "../src/features/context/engine";
import { buildGraphContext } from "../src/features/context/graph";
import { buildNoteMeta, haversineKm, isExcluded, type MetaOptions, type NoteMeta } from "../src/features/context/note-meta";
import { formatDistance, singular } from "../src/features/context/signals";
import { makeDoc, TextIndex } from "../src/features/context/text-index";
import { tokenize } from "../src/features/context/tokenizer";

const OPTIONS: MetaOptions = { peopleProperties: ["author", "people"], latitudeProperty: "latitude", longitudeProperty: "longitude" };

interface Fixture {
	text?: string;
	links?: string[];
	tags?: string[];
	frontmatter?: Record<string, unknown>;
	/** Leave the text as it is instead of adding words of prose of its own. */
	bare?: boolean;
}

/** Words that no other note has, so that a note has content of its own without sharing a term. */
function padding(name: string): string {
	return Array.from({ length: 35 }, (_, i) => `pad${name.replace(/W/g, "")}x${i}`).join(" ");
}

/** A tiny vault: `Name` -> note. Filler notes make the statistics meaningful. */
async function connections(active: string, vault: Record<string, Fixture>, extra: { limit?: number } = {}): Promise<Connection[]> {
	const notes = new Map<string, NoteMeta>();
	const texts = new Map<string, string>();
	const text = new TextIndex();
	for (const [name, note] of Object.entries(vault)) {
		const path = `${name}.md`;
		const meta = buildNoteMeta({ path, links: (note.links ?? []).map((link) => `${link}.md`), tags: note.tags ?? [], frontmatter: note.frontmatter }, OPTIONS);
		const body = note.bare ? (note.text ?? "") : `${note.text ?? ""} ${padding(name)}`;
		notes.set(path, meta);
		texts.set(path, body);
		text.put(path, makeDoc(body, 1), tokenize(name));
	}
	return findConnections({ active: `${active}.md`, notes, text, readText: (path) => Promise.resolve(texts.get(path) ?? ""), limit: extra.limit ?? 8 });
}

function filler(count: number, prefix = "Filler"): Record<string, Fixture> {
	const notes: Record<string, Fixture> = {};
	for (let i = 0; i < count; i++) notes[`${prefix} ${i}`] = { text: `miscellaneous filler content number ${i} about nothing in particular`, tags: ["common"] };
	return notes;
}

function kindsOf(result: Connection[]): string[] {
	return result.flatMap((note) => note.reasons.map((reason) => reason.kind));
}

function reasonsOf(result: Connection[], name: string): string[] {
	return result.find((note) => note.path === `${name}.md`)?.reasons.map((reason) => reason.text) ?? [];
}

function paths(result: Connection[]): string[] {
	return result.map((note) => note.path.replace(/.md$/, ""));
}

describe("note-meta", () => {
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


describe("findConnections", () => {
	it("finds an unlinked mention in both directions, with the reason", async () => {
		const result = await connections("Lyon move", {
			...filler(10),
			"Lyon move": { text: "Planning the relocation. Also see Marie Curie biography for inspiration." },
			Journal: { text: "Today I thought about the Lyon move again and it makes sense." },
			"Marie Curie biography": { text: "Physics and chemistry pioneer." },
		});
		expect(reasonsOf(result, "Journal")).toContain("Mentions Lyon move without a link");
		expect(reasonsOf(result, "Marie Curie biography")).toContain("Named in this note without a link: Marie Curie biography");
	});

	it("takes a one-word name as a mention only next to shared terms", async () => {
		const vault: Record<string, Fixture> = {
			...filler(10),
			Processes: { text: "Notes on lathe turning, spindle speed and tool steel." },
			Diary: { text: "Today I read about processes at work and ate lunch." },
			Annex: { text: "Processes in the lathe shop: spindle speed, tool steel and turning." },
		};
		const result = await connections("Processes", vault);
		expect(paths(result)).toEqual(["Annex"]);
		expect(kindsOf(result)).toContain("mention");
		// A name of several words keeps its strength alone.
		vault["Lathe shop"] = { text: "Notes on lathe turning, spindle speed and tool steel." };
		vault.Journal = { text: "A day in the lathe shop again." };
		expect(reasonsOf(await connections("Lathe shop", vault), "Journal")).toContain("Mentions Lathe shop without a link");
	});

	it("matches aliases and ignores a name that is already linked", async () => {
		const result = await connections("Big city", {
			...filler(10),
			"Big city": { frontmatter: { aliases: ["Grand Metropolis"] } },
			Diary: { text: "We visited the Grand Metropolis last summer." },
			Linked: { text: "The metropolis is large.", links: ["Big city"] },
		});
		expect(reasonsOf(result, "Diary")).toContain("Mentions Grand Metropolis without a link");
		expect(paths(result)).not.toContain("Linked");
	});

	it("ignores date-like and digit-only names", async () => {
		const names = ["2026-10", "2026-10-05", "2026-W41", "12"];
		const vault: Record<string, Fixture> = { ...filler(10), Journal: { text: "Met on 2026-10-12, week 2026-W41, then 12 people came to 2026-10-05 and 2026-10." } };
		for (const name of names) vault[name] = { text: "monthly review" };
		expect(kindsOf(await connections("2026-10", vault))).not.toContain("mention");
		expect(kindsOf(await connections("Journal", vault))).not.toContain("mention");
	});

	it("ignores a single-word title that many notes use, keeps a rare multi-word one", async () => {
		const common: Record<string, Fixture> = {};
		for (let i = 0; i < 6; i++) common[`Memo ${i}`] = { text: `Please take notice of the change ${i}.` };
		expect(kindsOf(await connections("Notice", { ...filler(10), ...common, Notice: { text: "x" } }))).not.toContain("mention");

		const rare = await connections("Grand Metropolis", { ...filler(10), "Grand Metropolis": { text: "x" }, Diary: { text: "We visited the grand metropolis." } });
		expect(reasonsOf(rare, "Diary")).toContain("Mentions Grand Metropolis without a link");

		expect(kindsOf(await connections("Take notice", { ...filler(10), ...common, "Take notice": { text: "x" } }))).toContain("mention");
	});

	it("does not take a mention inside code, a wikilink or frontmatter", async () => {
		const result = await connections("Quantum garden", {
			...filler(10),
			"Quantum garden": { text: "x" },
			Code: { text: "```\nquantum garden\n```" },
			Wiki: { text: "See [[Quantum garden]] for details" },
			Props: { text: "---\ntopic: quantum garden\n---\nnothing" },
		});
		expect(result).toEqual([]);
	});

	it("finds distinctive shared terms and lists them", async () => {
		const result = await connections("Active", {
			...filler(10),
			Active: { text: "sourdough starter hydration fermentation proofing sourdough" },
			Close: { text: "my sourdough starter needs hydration and long fermentation" },
			OneWord: { text: "sourdough pancakes for breakfast" },
			Far: { text: "tax declaration deadline reminder" },
		});
		expect(paths(result)).toEqual(["Close"]);
		expect(result[0]?.terms).toHaveLength(3);
		expect(result[0]?.terms).toEqual(expect.arrayContaining(["sourdough"]));
		expect(result[0]?.reasons).toEqual([]);
	});

	it("does not take Japanese grammar fragments for distinctive terms", async () => {
		const grammar = await connections("Active", { ...filler(10), Active: { text: "ものです ところが それは" }, Other: { text: "ものです ところが それは" } });
		expect(grammar).toEqual([]);
		const kanji = await connections("Active", { ...filler(10), Active: { text: "東京大学 図書館 ものです" }, Other: { text: "東京大学 図書館 ところが" } });
		expect(paths(kanji)).toEqual(["Other"]);
		expect(kanji[0]?.terms).toEqual(expect.arrayContaining(["大学"]));
	});

	it("does not count the vocabulary of the active note's own neighbourhood", async () => {
		const result = await connections("Active", {
			...filler(10),
			Active: { text: "gizmo widget flange zeta eta theta", links: ["Near one", "Near two"] },
			"Near one": { text: "gizmo widget flange project" },
			"Near two": { text: "gizmo widget flange budget" },
			Project: { text: "gizmo widget flange assembly" },
			Other: { text: "zeta eta theta lecture" },
		});
		expect(paths(result)).toEqual(["Other"]);
	});

	it("never proposes notes that are linked, co-cited or two links away, however similar", async () => {
		const same = "marmalade quince jelly preserve citrus";
		const result = await connections("Active", {
			...filler(10),
			Active: { text: same, links: ["Mid"] },
			Direct: { text: same, links: ["Active"] },
			Mid: { text: "unrelated", links: ["Far"] },
			Far: { text: same },
			Sibling: { text: same, links: ["Mid"] },
			Cited: { text: same },
			Index: { text: "list", links: ["Active", "Cited"] },
			Free: { text: same },
		});
		expect(paths(result)).toEqual(["Free"]);
	});

	it("returns nothing when the active note has no content of its own, and skips candidates without", async () => {
		const text = "marmalade quince jelly preserve citrus";
		const vault: Record<string, Fixture> = { ...filler(10), Active: { text }, Empty: { text, bare: true } };
		expect(paths(await connections("Active", vault))).toEqual([]);
		vault.Twin = { text };
		expect(paths(await connections("Active", vault))).toEqual(["Twin"]);
		expect(await connections("Empty", vault)).toEqual([]);
	});

	it("matches people property values among eligible notes, ignoring case and accents", async () => {
		const result = await connections("Active", {
			...filler(10),
			Active: { frontmatter: { author: ["Émile Zola"] } },
			Other: { frontmatter: { author: "emile zola" } },
			Different: { frontmatter: { author: "Someone Else" } },
			Cited: { frontmatter: { author: "Émile Zola" } },
			Index: { text: "list", links: ["Active", "Cited"] },
		});
		expect(reasonsOf(result, "Other")).toEqual(["Same author: Émile Zola"]);
		expect(paths(result)).toEqual(["Other"]);
	});

	it("finds places under one kilometre and nothing farther", async () => {
		const at = (lat: number, lon: number) => ({ frontmatter: { latitude: lat, longitude: lon } });
		const result = await connections("Here", {
			...filler(10),
			Here: at(45.764, 4.8357),
			Near: at(45.77, 4.8357),
			Town: at(45.8, 4.9),
			Faraway: at(48.8566, 2.3522),
		});
		expect(reasonsOf(result, "Near")).toEqual(["670 m away"]);
		expect(paths(result)).toEqual(["Near"]);
	});

	it("does not use shared tags, shared outgoing links or dates as a reason", async () => {
		const result = await connections("2026-10-08", {
			...filler(10),
			"2026-10-08": { tags: ["trip"], links: ["Target"], frontmatter: { date: "2026-10-08" } },
			"2026-10-09": { tags: ["trip"], links: ["Target"], frontmatter: { date: "2026-10-09" } },
			Target: {},
		});
		expect(result).toEqual([]);
	});

	it("multiplies the relevance by a novelty that peaks three or four links away", async () => {
		const text = "marmalade quince jelly preserve citrus";
		const vault = (hopLinks: string[]): Record<string, Fixture> => ({
			...filler(10),
			Active: { text, links: ["Step"] },
			Step: { text: "unrelated", links: ["Hop"] },
			Hop: { text: "unrelated", links: hopLinks },
			Distant: { text },
			Reader: { text: "unrelated", links: ["Distant"] },
			Reader2: { text: "unrelated", links: ["Distant"] },
		});
		// The same note with the same degree: no path to the active note in one vault, four links away in the other.
		const [isolated] = await connections("Active", vault([]));
		const [distant] = await connections("Active", vault(["Reader"]));
		expect(isolated?.path).toBe("Distant.md");
		expect((distant?.score ?? 0) / (isolated?.score ?? 1)).toBeCloseTo(1 / 0.85, 5);
	});

	it("keeps the novelty and the hub bonus moderate and capped", () => {
		const metas = new Map<string, NoteMeta>();
		const meta = (path: string, links: string[], tags: string[] = []) => buildNoteMeta({ path, links, tags, frontmatter: undefined }, OPTIONS);
		metas.set("Hub.md", meta("Hub.md", []));
		for (let i = 0; i < 200; i++) metas.set(`R${i}.md`, meta(`R${i}.md`, ["Hub.md"]));
		const active = meta("A.md", [], ["x"]);
		metas.set("A.md", active);
		metas.set("Tagged.md", meta("Tagged.md", [], ["x"]));
		const context = buildGraphContext(active, metas);
		expect(hubBonus(context, "A.md")).toBe(1);
		// Outgoing links do not count: a note that links to many notes is not a crossroads.
		metas.set("Logger.md", meta("Logger.md", Array.from({ length: 50 }, (_, i) => `R${i}.md`)));
		expect(hubBonus(buildGraphContext(active, metas), "Logger.md")).toBe(1);
		expect(hubBonus(context, "Hub.md")).toBe(1.5);
		expect(hubBonus(context, "R0.md")).toBe(1);
		expect(noveltyOf(context, "R0.md", new Map())).toBe(0.85);
		expect(noveltyOf(context, "R0.md", new Map([["R0.md", 3]]))).toBe(1);
		expect(noveltyOf(context, "R0.md", new Map([["R0.md", 2]]))).toBe(0.9);
		expect(noveltyOf(context, "Tagged.md", new Map([["Tagged.md", 4]]))).toBeCloseTo(0.93, 5);
	});

	it("never proposes two notes with nothing in common", async () => {
		const result = await connections("Active", { ...filler(10), Active: { text: "orchid cultivation greenhouse humidity" }, Other: { text: "tax declaration deadline reminder" }, Few: { text: "orchid only" } });
		expect(result).toEqual([]);
	});

	it("honours the limit and returns the best first, with terms, reasons and score", async () => {
		const text = "orchid cultivation greenhouse humidity";
		const result = await connections(
			"Active",
			{
				...filler(10),
				Active: { text, frontmatter: { author: "Ann" } },
				Rich: { text: `${text} and the Active note`, frontmatter: { author: "Ann" } },
				Weak: { frontmatter: { author: "Ann" } },
				Third: { text },
			},
			{ limit: 1 },
		);
		expect(result).toHaveLength(1);
		const [best] = result;
		expect(best?.path).toBe("Rich.md");
		expect(best?.terms).toEqual(expect.arrayContaining(["cultivation", "greenhouse"]));
		expect(best?.reasons.map((reason) => reason.kind)).toContain("property");
		const weights = best?.reasons.map((reason) => reason.weight) ?? [];
		expect([...weights].sort((a, b) => b - a)).toEqual(weights);
		expect(best?.score).toBeGreaterThan(MIN_SCORE);
	});

	it("offers one of several near-identical notes, with the distinct one", async () => {
		const text = "marmalade quince jelly preserve citrus orchard";
		const result = await connections("Active", {
			...filler(10),
			Active: { text },
			"Twin one": { text },
			"Twin two": { text },
			"Twin three": { text },
			Other: { text: "marmalade quince jelly sugar" },
		});
		expect(paths(result)).toHaveLength(2);
		expect(paths(result)).toContain("Other");
	});

	it("returns nothing for an unknown note", async () => {
		expect(await connections("Missing", { Other: {} })).toEqual([]);
	});
});
