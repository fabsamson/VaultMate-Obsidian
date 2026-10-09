import { describe, expect, it } from "vitest";

import { aboutParts, connectionsSummary, indexingLine, locationLine, noteFolder, noteTitle, REASON_ICONS, statsLine } from "../src/features/context/context-labels";
import type { ContextStats } from "../src/features/context/context-index";

const stats = (overrides: Partial<ContextStats>): ContextStats => ({ notesTotal: 301, notesIndexed: 0, notesReused: 301, buildMs: 400, lastQueryMs: 0, lastMetaMs: 0, ...overrides });

describe("connectionsSummary", () => {
	it("tells what the tile shows in each state", () => {
		expect(connectionsSummary({ name: null, building: null, count: null })).toBe("Open a note first");
		expect(connectionsSummary({ name: "Trip", building: { done: 120, total: 301 }, count: null })).toBe("Indexing… 120 of 301");
		expect(connectionsSummary({ name: "Trip", building: null, count: 3 })).toBe("3 new connections for Trip");
		expect(connectionsSummary({ name: "Trip", building: null, count: 1 })).toBe("1 new connection for Trip");
		expect(connectionsSummary({ name: "Trip", building: null, count: 0 })).toBe("No new connection for Trip");
		expect(connectionsSummary({ name: "Trip", building: null, count: null })).toBe("New connections for Trip");
	});
});

describe("labels", () => {
	it("words the progress and the statistics", () => {
		expect(indexingLine({ done: 120, total: 301 })).toBe("Indexing your notes… 120 of 301");
		expect(statsLine(stats({}))).toBe("Indexed 301 notes in 0.4 s · computed on this device");
		expect(statsLine(stats({ notesTotal: 1, buildMs: 4 }))).toBe("Indexed 1 note in 0.1 s · computed on this device");
		expect(statsLine(stats({ buildMs: 5400 }))).toBe("Indexed 301 notes in 5.4 s · computed on this device");
	});

	it("words the shared terms of a connection, two at most, flagged for emphasis", () => {
		expect(aboutParts([])).toEqual([]);
		expect(aboutParts(["checklist"])).toEqual([{ text: "Both are about ", term: false }, { text: "checklist", term: true }]);
		expect(aboutParts(["checklist", "preparation", "interruptions"]).map((part) => part.text).join("")).toBe("Both are about checklist and preparation");
	});

	it("tells where a note is, and when it is in another area", () => {
		expect(locationLine("20-Areas/Zettelkasten/A.md", "20-Areas/MOC/B.md")).toBe("in 20-Areas/Zettelkasten");
		expect(locationLine("20-Areas/Zettelkasten/A.md", "40-Collections/B.md")).toBe("in 20-Areas/Zettelkasten, another area");
		expect(locationLine("Notes/A.md", "Notes/Deep/B.md")).toBe("in Notes");
		expect(locationLine("A.md", "B.md")).toBe("at the root of the vault");
		expect(locationLine("A.md", "Notes/B.md")).toBe("at the root of the vault, another area");
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
