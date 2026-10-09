// Which notes the journal page covers: the whole vault, one note, or a folder note with its sub-notes.
// Pure (paths in, paths out): no Obsidian import, so Vitest tests it.

export const SCOPES = ["vault", "note", "tree"] as const;
export type JournalScope = (typeof SCOPES)[number];

/**
 * The folder a folder note stands for, or null when `notePath` is not a folder note. A folder note is
 * `…/X/X.md` (inside the folder) or `…/X.md` next to a folder `X` that holds notes. `markdownPaths`
 * lists every Markdown note of the vault.
 */
export function folderNoteFolder(notePath: string, markdownPaths: readonly string[]): string | null {
	if (!/\.md$/i.test(notePath)) return null;
	const slash = notePath.lastIndexOf("/");
	const parent = slash < 0 ? "" : notePath.slice(0, slash);
	const name = notePath.slice(slash + 1).replace(/\.md$/i, "");
	if (parent.split("/").pop() === name && name !== "") return parent;
	const sibling = parent === "" ? name : `${parent}/${name}`;
	return markdownPaths.some((path) => path.startsWith(`${sibling}/`)) ? sibling : null;
}

/**
 * The note paths a scope covers, or null for the whole vault. "tree" needs a folder note and "note" needs
 * a note; otherwise the scope falls back to the whole vault (null).
 */
export function scopePaths(scope: JournalScope, notePath: string | null, markdownPaths: readonly string[]): Set<string> | null {
	if (scope === "vault" || notePath === null) return null;
	if (scope === "note") return new Set([notePath]);
	const folder = folderNoteFolder(notePath, markdownPaths);
	if (folder === null) return null;
	return new Set([notePath, ...markdownPaths.filter((path) => path.startsWith(`${folder}/`))]);
}
