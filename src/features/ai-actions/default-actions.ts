// The action files VaultMate offers to create. Written once, never overwritten.
import { normalizePath, type App } from "obsidian";

import { CHALLENGE_ACTION, CHALLENGE_FILE_NAME } from "./challenge-action";

/** Creates the folder and the default action files that are missing. Returns the paths it created. */
export async function createDefaultActions(app: App, folder: string): Promise<string[]> {
	const root = normalizePath(folder);
	if (!app.vault.getFolderByPath(root)) await app.vault.createFolder(root);
	const path = normalizePath(`${root}/${CHALLENGE_FILE_NAME}`);
	if (app.vault.getFileByPath(path)) return [];
	await app.vault.create(path, CHALLENGE_ACTION);
	return [path];
}
