import { describe, expect, it } from "vitest";

import { readProject, trackCounts } from "../src/features/projects/project-note";
import { boardStatuses, headerCounts, lineIn, moveTargets, needsNextTask, primaryAction, taskSummary, tileSummary } from "../src/features/projects/projects-model";

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

describe("board and buttons", () => {
	it("hides Done and Dropped unless asked", () => {
		expect(boardStatuses(false)).toEqual(["explore", "backlog", "progress"]);
		expect(boardStatuses(true)).toEqual(["explore", "backlog", "progress", "done", "dropped"]);
	});

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

	it("writes the header counts", () => {
		expect(headerCounts(trackCounts(tracks), false)).toBe("1 explore · 1 backlog · 2 in progress");
		expect(headerCounts(trackCounts(tracks), true)).toBe("1 explore · 1 backlog · 2 in progress · 1 done");
	});

	it("tells whether a line is inside a block", () => {
		expect(lineIn(4, 4, 8)).toBe(true);
		expect(lineIn(8, 4, 8)).toBe(false);
	});
});
