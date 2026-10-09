// Evaluation of the connections finder on the synthetic corpus (tests/fixtures/connections). The
// expectations were written before tuning: see expected.json for what each active note should get.
import { describe, expect, it } from "vitest";

import { findConnections, type Connection } from "../src/features/context/engine";
import { areTied, buildGraphContext } from "../src/features/context/graph";
import type { NoteMeta } from "../src/features/context/note-meta";
import { wordingSimilarity } from "../src/features/context/terms";
import { buildVault, loadCorpus } from "./helpers/vault-fixture";

interface Entry {
	bridges: string[];
	traps: string[];
	unrelated: string[];
}

const corpus = loadCorpus();
const expected = JSON.parse(corpus.expected) as { excludedFolders: string[]; duplicateGroups: string[][]; neverProposed: string[]; actives: Record<string, Entry> };
const vault = buildVault(corpus.files, { excludedFolders: expected.excludedFolders });

/** Precision of the proposed notes against the planted bridges must stay at least this. */
const MIN_PRECISION = 0.9;
/** Share of the planted bridges that must be found. */
const MIN_RECALL = 0.85;

const titleOf = (path: string): string => vault.notes.get(path)?.title ?? path;
/** A note counts as the same idea as the others of its group of near-duplicates. */
const sameIdea = (a: string, b: string): boolean => a === b || expected.duplicateGroups.some((group) => group.includes(a) && group.includes(b));

async function run(name: string): Promise<Connection[]> {
	return findConnections({ active: vault.pathOf(name), notes: vault.notes, text: vault.text, readText: vault.readText, limit: 3 });
}

const results = new Map<string, string[]>();
for (const name of Object.keys(expected.actives)) results.set(name, (await run(name)).map((connection) => titleOf(connection.path)));

describe("connections on the synthetic corpus", () => {
	it("never proposes a trap, an unrelated note, an empty note or the template", () => {
		for (const [name, entry] of Object.entries(expected.actives)) {
			for (const title of results.get(name) ?? []) {
				expect(entry.traps, `${name} -> ${title}`).not.toContain(title);
				expect(entry.unrelated, `${name} -> ${title}`).not.toContain(title);
				expect(expected.neverProposed, `${name} -> ${title}`).not.toContain(title);
			}
		}
	});

	it("proposes the planted bridges with a precision and a recall above the targets", () => {
		let proposed = 0;
		let right = 0;
		let wanted = 0;
		let found = 0;
		for (const [name, entry] of Object.entries(expected.actives)) {
			const titles = results.get(name) ?? [];
			proposed += titles.length;
			right += titles.filter((title) => entry.bridges.some((bridge) => sameIdea(bridge, title))).length;
			// A group of near-duplicates is one bridge.
			const groups = entry.bridges.filter((bridge, index) => entry.bridges.findIndex((other) => sameIdea(other, bridge)) === index);
			wanted += groups.length;
			found += groups.filter((bridge) => titles.some((title) => sameIdea(bridge, title))).length;
		}
		expect(right / proposed).toBeGreaterThanOrEqual(MIN_PRECISION);
		expect(found / wanted).toBeGreaterThanOrEqual(MIN_RECALL);
	});

	it("proposes nothing for notes with nothing to connect", () => {
		for (const [name, entry] of Object.entries(expected.actives)) if (entry.bridges.length === 0) expect(results.get(name), name).toEqual([]);
	});

	it("never proposes a group of near-duplicates or notes tied to each other", () => {
		for (const [name, titles] of results) {
			const context = buildGraphContext(vault.notes.get(vault.pathOf(name)) as NoteMeta, vault.notes);
			for (const [i, a] of titles.entries()) {
				for (const b of titles.slice(i + 1)) {
					expect(sameIdea(a, b), `${name}: ${a} and ${b}`).toBe(false);
					expect(areTied(context, vault.pathOf(a), vault.pathOf(b)), `${name}: ${a} and ${b}`).toBe(false);
					expect(wordingSimilarity(vault.text, vault.pathOf(a), vault.pathOf(b)), `${name}: ${a} and ${b}`).toBeLessThan(0.8);
				}
			}
		}
	});

	it("gives each proposed note the terms or reasons that explain it", async () => {
		for (const name of Object.keys(expected.actives)) {
			for (const connection of await run(name)) expect(connection.terms.length + connection.reasons.length, `${name} -> ${connection.path}`).toBeGreaterThan(0);
		}
	});
});
