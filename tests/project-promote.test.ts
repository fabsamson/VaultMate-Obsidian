import { describe, expect, it } from "vitest";

import { readProject, type ProjectTags, type TrackStatus } from "../src/features/projects/project-note";
import { applyEdits, dropIdea, promoteIdea, trackFromIdea, type WritePlan } from "../src/features/projects/project-write";

const TAGS: ProjectTags = { idea: "idea", decision: "decision", prediction: "prediction", seed: "projet" };

// The table shared with the Android app: markdown in, markdown out, byte for byte.
const raw = import.meta.glob<string>("./fixtures/promote-cases.json", { query: "?raw", import: "default", eager: true });
const cases = JSON.parse(Object.values(raw)[0] ?? "[]") as Array<{
	name: string;
	markdown: string;
	ideaLine: number;
	status: TrackStatus;
	shortName: string;
	tracksTitle: string;
	expected: string;
}>;

function apply(lines: string[], plan: WritePlan): string[] {
	if (!plan.ok) throw new Error(`refused: ${plan.reason}`);
	return applyEdits(lines, plan.edits);
}

describe("promoteIdea on the shared cases", () => {
	it("loads the shared table", () => {
		expect(cases).toHaveLength(3);
	});

	it.each(cases.map((entry, index) => ({ index, ...entry })))("$name", ({ markdown, ideaLine, status, shortName, tracksTitle, expected }) => {
		const lines = markdown.split("\n");
		const line = lines[ideaLine] ?? "";
		const plan = promoteIdea(lines, { line: ideaLine, raw: line }, { status, shortName, tracksTitle });
		expect(apply(lines, plan).join("\n")).toBe(expected);
	});
});

describe("trackFromIdea", () => {
	const idea = { text: "Plain text", children: ["    - a", "        - b"] };

	it("writes the whole text as the heading without a short name, as before", () => {
		expect(trackFromIdea(2, "backlog", idea)).toEqual(["## \u{1F4E5} Plain text", "- a", "    - b"]);
	});

	it("writes the full text as the first line when the name differs", () => {
		expect(trackFromIdea(2, "explore", idea, "Short")).toEqual(["## ★ Short", "Plain text", "- a", "    - b"]);
	});

	it("escapes a first line Markdown would read as structure", () => {
		for (const text of ["# h", "> q", "- l", "+ l", "* l", "1. l", "12) l"]) {
			expect(trackFromIdea(2, "explore", { text, children: [] }, "Name")[1]).toBe("\\" + text);
		}
		for (const text of ["1 plain", "a - b", "2026 plan"]) expect(trackFromIdea(2, "explore", { text, children: [] }, "Name")[1]).toBe(text);
	});

	it("ends with the first task when one is given", () => {
		expect(trackFromIdea(2, "progress", { text: "T", children: [] }, "T", "- [ ] go ➕ 2026-10-15")).toEqual(["## \u{1F528} T", "- [ ] go ➕ 2026-10-15"]);
	});
});

describe("promoteIdea options", () => {
	const lines = ["# Ideas", "- Write the long version of it", "    - detail", "# Tracks", "## ★ Old"];
	const ref = { line: 1, raw: lines[1] ?? "" };
	const today = "2026-10-15";

	it("adds the first task inside the new block when the status is In progress", () => {
		const next = apply(lines, promoteIdea(lines, ref, { status: "progress", shortName: "Long version", firstTask: { text: " First step ", today, due: "2026-10-20" } }));
		expect(next).toEqual(["# Ideas", "# Tracks", "## ★ Old", "", "## \u{1F528} Long version", "Write the long version of it", "- detail", "- [ ] First step ➕ 2026-10-15 \u{1F4C5} 2026-10-20"]);
	});

	it("ignores the first task for another status, and an empty one", () => {
		expect(apply(lines, promoteIdea(lines, ref, { status: "backlog", firstTask: { text: "x", today } })).join("\n")).not.toContain("- [ ] x");
		expect(apply(lines, promoteIdea(lines, ref, { status: "progress", firstTask: { text: "  ", today } })).join("\n")).not.toContain("- [ ]");
	});

	it("refuses an empty short name", () => {
		expect(promoteIdea(lines, ref, { shortName: "  " })).toEqual({ ok: false, reason: "empty-name" });
	});

	it("keeps one line for a short name typed over several", () => {
		expect(apply(lines, promoteIdea(lines, ref, { shortName: "A\nB" })).join("\n")).toContain("## ★ A B");
	});
});

describe("promoting and dropping a tagged idea", () => {
	const lines = [
		"# Goal",
		"# 💡 Ideas",
		"- bullet",
		"- [ ] Task idea with a long text #idea ➕ 2026-10-10",
		"    - first detail",
		"        - deeper",
		"- keep",
		"# 🧭 Tracks",
		"## 🔨 Work",
		"- [ ] in the track #idea ➕ 2026-10-12",
		"- [ ] real task",
		"# Notes",
	];

	it("moves it like a bullet: the line and its children go, the track appends at the end of Tracks", () => {
		const next = apply(lines, promoteIdea(lines, { line: 3, raw: lines[3] ?? "" }, { tags: TAGS, shortName: "Task idea", status: "backlog" }));
		expect(next).toEqual([
			"# Goal",
			"# 💡 Ideas",
			"- bullet",
			"- keep",
			"# 🧭 Tracks",
			"## 🔨 Work",
			"- [ ] in the track #idea ➕ 2026-10-12",
			"- [ ] real task",
			"",
			"## \u{1F4E5} Task idea",
			"Task idea with a long text",
			"- first detail",
			"    - deeper",
			"# Notes",
		]);
	});

	it("moves it without children", () => {
		const next = apply(lines, promoteIdea(lines, { line: 9, raw: lines[9] ?? "" }, { tags: TAGS, shortName: "In the track" }));
		expect(next).toContain("## ★ In the track");
		expect(next).toContain("in the track");
		expect(next).not.toContain("- [ ] in the track #idea ➕ 2026-10-12");
	});

	it("uses the whole description as the heading without a short name, and refuses a tagged idea without the tags", () => {
		const next = apply(lines, promoteIdea(lines, { line: 9, raw: lines[9] ?? "" }, { tags: TAGS }));
		expect(next).toContain("## ★ in the track");
		expect(promoteIdea(lines, { line: 9, raw: lines[9] ?? "" })).toEqual({ ok: false, reason: "not-found" });
	});

	it("promotes from a note whose Tracks section exists but has no Ideas section", () => {
		const note = ["# Notes", "- [ ] lost idea #idea", "# Tracks", "## ★ A"];
		const next = apply(note, promoteIdea(note, { line: 1, raw: note[1] ?? "" }, { tags: TAGS, shortName: "Found" }));
		expect(next).toEqual(["# Notes", "# Tracks", "## ★ A", "", "## ★ Found", "lost idea"]);
	});

	it("the remaining ideas are read back, and the new track holds none of them as tasks", () => {
		const next = apply(lines, promoteIdea(lines, { line: 3, raw: lines[3] ?? "" }, { tags: TAGS, shortName: "Task idea" }));
		const model = readProject(next, TAGS);
		expect(model.ideas.map((entry) => entry.text)).toEqual(["bullet", "keep", "in the track"]);
		expect(model.tracks.map((entry) => entry.title)).toEqual(["Work", "Task idea"]);
	});

	it("does not remove a tagged idea with the bullet drop", () => {
		expect(dropIdea(lines, { line: 3, raw: lines[3] ?? "" })).toEqual({ ok: false, reason: "not-found" });
		expect(apply(lines, dropIdea(lines, { line: 2, raw: lines[2] ?? "" }))).toEqual([...lines.slice(0, 2), ...lines.slice(3)]);
	});
});
