// Applying a project write plan to a note, through the write gateway (`core/note-write`). The plan itself
// checks that the targeted line still has the expected text.
import { Notice, type App } from "obsidian";

import { writeNote } from "../../core/note-write";
import { refusalMessage, type WritePlan } from "./project-write";

/**
 * Plans a write from the note's current lines and applies it. A refusal shows a notice and writes nothing.
 * Returns whether the plan was applied (an empty plan counts: there was nothing to change).
 */
export async function writeProject(app: App, path: string, plan: (lines: string[]) => WritePlan): Promise<boolean> {
	const result = await writeNote(app, path, plan);
	if (result.status === "missing") new Notice("VaultMate could not find this note.");
	else if (result.status === "refused") new Notice(refusalMessage(result.reason));
	return result.status === "written";
}
