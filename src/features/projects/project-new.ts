// What New project writes: the built-in skeleton or the user's template, the path of the note, and the
// state of the form. Pure: no runtime Obsidian import, so Vitest tests it.
import { baseName } from "../context/note-meta";
import { newNotePath, renderNewNote } from "../ideas/idea-note";

/** The built-in skeleton: the project tag in `tags`, then the Ideas and Notes sections. */
export function projectSkeleton(tag: string): string {
	return `---\ntags: [${tag}]\n---\n# \u{1F4A1} Ideas\n# \u{1F4DD} Notes\n`;
}

/**
 * The content of a new project note: the template with `{{title}}` and `{{date}}` filled, else the
 * skeleton. Any other `{{…}}` stays as written. The template is not given the project tag here: the
 * caller adds it to the `tags` property of the created note.
 */
export function renderProjectNote(template: string | null, values: { tag: string; title: string; date: string }): string {
	if (template === null) return projectSkeleton(values.tag);
	return renderNewNote(template, { title: values.title, date: values.date, idea: "{{idea}}", source: "{{source}}" });
}

/** The vault path of a new project from the typed name, or null when the name is empty (see `newNotePath`). */
export function newProjectPath(name: string, folderSetting: string): string | null {
	return newNotePath(name, folderSetting, "");
}

/** Whether `path` is the template note of the settings (a note path, with or without `.md`). */
export function isProjectTemplate(path: string, templateSetting: string): boolean {
	return templateSetting !== "" && (path === templateSetting || path === `${templateSetting}.md`);
}

export interface NewProjectState {
	label: string;
	disabled: boolean;
	hint: string;
}

/** The button and the hint of the form: an existing note is never overwritten, it is opened instead. */
export function newProjectState(path: string | null, exists: boolean): NewProjectState {
	if (path === null) return { label: "Create project", disabled: true, hint: "" };
	if (exists) return { label: `Open ${baseName(path)}`, disabled: false, hint: "This note exists. It will be opened, not changed." };
	const folder = path.slice(0, Math.max(0, path.lastIndexOf("/")));
	return { label: "Create project", disabled: false, hint: `In ${folder === "" ? "the vault root" : folder}` };
}
