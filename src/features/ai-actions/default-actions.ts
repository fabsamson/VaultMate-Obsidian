// The action files VaultMate offers to create. Written once, never overwritten.
import { normalizePath, type App } from "obsidian";

import { CHALLENGE_ACTION, CHALLENGE_FILE_NAME } from "./challenge-action";
import { RECOMMEND_ACTION, RECOMMEND_FILE_NAME } from "./recommend-action";

const DEFAULT_ACTIONS = [
	{ fileName: CHALLENGE_FILE_NAME, content: CHALLENGE_ACTION },
	{ fileName: RECOMMEND_FILE_NAME, content: RECOMMEND_ACTION },
];

/** Creates the folder and the default action files that are missing. Returns the paths it created. */
export async function createDefaultActions(app: App, folder: string): Promise<string[]> {
	const root = normalizePath(folder);
	if (!app.vault.getFolderByPath(root)) await app.vault.createFolder(root);
	const created: string[] = [];
	for (const { fileName, content } of DEFAULT_ACTIONS) {
		const path = normalizePath(`${root}/${fileName}`);
		if (app.vault.getFileByPath(path)) continue;
		await app.vault.create(path, content);
		created.push(path);
	}
	return created;
}
