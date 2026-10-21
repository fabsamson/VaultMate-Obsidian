import { describe, expect, it } from "vitest";

import { seedLine } from "../src/features/ideas/ideas-model";
import { addState, findProject, hasPanel, newNoteState, noteLinkLabel, portalActions, seedSentence, tendSummary, trackState } from "../src/features/ideas/portal-actions";

const ALL = { tend: true, projectsEnabled: true, seedSubtag: "projet" };

describe("portal actions", () => {
	it("is one row in a fixed order, with Skip last in Tend mode", () => {
		expect(portalActions(ALL)).toEqual(["new-note", "track", "drop", "add", "decision", "prediction", "seed", "skip"]);
		expect(portalActions({ ...ALL, tend: false })).toEqual(["new-note", "track", "drop", "add", "decision", "prediction", "seed"]);
	});
	it("hides Skip outside Tend mode, New track without Projects and Project seed without its setting", () => {
		expect(portalActions({ ...ALL, tend: false })).not.toContain("skip");
		expect(portalActions({ ...ALL, projectsEnabled: false })).not.toContain("track");
		expect(portalActions({ ...ALL, seedSubtag: "" })).not.toContain("seed");
		expect(portalActions({ tend: false, projectsEnabled: false, seedSubtag: "" })).toEqual(["new-note", "drop", "add", "decision", "prediction"]);
	});
	it("shows a panel for five actions only, and the optional note for three", () => {
		expect(portalActions(ALL).filter(hasPanel).sort()).toEqual(["add", "drop", "new-note", "seed", "track"]);
		expect(noteLinkLabel("add")).toBe("Add a note");
		expect(noteLinkLabel("new-note")).toBe("Add a note");
		expect(noteLinkLabel("drop")).toBe("Add a reason");
		expect(noteLinkLabel("track")).toBeNull();
		expect(noteLinkLabel("seed")).toBeNull();
	});
});

describe("panel states", () => {
	it("Add to a note: needs an existing note other than the idea's own", () => {
		expect(addState("", null)).toEqual({ label: "Add to a note", disabled: true, hint: "" });
		expect(addState("Nope", null)).toEqual({ label: "Add to a note", disabled: true, hint: "No note with this name: use New note" });
		expect(addState("Sprint", { basename: "Sprint", own: false })).toEqual({ label: "Add to Sprint", disabled: false, hint: "" });
		expect(addState("Here", { basename: "Here", own: true })).toMatchObject({ disabled: true });
	});
	it("New note: names what will be created, or says the note exists", () => {
		expect(newNoteState(null, false)).toEqual({ label: "Create note", disabled: true, hint: "" });
		expect(newNoteState("Ideas/Sprint.md", false)).toEqual({ label: 'Create "Sprint"', disabled: false, hint: "In Ideas" });
		expect(newNoteState("Sprint.md", false).hint).toBe("In the vault root");
		expect(newNoteState("Sprint.md", true)).toMatchObject({ label: 'Create "Sprint"', disabled: false, hint: "This note exists: the idea will be added to it" });
	});
	it("Project seed: the sentence names the tag", () => {
		expect(seedSentence("idea", "projet")).toBe("Moves it to the launch pad as #idea/projet.");
	});
});

describe("New track", () => {
	const projects = [{ path: "Projects/App.md", name: "App" }, { path: "Plan.md", name: "Plan" }];
	it("finds a project by name or path, ignoring case", () => {
		expect(findProject(projects, "app")?.path).toBe("Projects/App.md");
		expect(findProject(projects, "Projects/App")?.name).toBe("App");
		expect(findProject(projects, "plan.md")?.name).toBe("Plan");
		expect(findProject(projects, "other")).toBeNull();
		expect(findProject(projects, "  ")).toBeNull();
	});
	it("needs a project and a usable name, and only warns about a repeated name", () => {
		const app = projects[0] ?? null;
		expect(trackState(null, "Brief", "explore", [])).toMatchObject({ disabled: true, label: "Add track", hint: "Pick a project note" });
		expect(trackState(app, " [[]] # ", "explore", [])).toMatchObject({ disabled: true, name: "" });
		expect(trackState(app, "Brief du soir", "explore", ["Other"])).toEqual({ label: "Add track to App", disabled: false, hint: "", name: "Brief du soir", duplicate: false, showTask: false });
		expect(trackState(app, "brief du soir", "explore", ["Brief du soir"])).toMatchObject({ disabled: false, duplicate: true });
	});
	it("asks for a first task only In progress", () => {
		expect(trackState(null, "x", "progress", []).showTask).toBe(true);
		expect(trackState(null, "x", "backlog", []).showTask).toBe(false);
	});
});

describe("seedLine", () => {
	it("says how many seeds wait, or nothing", () => {
		expect(seedLine(0)).toBeNull();
		expect(seedLine(1)).toBe("1 project seed waiting");
		expect(seedLine(3)).toBe("3 project seeds waiting");
	});
});

describe("tend summary", () => {
	it("keeps the plain sentence when every idea was sorted", () => {
		expect(tendSummary(4, 4)).toBe("All fresh ideas tended.");
	});
	it("counts the sorted and skipped ideas", () => {
		expect(tendSummary(2, 6)).toBe("2 ideas sorted, 4 skipped: they stay fresh.");
		expect(tendSummary(1, 2)).toBe("1 idea sorted, 1 skipped: they stay fresh.");
	});
	it("says so when none was sorted", () => {
		expect(tendSummary(0, 4)).toBe("No idea sorted: 4 skipped, they stay fresh.");
	});
});
