import { describe, expect, it } from "vitest";

import { aboutLine, indexingLine, noteFolder, noteTitle, REASON_ICONS, relatedSummary, statsLine } from "../src/features/context/context-labels";
import type { ContextStats } from "../src/features/context/context-index";

const stats = (overrides: Partial<ContextStats>): ContextStats => ({ notesTotal: 301, notesIndexed: 0, notesReused: 301, buildMs: 400, lastQueryMs: 0, lastMetaMs: 0, ...overrides });

describe("relatedSummary", () => {
	it("tells what the tile shows in each state", () => {
		expect(relatedSummary({ name: null, building: null, count: null })).toBe("Open a note first");
		expect(relatedSummary({ name: "Trip", building: { done: 120, total: 301 }, count: null })).toBe("Indexing… 120 of 301");
		expect(relatedSummary({ name: "Trip", building: null, count: 3 })).toBe("3 new connections for Trip");
		expect(relatedSummary({ name: "Trip", building: null, count: 1 })).toBe("1 new connection for Trip");
		expect(relatedSummary({ name: "Trip", building: null, count: 0 })).toBe("No new connection for Trip");
		expect(relatedSummary({ name: "Trip", building: null, count: null })).toBe("Notes related to Trip");
	});
});

describe("labels", () => {
	it("words the progress and the statistics", () => {
		expect(indexingLine({ done: 120, total: 301 })).toBe("Indexing your notes… 120 of 301");
		expect(statsLine(stats({}))).toBe("Indexed 301 notes in 0.4 s · computed on this device");
		expect(statsLine(stats({ notesTotal: 1, buildMs: 4 }))).toBe("Indexed 1 note in 0.1 s · computed on this device");
		expect(statsLine(stats({ buildMs: 5400 }))).toBe("Indexed 301 notes in 5.4 s · computed on this device");
	});

	it("words the shared terms of a connection", () => {
		expect(aboutLine([])).toBe("");
		expect(aboutLine(["checklist"])).toBe("Both are about checklist");
		expect(aboutLine(["checklist", "preparation"])).toBe("Both are about checklist and preparation");
		expect(aboutLine(["checklist", "preparation", "interruptions"])).toBe("Both are about checklist, preparation and interruptions");
	});

	it("splits a path into title and folder", () => {
		expect(noteTitle("Projects/Trip/Plan.md")).toBe("Plan");
		expect(noteFolder("Projects/Trip/Plan.md")).toBe("Projects/Trip");
		expect(noteFolder("Plan.md")).toBe("");
	});

	it("has an icon for each kind of reason", () => {
		expect(Object.keys(REASON_ICONS).sort()).toEqual(["mention", "place", "property"]);
	});
});
