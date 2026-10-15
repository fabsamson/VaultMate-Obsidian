import { describe, expect, it } from "vitest";

import { openTasks, readProject, type ProjectTags } from "../src/features/projects/project-note";

const TAGS: ProjectTags = { idea: "idea", decision: "decision", prediction: "prediction", seed: "projet" };

const NOTE = [
	"---",
	"tags:",
	"  - projet",
	"---",
	"# 💡 Idées",
	"- bullet idea",
	"    - its detail",
	"- bullet with tag #idea",
	"- [ ] task in the box #idea ➕ 2026-10-10",
	"    - detail of the task",
	"- [x] closed one #idea [result: dropped] ✅ 2026-10-11",
	"- [-] cancelled one #idea",
	"- [ ] a seed #idea/projet ➕ 2026-10-10",
	"- [ ] a plain task",
	"# 🧭 Pistes",
	"## 🔨 Track A",
	"- [ ] real work",
	"- [ ] an idea in the track #idea ➕ 2026-10-12",
	"- [ ] a decision #decision [confidence: 70%]",
	"- [ ] a prediction #Prediction/work [confidence: 60%]",
	"- [ ] a question #question",
	"- [ ] sub-tagged #idea/work",
	"- [x] done work",
	"# 📝 Notes",
	"Loose idea #idea",
	"> - [ ] quoted idea #idea",
	"```md",
	"- [ ] in code #idea",
	"```",
	"Idea: not tagged, not seen",
];

describe("readProject with tags: the ideas of the note", () => {
	const model = readProject(NOTE, TAGS);

	it("lists bullets and open tagged ideas wherever they are, in note order", () => {
		expect(model.ideas.map((idea) => [idea.kind, idea.line, idea.text])).toEqual([
			["bullet", 5, "bullet idea"],
			["tagged", 7, "bullet with tag"],
			["tagged", 8, "task in the box"],
			["tagged", 17, "an idea in the track"],
			["tagged", 21, "sub-tagged"],
			["tagged", 24, "Loose idea"],
			["tagged", 25, "quoted idea"],
		]);
	});

	it("counts a 💡 bullet that carries the tag once, as a tagged idea", () => {
		expect(model.ideas.filter((idea) => idea.raw.includes("bullet with tag"))).toHaveLength(1);
	});

	it("leaves out closed, cancelled, seeds and code", () => {
		const raws = model.ideas.map((idea) => idea.raw).join("\n");
		for (const gone of ["closed one", "cancelled one", "a seed", "in code", "a plain task"]) expect(raws).not.toContain(gone);
	});

	it("gives each idea its more-indented lines", () => {
		const task = model.ideas.find((idea) => idea.line === 8);
		expect(task?.children).toEqual(["    - detail of the task"]);
		expect(task?.end).toBe(10);
		expect(model.ideas[0]?.children).toEqual(["    - its detail"]);
	});

	it("keeps the old behavior without tags", () => {
		const plain = readProject(NOTE);
		expect(plain.ideas.map((idea) => idea.kind)).toEqual(["bullet", "bullet"]);
		expect(plain.ideas.map((idea) => idea.line)).toEqual([5, 7]);
	});

	it("sees seeds as ideas when the seed sub-tag is empty", () => {
		const seeds = readProject(NOTE, { ...TAGS, seed: "" }).ideas.filter((idea) => idea.raw.includes("a seed"));
		expect(seeds).toHaveLength(1);
	});

	it("does not list the tagged lines inside the children of another idea twice", () => {
		const lines = ["# Ideas", "- [ ] parent #idea", "    - [ ] child #idea", "# Tracks"];
		expect(readProject(lines, TAGS).ideas.map((idea) => idea.line)).toEqual([1]);
	});
});

describe("a track's tasks", () => {
	it("leave out the idea, decision, prediction and question lines, sub-tags included", () => {
		const track = readProject(NOTE, TAGS).tracks[0];
		expect(track?.tasks.map((task) => task.text)).toEqual(["real work", "done work"]);
		expect(track ? openTasks(track).map((task) => task.text) : []).toEqual(["real work"]);
	});

	it("leave out questions even when the tags are not known", () => {
		const track = readProject(NOTE).tracks[0];
		expect(track?.tasks.map((task) => task.text)).toEqual(["real work", "an idea in the track", "a decision", "a prediction", "sub-tagged", "done work"]);
	});

	it("follow the configured tags", () => {
		const track = readProject(NOTE, { idea: "seed", decision: "choix", prediction: "pari", seed: "" }).tracks[0];
		expect(track?.tasks.map((task) => task.text)).toContain("a decision");
		expect(track?.tasks.map((task) => task.text)).not.toContain("a question");
	});
});
