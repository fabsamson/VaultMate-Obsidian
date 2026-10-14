import { describe, expect, it } from "vitest";

import { addTrackTask, applyEdits, dedentChildren, dropIdea, promoteIdea, refusalMessage, setTrackStatus, trackTaskLine, type WritePlan } from "../src/features/projects/project-write";
import { readProject } from "../src/features/projects/project-note";

const NOTE = [
	"# Objectif",
	"",
	"# 💡 Idées",
	"- first idea",
	"    - detail one",
	"        - deeper",
	"- second idea",
	"",
	"# 🧭 Pistes",
	"## ★ Alpha",
	"Some prose.",
	"",
	"## 🔨 Beta",
	"- [ ] existing ➕ 2026-10-01",
	"    - note under the task",
	"",
	"## 📥 Gamma",
	"",
	"# ✅ Réalisé",
	"- shipped",
];

function apply(lines: string[], plan: WritePlan): string[] {
	if (!plan.ok) throw new Error(`refused: ${plan.reason}`);
	return applyEdits(lines, plan.edits);
}

function track(lines: string[], title: string) {
	const found = readProject(lines).tracks.find((t) => t.title === title);
	if (!found) throw new Error(title);
	return found;
}

function idea(lines: string[], text: string) {
	const found = readProject(lines).ideas.find((i) => i.text === text);
	if (!found) throw new Error(text);
	return found;
}

describe("setTrackStatus", () => {
	it("replaces the marker and changes nothing else", () => {
		const next = apply(NOTE, setTrackStatus(NOTE, track(NOTE, "Alpha"), "progress"));
		expect(next).toEqual(NOTE.map((line) => (line === "## ★ Alpha" ? "## 🔨 Alpha" : line)));
	});

	it("adds a missing marker and writes U+FE0F for dropped", () => {
		const lines = ["# Tracks", "## Plain title · F1"];
		expect(apply(lines, setTrackStatus(lines, track(lines, "Plain title · F1"), "dropped"))[1]).toBe("## 🗑️ Plain title · F1");
		expect(apply(lines, setTrackStatus(lines, track(lines, "Plain title · F1"), "explore"))[1]).toBe("## ★ Plain title · F1");
	});

	it("rewrites the read variants as the written marker", () => {
		const lines = ["# Tracks", "## ⭐ Star", "## 🗑 Bin"];
		expect(apply(lines, setTrackStatus(lines, track(lines, "Star"), "backlog"))[1]).toBe("## 📥 Star");
		expect(apply(lines, setTrackStatus(lines, track(lines, "Bin"), "explore"))[2]).toBe("## ★ Bin");
	});

	it("writes nothing when the marker is already the written one", () => {
		const plan = setTrackStatus(NOTE, track(NOTE, "Beta"), "progress");
		expect(plan).toEqual({ ok: true, edits: [] });
	});

	it("refuses when the heading line changed or is not a track", () => {
		const ref = track(NOTE, "Alpha");
		const edited = NOTE.map((line) => (line === "## ★ Alpha" ? "## ★ Alpha edited" : line));
		expect(setTrackStatus(edited, ref, "done")).toEqual({ ok: false, reason: "changed" });
		const moved = ["", ...NOTE];
		expect(setTrackStatus(moved, ref, "done")).toEqual({ ok: false, reason: "changed" });
		expect(setTrackStatus(NOTE, { line: 8, raw: NOTE[8] ?? "" }, "done")).toEqual({ ok: false, reason: "not-found" });
	});

	it("starts a track: status and first task in one plan", () => {
		const ref = track(NOTE, "Gamma");
		const plan = setTrackStatus(NOTE, ref, "progress", { text: "Write the parser", today: "2026-10-14", due: "2026-10-18" });
		expect(plan.ok && plan.edits).toHaveLength(2);
		const next = apply(NOTE, plan);
		expect(next).toEqual([
			...NOTE.slice(0, 16),
			"## 🔨 Gamma",
			"- [ ] Write the parser ➕ 2026-10-14 📅 2026-10-18",
			...NOTE.slice(17),
		]);
	});

	it("still adds the task when the track already has the status, and refuses an empty task", () => {
		const ref = track(NOTE, "Beta");
		const next = apply(NOTE, setTrackStatus(NOTE, ref, "progress", { text: "next", today: "2026-10-14" }));
		expect(next[15]).toBe("- [ ] next ➕ 2026-10-14");
		expect(setTrackStatus(NOTE, ref, "progress", { text: "  ", today: "2026-10-14" })).toEqual({ ok: false, reason: "empty-text" });
	});
});

describe("addTrackTask", () => {
	it("goes after the last non-blank line of the block, nested lines included", () => {
		const next = apply(NOTE, addTrackTask(NOTE, track(NOTE, "Beta"), { text: "Second", today: "2026-10-14" }));
		expect(next.slice(12, 18)).toEqual(["## 🔨 Beta", "- [ ] existing ➕ 2026-10-01", "    - note under the task", "- [ ] Second ➕ 2026-10-14", "", "## 📥 Gamma"]);
	});

	it("goes right after the heading when the block is empty, and after prose", () => {
		expect(apply(NOTE, addTrackTask(NOTE, track(NOTE, "Gamma"), { text: "T", today: "2026-10-14" }))[17]).toBe("- [ ] T ➕ 2026-10-14");
		expect(apply(NOTE, addTrackTask(NOTE, track(NOTE, "Alpha"), { text: "T", today: "2026-10-14" }))[11]).toBe("- [ ] T ➕ 2026-10-14");
	});

	it("goes at the end of a note whose last track has no trailing newline", () => {
		const lines = ["# Tracks", "## 🔨 Last", "text"];
		expect(apply(lines, addTrackTask(lines, track(lines, "Last"), { text: "T", today: "2026-10-14" }))).toEqual([...lines, "- [ ] T ➕ 2026-10-14"]);
	});

	it("keeps CRLF notes intact when joined back", () => {
		const text = "# Tracks\r\n## 🔨 A\r\n- [ ] x\r\n";
		const lines = text.split(/\r?\n/);
		const next = apply(lines, addTrackTask(lines, track(lines, "A"), { text: "y", today: "2026-10-14" }));
		expect(next.join("\r\n")).toBe("# Tracks\r\n## 🔨 A\r\n- [ ] x\r\n- [ ] y ➕ 2026-10-14\r\n");
	});

	it("formats the task line and collapses the text to one line", () => {
		expect(trackTaskLine("  a\nb  ", "2026-10-14")).toBe("- [ ] a b ➕ 2026-10-14");
		expect(trackTaskLine("a", "2026-10-14", "2026-11-01")).toBe("- [ ] a ➕ 2026-10-14 📅 2026-11-01");
		expect(trackTaskLine(" ", "2026-10-14")).toBeNull();
	});

	it("refuses on a changed heading", () => {
		const ref = track(NOTE, "Beta");
		const edited = NOTE.map((line) => (line === "## 🔨 Beta" ? "## 📥 Beta" : line));
		expect(addTrackTask(edited, ref, { text: "x", today: "2026-10-14" })).toEqual({ ok: false, reason: "changed" });
		expect(refusalMessage("changed")).toMatch(/changed/);
	});
});

describe("promoteIdea", () => {
	it("moves the idea and its children to the end of the Tracks section, dedented", () => {
		const next = apply(NOTE, promoteIdea(NOTE, idea(NOTE, "first idea")));
		expect(next).toEqual([
			"# Objectif",
			"",
			"# 💡 Idées",
			"- second idea",
			"",
			"# 🧭 Pistes",
			"## ★ Alpha",
			"Some prose.",
			"",
			"## 🔨 Beta",
			"- [ ] existing ➕ 2026-10-01",
			"    - note under the task",
			"",
			"## 📥 Gamma",
			"",
			"## ★ first idea",
			"- detail one",
			"    - deeper",
			"",
			"# ✅ Réalisé",
			"- shipped",
		]);
	});

	it("uses the status given and the level below the section level", () => {
		const lines = ["# P", "## Ideas", "- x", "## Tracks", "### 🔨 Old"];
		const next = apply(lines, promoteIdea(lines, idea(lines, "x"), { status: "backlog" }));
		expect(next).toEqual(["# P", "## Ideas", "## Tracks", "### 🔨 Old", "", "### 📥 x"]);
	});

	it("handles tab-indented children", () => {
		const lines = ["# Ideas", "- x", "\t- child", "\t\t- grandchild", "# Pistes"];
		const next = apply(lines, promoteIdea(lines, idea(lines, "x")));
		expect(next).toEqual(["# Ideas", "# Pistes", "", "## ★ x", "- child", "\t- grandchild"]);
	});

	it("creates the Tracks section after the Ideas block with the given title", () => {
		const lines = ["# Goal", "# Ideas", "- keep", "- move", "  - kid", "", "# Notes", "text"];
		const next = apply(lines, promoteIdea(lines, idea(lines, "move"), { tracksTitle: "🧭 Pistes" }));
		expect(next).toEqual(["# Goal", "# Ideas", "- keep", "", "# 🧭 Pistes", "", "## ★ move", "- kid", "", "# Notes", "text"]);
		expect(readProject(next).tracks.map((t) => t.title)).toEqual(["move"]);
	});

	it("creates the section with the default title when none is given", () => {
		const lines = ["# Ideas", "- only"];
		expect(apply(lines, promoteIdea(lines, idea(lines, "only")))).toEqual(["# Ideas", "", "# 🧭 Tracks", "", "## ★ only"]);
	});

	it("refuses when the idea line changed", () => {
		const ref = idea(NOTE, "first idea");
		const edited = NOTE.map((line) => (line === "- first idea" ? "- first idea (edited)" : line));
		expect(promoteIdea(edited, ref)).toEqual({ ok: false, reason: "changed" });
		expect(promoteIdea(NOTE, { line: 13, raw: NOTE[13] ?? "" })).toEqual({ ok: false, reason: "not-found" });
	});

	it("refuses an item that is not a top-level idea (a task or an indented line)", () => {
		expect(promoteIdea(NOTE, { line: 4, raw: NOTE[4] ?? "" })).toEqual({ ok: false, reason: "not-found" });
	});

	it("dedents by the least indented child", () => {
		expect(dedentChildren(["  - a", "    - b"])).toEqual(["- a", "  - b"]);
		expect(dedentChildren([])).toEqual([]);
	});
});

describe("dropIdea", () => {
	it("removes the item and its more-indented lines only", () => {
		const next = apply(NOTE, dropIdea(NOTE, idea(NOTE, "first idea")));
		expect(next).toEqual([...NOTE.slice(0, 3), ...NOTE.slice(6)]);
	});

	it("removes a last item and keeps the rest", () => {
		const next = apply(NOTE, dropIdea(NOTE, idea(NOTE, "second idea")));
		expect(next).toEqual([...NOTE.slice(0, 6), ...NOTE.slice(7)]);
	});

	it("refuses when the text changed", () => {
		const ref = idea(NOTE, "second idea");
		const edited = NOTE.map((line) => (line === "- second idea" ? "- other" : line));
		expect(dropIdea(edited, ref)).toEqual({ ok: false, reason: "changed" });
	});
});
