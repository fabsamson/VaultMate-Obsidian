import { describe, expect, it } from "vitest";

import { buildVault, loadCorpus } from "./helpers/vault-fixture";

interface Expected {
	excludedFolders: string[];
	neverProposed: string[];
	actives: Record<string, { bridges: string[]; traps: string[]; unrelated: string[] }>;
}

const corpus = loadCorpus();
const expected = JSON.parse(corpus.expected) as Expected;
const { files } = corpus;
const vault = buildVault(files, { excludedFolders: expected.excludedFolders });

describe("connections corpus", () => {
	it("is a mixed vault of about fifty notes in several folders", () => {
		expect(files.size).toBeGreaterThanOrEqual(40);
		expect(files.size).toBeLessThanOrEqual(60);
		const folders = new Set([...files.keys()].map((path) => path.split("/")[0]));
		expect([...folders].sort()).toEqual(["Cooking", "Daily", "Garden", "Music", "Notes", "Projects", "Templates"]);
	});

	it("has unique titles, resolved links and prose of a realistic length", () => {
		const titles = [...files.keys()].map((path) => (path.split("/").pop() ?? "").replace(/\.md$/, ""));
		expect(new Set(titles).size).toBe(titles.length);
		for (const note of vault.notes.values()) {
			const raw = [...(vault.texts.get(note.path)?.matchAll(/\[\[([^\]|#]+)/g) ?? [])].map((match) => match[1]);
			expect(note.links.length, `${note.path} has unresolved links`).toBe(new Set(raw).size);
			const words = vault.text.doc(note.path)?.words ?? 0;
			const isIndex = /index|^Inbox$|^20/.test(note.title);
			if (!isIndex) expect(words, note.title).toBeGreaterThanOrEqual(60);
			expect(words, note.title).toBeLessThan(300);
		}
	});

	it("only names existing notes in the expectations, and its bridges are symmetric", () => {
		const known = new Set([...vault.notes.values()].map((note) => note.title));
		known.add("Meeting template");
		for (const [active, entry] of Object.entries(expected.actives)) {
			for (const title of [active, ...entry.bridges, ...entry.traps, ...entry.unrelated]) expect(known.has(title), title).toBe(true);
			for (const bridge of entry.bridges) expect(expected.actives[bridge]?.bridges, `${bridge} should list ${active}`).toContain(active);
		}
		for (const title of expected.neverProposed) expect(known.has(title), title).toBe(true);
	});

	it("plants every bridge between notes that are not connected by the graph", () => {
		const backlinks = new Map<string, Set<string>>();
		for (const note of vault.notes.values()) for (const target of note.links) backlinks.set(target, (backlinks.get(target) ?? new Set()).add(note.path));
		for (const [active, entry] of Object.entries(expected.actives)) {
			const a = vault.notes.get(vault.pathOf(active));
			for (const bridge of entry.bridges) {
				const b = vault.notes.get(vault.pathOf(bridge));
				if (!a || !b) throw new Error("missing note");
				expect(a.links).not.toContain(b.path);
				expect(b.links).not.toContain(a.path);
				const sharedCiter = [...(backlinks.get(a.path) ?? [])].some((from) => vault.notes.get(from)?.links.includes(b.path));
				expect(sharedCiter, `${active} and ${bridge} are co-cited`).toBe(false);
			}
		}
	});
});
