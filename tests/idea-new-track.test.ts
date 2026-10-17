import { applyEdits } from "../src/core/note-edit";
import { describe, expect, it } from "vitest";

import { ideaChildren, orderedHeadings } from "../src/features/ideas/idea-note";
import { readProject, type ProjectTags } from "../src/features/projects/project-note";
import { newTrackInNote, promoteIdea, type NewTrack, type WritePlan } from "../src/features/projects/project-write";

const TAGS: ProjectTags = { idea: "idea", decision: "decision", prediction: "prediction", seed: "projet" };

function apply(lines: string[], plan: WritePlan): string[] {
	if (!plan.ok) throw new Error(`refused: ${plan.reason}`);
	return applyEdits(lines, plan.edits);
}

// The idea lives in another note; its children are read the way the writer reads them.
const SOURCE = ["- [ ] Brief du soir dans l'app #idea ➕ 2026-10-14", "    - detail one", "        - deeper", "    - [ ] a subtask"];
const SOURCE_CHILDREN = ideaChildren(SOURCE, 0);

const PROJECT = ["# 🎯 Goal", "# 💡 Ideas", "- raw", "# 🧭 Tracks", "## 🔨 Work", "- [ ] real task", "", "# 📝 Notes", "text"];

function track(over: Partial<NewTrack> = {}): NewTrack {
	return { name: "Brief du soir", status: "explore", text: "Brief du soir dans l'app", children: SOURCE_CHILDREN, ...over };
}

describe("newTrackInNote (an idea of another note)", () => {
	it("appends the track at the end of the Tracks section with the full text and the copied children", () => {
		const next = apply(PROJECT, newTrackInNote(PROJECT, track()));
		expect(next).toEqual([
			"# 🎯 Goal",
			"# 💡 Ideas",
			"- raw",
			"# 🧭 Tracks",
			"## 🔨 Work",
			"- [ ] real task",
			"",
			"## ★ Brief du soir",
			"Brief du soir dans l'app",
			"- detail one",
			"    - deeper",
			"- [ ] a subtask",
			"",
			"# 📝 Notes",
			"text",
		]);
		expect(readProject(next, TAGS).tracks.map((entry) => entry.title)).toEqual(["Work", "Brief du soir"]);
	});

	it("writes the title alone when the short name is the text, and follows the target's tabs", () => {
		const tabs = ["# Tracks", "## ★ A", "- a", "\t- b"];
		const next = apply(tabs, newTrackInNote(tabs, track({ name: "Same", text: "Same" })));
		expect(next.slice(-5)).toEqual(["", "## ★ Same", "- detail one", "\t- deeper", "- [ ] a subtask"]);
	});

	it("starts In progress with a first task inside the block", () => {
		const next = apply(PROJECT, newTrackInNote(PROJECT, track({ status: "progress", children: [], firstTask: { text: "Sketch it", today: "2026-10-15", due: "2026-10-20" } })));
		expect(next.slice(7, 11)).toEqual(["## \u{1F528} Brief du soir", "Brief du soir dans l'app", "- [ ] Sketch it ➕ 2026-10-15 \u{1F4C5} 2026-10-20", ""]);
	});

	it("ignores the first task of another status", () => {
		const next = apply(PROJECT, newTrackInNote(PROJECT, track({ status: "backlog", children: [], firstTask: { text: "Sketch it", today: "2026-10-15" } })));
		expect(next.join("\n")).not.toContain("Sketch it");
	});

	it("escapes a text that starts like Markdown", () => {
		const next = apply(PROJECT, newTrackInNote(PROJECT, track({ text: "- not a bullet", children: [] })));
		expect(next).toContain("\\- not a bullet");
	});

	it("refuses an empty name", () => {
		expect(newTrackInNote(PROJECT, track({ name: "  " }))).toEqual({ ok: false, reason: "empty-name" });
	});

	it("writes into a note with no section at all, at level 1", () => {
		const plain = ["Some text", "", "More text"];
		const next = apply(plain, newTrackInNote(plain, track({ children: [] })));
		expect(next).toEqual(["Some text", "", "More text", "", "# 🧭 Tracks", "", "## ★ Brief du soir", "Brief du soir dans l'app"]);
	});

	it("creates the Tracks section with the given title when allowed", () => {
		const plain = ["# Ideas", "- raw", "# Notes"];
		const next = apply(plain, newTrackInNote(plain, track({ children: [] }), { tracksTitle: "🧭 Pistes" }));
		expect(next).toEqual(["# Ideas", "- raw", "", "# 🧭 Pistes", "", "## ★ Brief du soir", "Brief du soir dans l'app", "# Notes"]);
	});
});

describe("a new track in the idea's own note", () => {
	const OWN = ["# 💡 Ideas", "- [ ] Own idea with a long text #idea ➕ 2026-10-14", "    - child", "# 🧭 Tracks", "## ★ Old"];

	it("moves the idea in one edit: the line and children leave, the track appends", () => {
		const plan = promoteIdea(OWN, { line: 1, raw: OWN[1] ?? "" }, { tags: TAGS, shortName: "Own idea", status: "progress", firstTask: { text: "Go", today: "2026-10-15" } });
		expect(apply(OWN, plan)).toEqual(["# 💡 Ideas", "# 🧭 Tracks", "## ★ Old", "", "## \u{1F528} Own idea", "Own idea with a long text", "- child", "- [ ] Go ➕ 2026-10-15"]);
	});
});

describe("orderedHeadings", () => {
	it("puts the tracks of a project note first, then the other headings, each in note order", () => {
		const lines = ["# Goal", "# 💡 Ideas", "# 🧭 Tracks", "## 🔨 Work", "## ★ Later", "# Notes", "### deep"];
		expect(orderedHeadings(lines).map((heading) => heading.text)).toEqual(["🔨 Work", "★ Later", "Goal", "💡 Ideas", "🧭 Tracks", "Notes", "deep"]);
	});

	it("keeps the order of a note without tracks", () => {
		const lines = ["# A", "## B", "# C"];
		expect(orderedHeadings(lines).map((heading) => heading.text)).toEqual(["A", "B", "C"]);
	});

	it("skips code and frontmatter like the other heading lists", () => {
		const lines = ["---", "# not a heading", "---", "# Tracks", "## ★ T", "```", "# in code", "```", "# End"];
		expect(orderedHeadings(lines).map((heading) => heading.text)).toEqual(["★ T", "Tracks", "End"]);
	});
});
