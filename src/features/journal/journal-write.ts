// Writing a rewritten entry back into its note, through the write gateway (`core/note-write`). It first
// checks that the line is still the one that was read, and refuses otherwise.
import { Notice, type App } from "obsidian";

import { writeNote } from "../../core/note-write";
import { planRewrite, type AppendedLines } from "./journal-note";

/** Where an entry line was read: the line must still have exactly the text `raw`. */
export interface LineTarget {
	path: string;
	line: number;
	raw: string;
}

export const CHANGED = "This line changed since VaultMate read it. Open the note and try again.";

/**
 * Replaces the target line by `newLine` and adds the sub-item, then the `appended` lines, after the item's last
 * sub-item. Returns whether it wrote. When the line changed, a notice says `refusal` (none when null: the
 * caller says it in its own words).
 */
export async function writeEntryLine(
	app: App,
	target: LineTarget,
	newLine: string,
	subItem: string | null,
	appended?: AppendedLines,
	refusal: string | null = CHANGED,
): Promise<boolean> {
	const result = await writeNote(app, target.path, (lines) => {
		const plan = planRewrite(lines, target.line, target.raw, newLine, subItem, appended);
		return plan.ok ? { ok: true, edits: [{ at: plan.from, remove: plan.to - plan.from + 1, lines: plan.replacement }] } : { ok: false, reason: null };
	});
	if (result.status === "missing") new Notice("VaultMate could not find this note.");
	else if (result.status === "refused" && refusal !== null) new Notice(refusal);
	return result.status === "written";
}
