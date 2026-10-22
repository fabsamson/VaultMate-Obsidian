// "New action": creates the template in the actions folder and opens it.
import { Notice, normalizePath, type App } from "obsidian";

import { freeActionPath, NEW_ACTION } from "./action-template";

/** Creates the template in the actions folder (and the folder, if missing) and opens it in a new tab. Never overwrites. */
export async function createNewAction(app: App, folder: string): Promise<void> {
	try {
		const root = normalizePath(folder);
		if (!app.vault.getFolderByPath(root)) await app.vault.createFolder(root);
		const path = freeActionPath(root, (candidate) => app.vault.getAbstractFileByPath(candidate) !== null);
		const file = await app.vault.create(path, NEW_ACTION);
		new Notice(`Created ${path}`);
		await app.workspace.getLeaf("tab").openFile(file);
	} catch (error) {
		new Notice(`Unable to create the action: ${error instanceof Error ? error.message : String(error)}`);
	}
}
