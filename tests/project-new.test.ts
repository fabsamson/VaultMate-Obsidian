import { describe, expect, it } from "vitest";

import { normalizeSettings, DEFAULT_SETTINGS } from "../src/core/settings-model";
import { buildIdeaItem, titleFromIdea, type IdeaItem } from "../src/features/ideas/idea-line";
import { closeParts } from "../src/features/ideas/idea-note";
import { itemStatement, seedItems } from "../src/features/ideas/ideas-model";
import { isProjectTemplate, newProjectPath, newProjectState, projectSkeleton, renderProjectNote } from "../src/features/projects/project-new";
import { readProject } from "../src/features/projects/project-note";
import { hasProjectTag } from "../src/features/projects/project-tag";

function frontmatterOf(note: string): Record<string, unknown> {
	const tags = /^tags: \[(.*)\]$/m.exec(note)?.[1] ?? "";
	return { tags: tags.split(",").map((tag) => tag.trim()) };
}

describe("projectSkeleton", () => {
	it("holds the project tag in tags, then the Ideas and Notes sections", () => {
		expect(projectSkeleton("project")).toBe("---\ntags: [project]\n---\n# 💡 Ideas\n# 📝 Notes\n");
	});

	it("is a project and an empty Ideas section for the reader", () => {
		const note = projectSkeleton("projet");
		expect(hasProjectTag(frontmatterOf(note), "projet")).toBe(true);
		const model = readProject(note.split("\n"));
		expect(model.ideasSection).not.toBeNull();
		expect(model.tracks).toEqual([]);
	});
});

describe("renderProjectNote", () => {
	const values = { tag: "project", title: "Kitchen", date: "2026-10-21" };

	it("uses the skeleton without a template", () => {
		expect(renderProjectNote(null, values)).toBe(projectSkeleton("project"));
	});

	it("fills {{title}} and {{date}} of a template and adds no section", () => {
		const template = "---\ntags: [project]\ncreated: {{date}}\n---\n# {{title}}\n\n## Goal\n";
		expect(renderProjectNote(template, values)).toBe("---\ntags: [project]\ncreated: 2026-10-21\n---\n# Kitchen\n\n## Goal\n");
	});

	it("leaves the other placeholders as written", () => {
		expect(renderProjectNote("{{idea}} {{source}} {{other}} <% tp.date %>", values)).toBe("{{idea}} {{source}} {{other}} <% tp.date %>");
	});
});

describe("newProjectPath", () => {
	it("puts the note in the folder, or at the vault root", () => {
		expect(newProjectPath("Kitchen", "Projects")).toBe("Projects/Kitchen.md");
		expect(newProjectPath("Kitchen", "")).toBe("Kitchen.md");
	});

	it("sanitizes the name like a new note from an idea", () => {
		expect(newProjectPath(' Kitchen: "v2"? #1 ', "Projects")).toBe("Projects/Kitchen v2 1.md");
		expect(newProjectPath("Kitchen.md", "")).toBe("Kitchen.md");
	});

	it("takes a name with a slash as a vault path and refuses an empty name", () => {
		expect(newProjectPath("Work/Kitchen", "Projects")).toBe("Work/Kitchen.md");
		expect(newProjectPath("  ", "Projects")).toBeNull();
		expect(newProjectPath("../..", "Projects")).toBeNull();
	});
});

describe("isProjectTemplate", () => {
	it("matches the template note with or without .md, and nothing when none is set", () => {
		expect(isProjectTemplate("Templates/Project.md", "Templates/Project.md")).toBe(true);
		expect(isProjectTemplate("Templates/Project.md", "Templates/Project")).toBe(true);
		expect(isProjectTemplate("Projects/Kitchen.md", "Templates/Project.md")).toBe(false);
		expect(isProjectTemplate("Projects/Kitchen.md", "")).toBe(false);
		expect(isProjectTemplate(".md", "")).toBe(false);
	});
});

describe("newProjectState", () => {
	it("needs a name", () => {
		expect(newProjectState(null, false)).toMatchObject({ disabled: true });
	});

	it("says where the note goes", () => {
		expect(newProjectState("Projects/Kitchen.md", false)).toEqual({ label: "Create project", disabled: false, hint: "In Projects" });
		expect(newProjectState("Kitchen.md", false).hint).toBe("In the vault root");
	});

	it("opens an existing note instead of overwriting it", () => {
		expect(newProjectState("Projects/Kitchen.md", true)).toEqual({ label: "Open Kitchen", disabled: false, hint: "This note exists. It will be opened, not changed." });
	});
});

describe("project settings", () => {
	it("default to the vault root and the skeleton", () => {
		expect(DEFAULT_SETTINGS.projects).toMatchObject({ newProjectFolder: "", newProjectTemplate: "" });
	});

	it("are cleaned like the ideas ones and fall back on a wrong type", () => {
		expect(normalizeSettings({ projects: { newProjectFolder: " /Work//Projects/ ", newProjectTemplate: "/Templates//Project.md" } }).projects).toMatchObject({
			newProjectFolder: "Work/Projects",
			newProjectTemplate: "Templates/Project.md",
		});
		expect(normalizeSettings({ projects: { newProjectFolder: 3, newProjectTemplate: false } }).projects).toMatchObject({ newProjectFolder: "", newProjectTemplate: "" });
	});
});

describe("launching a project seed", () => {
	const seed = (line: string, date = "2026-10-12"): IdeaItem => {
		const found = buildIdeaItem("Daily/Log.md", "Log", date, 0, [line], "idea");
		if (!found) throw new Error("not an idea");
		return found;
	};

	it("lists the open seeds, the oldest first, and leaves the other ideas", () => {
		const filter = { tag: "idea", subtag: "projet" };
		const items = [seed("- [ ] Newer #idea/projet ➕ 2026-10-14"), seed("- [ ] Plain #idea ➕ 2026-10-01"), seed("- [ ] Older #idea/projet ➕ 2026-10-02"), seed("- [x] Done #idea/projet [result: dropped] ➕ 2026-10-01 ✅ 2026-10-03")];
		expect(seedItems(items, filter).map(itemStatement)).toEqual(["Older", "Newer"]);
		expect(seedItems(items, { tag: "idea", subtag: "" })).toEqual([]);
	});

	it("prefills New project with the short name of the seed", () => {
		expect(titleFromIdea(itemStatement(seed("- [ ] Kitchen: a sprint? #idea/projet ➕ 2026-10-12")))).toBe("Kitchen a sprint");
	});

	it("closes the seed like a new note, keeping its tag", () => {
		const item = seed("- [ ] Kitchen sprint #idea/projet ➕ 2026-10-12");
		expect(closeParts(item, "idea", "new-note", "2026-10-21", "Kitchen", "")).toEqual({
			line: "- [x] Kitchen sprint #idea/projet [result: new-note] ➕ 2026-10-12 ✅ 2026-10-21",
			subItem: "New note: [[Kitchen]]",
		});
	});
});
