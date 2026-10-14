import { describe, expect, it } from "vitest";

import { isTracksHeading, openTasks, parseTrackHeading, readProject, sectionKind, trackCounts, withMarker } from "../src/features/projects/project-note";

const FR = [
	"---",
	"statut: Active",
	"---",
	"# 🎯 Objectif",
	"Une phrase.",
	"",
	"# 💡 Idées",
	"- une idée brute",
	"    - un détail",
	"    - un autre détail",
	"- [ ] une tâche, pas une idée",
	"Une ligne de prose",
	"* deuxième idée",
	"1. troisième idée",
	"+ quatrième idée",
	"```",
	"- dans un bloc de code",
	"```",
	"",
	"# 🧭 Pistes",
	"## ★ Achievement Engine",
	"Contenu libre.",
	"### Détail",
	"- [ ] tâche profonde",
	"    - [x] tâche imbriquée faite",
	"",
	"## 📥 Goal Momentum",
	"## 🔨 Decision Journal · F1",
	"- [ ] Écrire le parseur #tag ➕ 2026-10-14 📅 2026-10-18",
	"- [-] annulée",
	"## ✅ Context finder · F3",
	"## 🗑️ Promotion sur Reddit",
	"## ⭐ Étoile emoji",
	"## Sans marqueur",
	"## 🗑 Corbeille sans sélecteur",
	"# ✅ Déjà réalisé",
	"- une réussite",
	"# 📝 Notes",
];

describe("section recognition", () => {
	it("recognizes French and English headings, ignoring case and accents", () => {
		expect(sectionKind("💡 Idées à explorer")).toBe("ideas");
		expect(sectionKind("IDEES")).toBe("ideas");
		expect(sectionKind("Ideas")).toBe("ideas");
		expect(sectionKind("🧭 Pistes")).toBe("tracks");
		expect(sectionKind("Track list")).toBe("tracks");
		expect(sectionKind("Pistes de travail")).toBe("tracks");
		expect(sectionKind("🧭")).toBe("tracks");
		expect(sectionKind("Déjà réalisé")).toBe("done");
		expect(sectionKind("Achievements")).toBe("done");
		expect(sectionKind("✨ Améliorations possibles")).toBe("improve");
		expect(sectionKind("📥 Backlog")).toBe("backlog");
		expect(sectionKind("🔨 En cours")).toBe("doing");
		expect(sectionKind("🎯 Objectif")).toBeNull();
		expect(sectionKind("Soundtrack")).toBeNull();
		expect(isTracksHeading("🧭 Tracks")).toBe(true);
		expect(isTracksHeading("Notes")).toBe(false);
	});
});

describe("track headings", () => {
	it("reads the status from the marker and keeps the title untouched", () => {
		expect(parseTrackHeading("★ Achievement Engine")).toEqual({ status: "explore", marker: "★", title: "Achievement Engine" });
		expect(parseTrackHeading("⭐ X").status).toBe("explore");
		expect(parseTrackHeading("⭐️ X")).toMatchObject({ status: "explore", title: "X" });
		expect(parseTrackHeading("📥 B").status).toBe("backlog");
		expect(parseTrackHeading("🔨 Decision Journal · F1")).toMatchObject({ status: "progress", title: "Decision Journal · F1" });
		expect(parseTrackHeading("✅ [[Context finder]] #3").title).toBe("[[Context finder]] #3");
		expect(parseTrackHeading("🗑️ Gone").status).toBe("dropped");
		expect(parseTrackHeading("🗑 Gone").status).toBe("dropped");
		expect(parseTrackHeading("Plain title")).toEqual({ status: "explore", marker: null, title: "Plain title" });
		expect(parseTrackHeading("★Context engine")).toEqual({ status: "explore", marker: "★", title: "Context engine" });
		expect(parseTrackHeading("✅Glued")).toMatchObject({ status: "done", title: "Glued" });
	});
});

describe("withMarker", () => {
	it("replaces the marker in place, keeping the gap and the rest", () => {
		expect(withMarker("## ★ Achievement Engine", "progress")).toBe("## 🔨 Achievement Engine");
		expect(withMarker("## ⭐  Two spaces", "done")).toBe("## ✅  Two spaces");
		expect(withMarker("### 🔨 Decision Journal · F1 ", "dropped")).toBe("### 🗑️ Decision Journal · F1 ");
		expect(withMarker("## 🗑 Old", "backlog")).toBe("## 📥 Old");
	});

	it("adds the marker when missing and writes U+FE0F for the wastebasket", () => {
		expect(withMarker("## Plain", "backlog")).toBe("## 📥 Plain");
		expect(withMarker("## Plain", "dropped")).toBe("## 🗑️ Plain");
		expect(withMarker("##", "done")).toBeNull();
	});

	it("keeps an indentation of up to three spaces and adds the missing space after the marker", () => {
		expect(withMarker(" ## ★Achievement Engine", "progress")).toBe(" ## 🔨 Achievement Engine");
		expect(withMarker("## ★Context engine", "explore")).toBe("## ★ Context engine");
		expect(withMarker("   ### Plain", "done")).toBe("   ### ✅ Plain");
	});

	it("returns null when the marker is already the written one", () => {
		expect(withMarker("## ★ X", "explore")).toBeNull();
		expect(withMarker("## 🗑️ X", "dropped")).toBeNull();
		expect(withMarker("not a heading", "done")).toBeNull();
	});
});

describe("readProject", () => {
	const model = readProject(FR);

	it("finds the sections at the level of the Tracks section", () => {
		expect(model.level).toBe(1);
		expect(model.ideasSection).toMatchObject({ line: 6, level: 1, end: 19 });
		expect(model.tracksSection).toMatchObject({ line: 19, end: 35 });
		expect(model.doneSection).toMatchObject({ line: 35, end: 37 });
	});

	it("reads the ideas: top-level list items that are not tasks, with their children", () => {
		expect(model.ideas.map((idea) => idea.text)).toEqual(["une idée brute", "deuxième idée", "troisième idée", "quatrième idée"]);
		const first = model.ideas[0];
		expect(first).toMatchObject({ line: 7, raw: "- une idée brute", end: 10, children: ["    - un détail", "    - un autre détail"] });
	});

	it("reads the tracks with status, title, block and tasks", () => {
		expect(model.tracks.map((track) => [track.status, track.title])).toEqual([
			["explore", "Achievement Engine"],
			["backlog", "Goal Momentum"],
			["progress", "Decision Journal · F1"],
			["done", "Context finder · F3"],
			["dropped", "Promotion sur Reddit"],
			["explore", "Étoile emoji"],
			["explore", "Sans marqueur"],
			["dropped", "Corbeille sans sélecteur"],
		]);
		const [engine, , journal] = model.tracks;
		expect(engine).toMatchObject({ line: 20, raw: "## ★ Achievement Engine", level: 2, end: 26 });
		expect(journal).toMatchObject({ line: 27, end: 30 });
	});

	it("keeps deeper headings in the block and reads tasks at any depth", () => {
		const [engine, , journal] = model.tracks;
		expect(engine?.tasks.map((task) => [task.text, task.state])).toEqual([
			["tâche profonde", "open"],
			["tâche imbriquée faite", "done"],
		]);
		expect(journal?.tasks).toMatchObject([
			{ line: 28, text: "Écrire le parseur", state: "open", due: "2026-10-18" },
			{ line: 29, text: "annulée", state: "cancelled", due: null },
		]);
		expect(openTasks(journal)).toHaveLength(1);
	});

	it("counts the tracks per status", () => {
		expect(trackCounts(model.tracks)).toEqual({ explore: 3, backlog: 1, progress: 1, done: 1, dropped: 2 });
	});
});

describe("readProject variants", () => {
	it("reads an English note with CRLF-split lines, sections at level 2 and tracks at level 3", () => {
		const text = ["# Project", "## Ideas", "- a", "## Tracks", "### 🔨 Build", "- [ ] t", "### Plain", "## Achievements", "- done"].join("\r\n");
		const model = readProject(text.split(/\r?\n/));
		expect(model.level).toBe(2);
		expect(model.ideas.map((i) => i.raw)).toEqual(["- a"]);
		expect(model.tracks.map((t) => [t.status, t.title, t.level])).toEqual([
			["progress", "Build", 3],
			["explore", "Plain", 3],
		]);
		expect(model.doneSection?.line).toBe(7);
	});

	it("has no Tracks section and no tracks when the note has none", () => {
		const model = readProject(["# Ideas", "- a", "# Done", "- b"]);
		expect(model.tracksSection).toBeNull();
		expect(model.tracks).toEqual([]);
		expect(model.ideas).toHaveLength(1);
		expect(model.level).toBe(1);
	});

	it("ignores headings in code fences and sub-headings of other levels in the Tracks section", () => {
		const model = readProject(["# Tracks", "```", "## 🔨 fake", "```", "#### too deep", "## real", "", "# Notes"]);
		expect(model.tracks.map((t) => t.title)).toEqual(["real"]);
	});

	it("reads tracks whose marker has no space and whose heading is indented", () => {
		const model = readProject(["# Tracks", "## ★Context engine", " ## 🔨Achievement Engine", "   ## Plain", "    ## four spaces is code"]);
		expect(model.tracks.map((t) => [t.status, t.title])).toEqual([
			["explore", "Context engine"],
			["progress", "Achievement Engine"],
			["explore", "Plain"],
		]);
	});

	it("returns nothing for a note without recognized sections", () => {
		const model = readProject(["# Title", "text"]);
		expect(model.level).toBeNull();
		expect(model.sections).toEqual([]);
		expect(model.tracks).toEqual([]);
	});

	it("takes the level that holds most sections when there is no Tracks section", () => {
		const model = readProject(["# Idea Engine", "## Ideas", "- a", "## Done", "- b"]);
		expect(model.level).toBe(2);
		expect(model.ideas).toHaveLength(1);
	});
});
