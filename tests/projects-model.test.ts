import { describe, expect, it } from "vitest";

import { readProject, trackCounts } from "../src/features/projects/project-note";
import { parseJournalLine } from "../src/features/journal/journal-line";
import {
	lineIn,
	moveTargets,
	needsNextTask,
	nextDueTask,
	nextTaskLine,
	orderTiles,
	primaryAction,
	reviewsDueText,
	sectionChips,
	splitEntries,
	summarizeProject,
	taskSummary,
	tileCounters,
	tileSummary,
} from "../src/features/projects/projects-model";

const TAGS = { decisionTag: "decision", predictionTag: "prediction" };
const NOTE = ["# Ideas", "- a", "- b", "# Tracks", "## 🔨 Busy", "- [ ] first ➕ 2026-10-01", "- [x] done one", "- [ ] second", "## 🔨 Idle", "- [x] only done", "## 📥 Later", "## ★ Maybe", "## ✅ Over"];
const tracks = readProject(NOTE).tracks;
const byTitle = (title: string) => {
	const found = tracks.find((track) => track.title === title);
	if (!found) throw new Error(title);
	return found;
};

describe("tileSummary", () => {
	it("lists the non-zero parts", () => {
		const counts = { tracks: trackCounts(tracks), ideas: 2 };
		expect(tileSummary([counts])).toBe("2 in progress · 1 backlog · 2 ideas");
		expect(tileSummary([counts, counts])).toBe("4 in progress · 2 backlog · 4 ideas");
	});

	it("says what is missing", () => {
		expect(tileSummary([])).toBe("No projects yet");
		expect(tileSummary([{ tracks: trackCounts([]), ideas: 0 }])).toBe("Nothing in progress");
		expect(tileSummary([{ tracks: trackCounts([]), ideas: 1 }])).toBe("1 idea");
	});
});

describe("buttons", () => {
	it("gives each status its main button", () => {
		expect(primaryAction("explore")).toEqual({ label: "To backlog", target: "backlog" });
		expect(primaryAction("backlog")).toEqual({ label: "Start", target: "progress" });
		expect(primaryAction("progress")).toEqual({ label: "Done", target: "done" });
		expect(primaryAction("done")).toEqual({ label: "Reopen", target: "progress" });
		expect(primaryAction("dropped")).toEqual({ label: "Restore", target: "explore" });
	});

	it("offers every other status in the Move menu", () => {
		expect(moveTargets("progress")).toEqual(["explore", "backlog", "done", "dropped"]);
	});

	it("summarizes the tasks and flags a track that needs a next task", () => {
		expect(taskSummary(byTitle("Busy"))).toBe("2 open tasks · next: first");
		expect(taskSummary(byTitle("Idle"))).toBe("No open tasks");
		expect(needsNextTask(byTitle("Idle"))).toBe(true);
		expect(needsNextTask(byTitle("Busy"))).toBe(false);
		expect(needsNextTask(byTitle("Later"))).toBe(false);
	});

	it("tells whether a line is inside a block", () => {
		expect(lineIn(4, 4, 8)).toBe(true);
		expect(lineIn(8, 4, 8)).toBe(false);
	});
});

describe("dashboard summary", () => {
	const today = new Date(2026, 9, 21);
	const model = (lines: string[]) => readProject(lines);
	const dated = model(["# Tracks", "## 🔨 Gate", "- [ ] paint 📅 2026-10-30", "- [ ] hinge 📅 2026-10-19", "## 📥 Shed", "- [ ] measure 📅 2026-10-22", "## ✅ Over", "- [ ] stale 📅 2026-01-01", "## 🗑️ Gone", "- [ ] nope 📅 2026-01-02"]);

	it("takes the nearest dated open task, overdue included", () => {
		expect(nextDueTask(dated.tracks, today)).toEqual({ text: "hinge", track: "Gate", due: "2026-10-19", overdue: true });
		expect(nextTaskLine(nextDueTask(dated.tracks, today)!)).toBe("hinge · Gate · overdue");
	});

	it("ignores Done and Dropped tracks and keeps a future date as is", () => {
		const future = model(["# Tracks", "## 🔨 Gate", "- [ ] paint 📅 2026-10-30", "## ✅ Over", "- [ ] stale 📅 2026-01-01"]);
		expect(nextDueTask(future.tracks, today)).toEqual({ text: "paint", track: "Gate", due: "2026-10-30", overdue: false });
		expect(nextTaskLine(nextDueTask(future.tracks, today)!)).toBe("paint · Gate · 2026-10-30");
	});

	it("falls back to the next task of the first In progress track, without a date", () => {
		const undated = model(["# Tracks", "## 📥 Shed", "- [ ] measure", "## 🔨 Idle", "- [x] done", "## 🔨 Gate", "- [ ] paint", "- [ ] hinge"]);
		expect(nextDueTask(undated.tracks, today)).toEqual({ text: "paint", track: "Gate", due: null, overdue: false });
		expect(nextTaskLine(nextDueTask(undated.tracks, today)!)).toBe("paint · Gate");
	});

	it("has no next task when nothing is open in an In progress track and nothing is dated", () => {
		expect(nextDueTask(model(["# Tracks", "## 📥 Shed", "- [ ] measure", "## 🔨 Idle"]).tracks, today)).toBeNull();
		expect(nextDueTask([], today)).toBeNull();
	});

	it("summarizes counts, ideas and the reviews due", () => {
		const project = { path: "P.md", name: "P", model: { ...dated, ideas: readProject(["# Ideas", "- a", "- b"]).ideas } };
		const due = { path: "P.md", line: 1, entry: parseJournalLine("- [ ] x #decision 📅 2026-10-20", TAGS)! };
		const later = { path: "P.md", line: 2, entry: parseJournalLine("- [ ] y #decision 📅 2026-11-20", TAGS)! };
		const summary = summarizeProject(project, { byTrack: [[due], []], outside: [later] }, today);
		expect(summary).toMatchObject({ ideas: 2, reviewsDue: 1, counts: { progress: 1, backlog: 1, done: 1, dropped: 1, explore: 0 } });
		expect(tileCounters(summary)).toEqual({ statuses: [{ status: "progress", count: 1 }, { status: "backlog", count: 1 }], ideas: "2 ideas" });
		expect(reviewsDueText(1)).toBe("1 review due");
		expect(reviewsDueText(3)).toBe("3 reviews due");
		expect(reviewsDueText(0)).toBe("");
	});

	it("says nothing for a project with no tracks and no ideas", () => {
		const summary = summarizeProject({ path: "E.md", name: "E", model: { tracks: [], ideas: [] } }, { byTrack: [], outside: [] }, today);
		expect(tileCounters(summary)).toEqual({ statuses: [], ideas: "" });
		expect(summary.next).toBeNull();
	});
});

describe("orderTiles", () => {
	const tile = (name: string, progress: number, reviewsDue: number) => ({ path: name, name, counts: { explore: 0, backlog: 0, progress, done: 0, dropped: 0 }, ideas: 0, reviewsDue, next: null });

	it("puts review due first, then in progress, and the rest under Other", () => {
		const { shown, other } = orderTiles([tile("a", 0, 0), tile("b", 2, 0), tile("c", 0, 1), tile("d", 1, 3), tile("e", 0, 0)]);
		expect(shown.map((entry) => entry.name)).toEqual(["c", "d", "b"]);
		expect(other.map((entry) => entry.name)).toEqual(["a", "e"]);
	});

	it("keeps everything under Other when nothing is active", () => {
		expect(orderTiles([tile("a", 0, 0)]).shown).toEqual([]);
		expect(orderTiles([]).other).toEqual([]);
	});
});

describe("sectionChips", () => {
	const counts = trackCounts(readProject(["# Tracks", "## 🔨 a", "## 🔨 b", "## 📥 c", "## ★ d", "## ✅ e", "## 🗑️ f"]).tracks);

	it("lists the non-empty sections in the page order, Done and Dropped together", () => {
		expect(sectionChips(counts, 5, 2)).toEqual([
			{ id: "ideas", count: 5 },
			{ id: "progress", count: 2 },
			{ id: "backlog", count: 1 },
			{ id: "explore", count: 1 },
			{ id: "reviews", count: 2 },
			{ id: "closed", count: 2 },
		]);
	});

	it("leaves out the empty ones", () => {
		expect(sectionChips(trackCounts([]), 0, 0)).toEqual([]);
		expect(sectionChips(trackCounts([]), 0, 1)).toEqual([{ id: "reviews", count: 1 }]);
	});
});

describe("splitEntries", () => {
	// 0 Tracks, 1 Gate, 2 entry, 3 task, 4 blank, 5 Shed, 6 entry, 7 Notes
	const lines = ["# Tracks", "## 🔨 Gate", "- [ ] a #decision 📅 2026-10-25", "- [ ] t", "", "## 📥 Shed", "- [ ] b #prediction 📅 2026-10-20", "# Notes", "- [ ] c #decision 📅 2026-10-22"];
	const project = { path: "Lyon/Lyon.md", model: readProject(lines) };
	const item = (path: string, line: number, text: string, extra: object = {}) => ({ path, line, entry: parseJournalLine(text, TAGS)!, ...extra });
	const inGate = item("Lyon/Lyon.md", 2, lines[2]);
	const inShed = item("Lyon/Lyon.md", 6, lines[6]);
	const outside = item("Lyon/Lyon.md", 8, lines[8]);
	const sub = item("Lyon/Flat.md", 0, "- [ ] s #decision 📅 2026-10-21");

	it("puts an entry in its track's block and the others outside, due first", () => {
		const split = splitEntries(project, [inGate, inShed, outside], null);
		expect(split.byTrack).toEqual([[inGate], [inShed]]);
		expect(split.outside).toEqual([outside]);
	});

	it("takes the sub-notes of a folder note, never in a track", () => {
		const tree = new Set(["Lyon/Lyon.md", "Lyon/Flat.md"]);
		expect(splitEntries(project, [outside, sub, inGate], tree).outside).toEqual([sub, outside]);
		expect(splitEntries(project, [sub], null).outside).toEqual([]);
		expect(splitEntries(project, [item("Other.md", 8, lines[8])], tree).outside).toEqual([]);
	});

	it("leaves out closed, plain and undated entries", () => {
		const closed = item("Lyon/Lyon.md", 8, "- [x] c #decision 📅 2026-10-22 ✅ 2026-10-23");
		const undated = item("Lyon/Lyon.md", 8, "- [ ] c #decision");
		const plain = item("Lyon/Lyon.md", 8, lines[8], { plain: true });
		expect(splitEntries(project, [closed, undated, plain], null)).toEqual({ byTrack: [[], []], outside: [] });
	});

	it("ends a track block before the next heading", () => {
		const gate = project.model.tracks[0];
		expect(inShed.line).toBeGreaterThanOrEqual(gate.end);
	});
});
