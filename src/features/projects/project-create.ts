// Creating a project note: the template of the settings (else the built-in skeleton) written to
// `<folder>/<name>.md`, with the project tag in its `tags` property.
import { normalizePath, Notice, type App, type TFile } from "obsidian";

import { formatDate, startOfDay } from "../../core/dates";
import type { VaultMateSettings } from "../../core/settings-model";
import { baseName } from "../context/note-meta";
import { createFolders } from "../ideas/idea-write";
import { hasProjectTag, withProjectTag } from "./project-tag";
import { renderProjectNote } from "./project-new";

/** The template's text, or null (the skeleton) when none is set or it cannot be found (with a notice in that case). */
async function readTemplate(app: App, setting: string): Promise<string | null> {
	if (setting === "") return null;
	const path = normalizePath(setting);
	const file = app.vault.getFileByPath(path) ?? app.vault.getFileByPath(`${path}.md`);
	if (file) return app.vault.read(file);
	new Notice(`VaultMate could not find the template ${path}. Using the built-in skeleton.`);
	return null;
}

/**
 * Creates the project note at `path` (a free path: the caller checked) and returns it, or null after a
 * notice when it could not be created. A template note gets the project tag added to its `tags`.
 */
export async function createProjectNote(app: App, settings: Pick<VaultMateSettings, "projects">, path: string): Promise<TFile | null> {
	const { tag, newProjectTemplate } = settings.projects;
	const notePath = normalizePath(path);
	const template = await readTemplate(app, newProjectTemplate);
	const content = renderProjectNote(template, { tag, title: baseName(notePath), date: formatDate(startOfDay()) });
	let file: TFile;
	try {
		await createFolders(app, notePath);
		file = await app.vault.create(notePath, content);
	} catch (error) {
		console.error("VaultMate could not create the project", error);
		new Notice("VaultMate could not create the project.");
		return null;
	}
	if (template !== null) {
		try {
			await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
				if (!hasProjectTag(frontmatter, tag)) frontmatter.tags = withProjectTag(frontmatter, tag);
			});
		} catch {
			new Notice(`VaultMate could not add #${tag} to the tags of ${file.basename}.`);
		}
	}
	return file;
}
