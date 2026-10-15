import { applyEdits } from "../src/core/note-edit";
import { describe, expect, it } from "vitest";

import { convertProject, diffEdit } from "../src/features/projects/project-convert";
import { readProject } from "../src/features/projects/project-note";

const LEGACY = [
	"# 🎯 Objectif",
	"Build a thing.",
	"",
	"# 💡 Idées à explorer",
	"- idea one",
	"- idea two",
	"    - detail",
	"",
	"## ★ Alpha",
	"alpha content",
	"### Sub",
	"more",
	"",
	"## ⭐ Beta",
	"beta text",
	"",
	"# 🔨 En cours",
	"- Gamma thing",
	"    - gamma detail",
	"- [ ] a task that stays",
	"",
	"# ✅ Déjà réalisé",
	"- shipped x",
	"",
	"# ✨ Améliorations possibles",
	"- polish",
	"- shine",
	"",
	"# 📥 Backlog",
	"- [-] cancelled task",
	"",
	"# 📝 Notes",
	"some notes",
];

describe("convertProject", () => {
	const result = convertProject(LEGACY, "🧭 Pistes");

	it("moves sub-headings and bullets to a new Tracks section after the Ideas block", () => {
		expect(result.lines).toEqual([
			"# 🎯 Objectif",
			"Build a thing.",
			"",
			"# 💡 Idées à explorer",
			"- idea one",
			"- idea two",
			"    - detail",
			"",
			"# 🧭 Pistes",
			"",
			"## ★ Alpha",
			"alpha content",
			"### Sub",
			"more",
			"",
			"## ★ Beta",
			"beta text",
			"",
			"## 🔨 Gamma thing",
			"- gamma detail",
			"",
			"## ★ polish",
			"",
			"## ★ shine",
			"",
			"# 🔨 En cours",
			"- [ ] a task that stays",
			"",
			"# ✅ Déjà réalisé",
			"- shipped x",
			"",
			"# 📥 Backlog",
			"- [-] cancelled task",
			"",
			"# 📝 Notes",
			"some notes",
		]);
	});

	it("counts the tracks created and the sections removed", () => {
		expect(result.tracksCreated).toBe(5);
		expect(result.sectionsRemoved).toBe(1);
	});

	it("gives a note the new reader understands", () => {
		const model = readProject(result.lines);
		expect(model.tracks.map((t) => [t.status, t.title])).toEqual([
			["explore", "Alpha"],
			["explore", "Beta"],
			["progress", "Gamma thing"],
			["explore", "polish"],
			["explore", "shine"],
		]);
		expect(model.ideas.map((i) => i.text)).toEqual(["idea one", "idea two"]);
	});

	it("does nothing more on a second run", () => {
		const again = convertProject(result.lines, "🧭 Pistes");
		expect(again).toEqual({ lines: result.lines, tracksCreated: 0, sectionsRemoved: 0 });
	});

	it("turns Backlog, In progress and Done sub-headings into tracks of their status and removes emptied sections", () => {
		const lines = [
			"# Ideas",
			"- keep",
			"# 📥 Backlog",
			"- bullet idea",
			"## Later thing",
			"details",
			"# 🔨 In progress",
			"## ★ Now thing",
			"# ✅ Done",
			"- achievement stays",
			"## Finished thing",
			"text",
			"# Notes",
		];
		const out = convertProject(lines, "Tracks");
		expect(out.sectionsRemoved).toBe(2);
		expect(out.tracksCreated).toBe(4);
		expect(out.lines).toEqual([
			"# Ideas",
			"- keep",
			"",
			"# Tracks",
			"",
			"## 📥 bullet idea",
			"",
			"## 📥 Later thing",
			"details",
			"",
			"## 🔨 Now thing",
			"",
			"## ✅ Finished thing",
			"text",
			"# ✅ Done",
			"- achievement stays",
			"# Notes",
		]);
	});

	it("keeps a marker other than the star and keeps the whole title", () => {
		const lines = ["# Ideas", "## 🗑️ Dropped one · F2", "x", "## Plain [[Link]]"];
		const out = convertProject(lines, "🧭 Tracks");
		expect(out.lines.filter((l) => l.startsWith("##"))).toEqual(["## 🗑️ Dropped one · F2", "## ★ Plain [[Link]]"]);
	});

	it("appends to an existing Tracks section, after its last non-blank line", () => {
		const lines = ["# Ideas", "## ★ Legacy", "body", "", "# 🧭 Pistes", "## 🔨 Existing", "- [ ] t", "", "# Notes"];
		const out = convertProject(lines, "🧭 Pistes");
		expect(out.lines).toEqual(["# Ideas", "", "# 🧭 Pistes", "## 🔨 Existing", "- [ ] t", "", "## ★ Legacy", "body", "", "# Notes"]);
		expect(out.tracksCreated).toBe(1);
		expect(out.sectionsRemoved).toBe(0);
	});

	it("creates the section at the end of the note when there is no Ideas section", () => {
		const lines = ["# 📥 Backlog", "- one", "# Notes", "text"];
		const out = convertProject(lines, "🧭 Pistes");
		expect(out.lines).toEqual(["# Notes", "text", "", "# 🧭 Pistes", "", "## 📥 one"]);
		expect(out.sectionsRemoved).toBe(1);
	});

	it("leaves a note with nothing to convert untouched", () => {
		for (const lines of [["# Title", "text"], ["# Ideas", "- a", "# 🧭 Pistes", "# Notes"], ["# Backlog", "- [ ] task", "# Tracks", "## 🔨 A"]]) {
			const out = convertProject(lines, "🧭 Tracks");
			expect(out.lines).toBe(lines);
			expect(out.tracksCreated).toBe(0);
			expect(out.sectionsRemoved).toBe(0);
		}
	});

	it("writes moved headings in canonical form, without indentation or a missing space", () => {
		const lines = ["# Ideas", " ## ★Context engine", "x", "  ## ⭐ Achievement Engine", "y", "## Plain", "# 🧭 Pistes"];
		const out = convertProject(lines, "🧭 Pistes");
		expect(out.lines.filter((l) => l.startsWith("##"))).toEqual(["## ★ Context engine", "## ★ Achievement Engine", "## ★ Plain"]);
		expect(out.tracksCreated).toBe(3);
	});

	it("removes empty Improvements, Backlog and In progress sections and creates Tracks even with no track to convert", () => {
		const lines = ["# Goal", "# 💡 Ideas", "- a", "", "# 🔨 En cours", "", "# ✨ Améliorations", "# 📥 Backlog", "- [-] cancelled", "", "# Notes"];
		const out = convertProject(lines, "🧭 Pistes");
		expect(out).toEqual({
			lines: ["# Goal", "# 💡 Ideas", "- a", "", "# 🧭 Pistes", "", "# 📥 Backlog", "- [-] cancelled", "", "# Notes"],
			tracksCreated: 0,
			sectionsRemoved: 2,
		});
	});

	it("converts a sub-heading whose title says track or piste", () => {
		const lines = ["# Ideas", "- a", "## ★ Piste ancienne", "text", "## ⭐ Track record", "# Notes"];
		const out = convertProject(lines, "🧭 Pistes");
		expect(out.tracksCreated).toBe(2);
		expect(readProject(out.lines).tracks.map((t) => t.title)).toEqual(["Piste ancienne", "Track record"]);
	});

	it("ignores headings and bullets in code fences", () => {
		const lines = ["# Backlog", "```", "- not an item", "## not a heading", "```", "# Notes"];
		expect(convertProject(lines, "Tracks").tracksCreated).toBe(0);
	});

	it("keeps CRLF notes intact when joined back", () => {
		const text = "# Ideas\r\n- keep\r\n\r\n# Backlog\r\n- later\r\n";
		const out = convertProject(text.split(/\r?\n/), "🧭 Tracks");
		expect(out.lines.join("\r\n")).toBe("# Ideas\r\n- keep\r\n\r\n# 🧭 Tracks\r\n\r\n## 📥 later\r\n");
	});
});

describe("diffEdit", () => {
	it("returns the smallest splice between two versions", () => {
		const before = ["a", "b", "c", "d"];
		const after = ["a", "x", "y", "d"];
		const edit = diffEdit(before, after);
		expect(edit).toEqual({ at: 1, remove: 2, lines: ["x", "y"] });
		if (edit) expect(applyEdits(before, [edit])).toEqual(after);
	});

	it("handles insertions, removals and equal notes", () => {
		expect(diffEdit(["a"], ["a"])).toBeNull();
		expect(diffEdit(["a", "b"], ["a", "b", "c"])).toEqual({ at: 2, remove: 0, lines: ["c"] });
		expect(diffEdit(["a", "b", "c"], ["a", "c"])).toEqual({ at: 1, remove: 1, lines: [] });
	});

	it("rebuilds a converted legacy note exactly", () => {
		const out = convertProject(LEGACY, "🧭 Pistes");
		const edit = diffEdit(LEGACY, out.lines);
		expect(edit && applyEdits(LEGACY, [edit])).toEqual(out.lines);
	});
});
