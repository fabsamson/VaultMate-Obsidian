// The way back to the VaultMate Android app (see README, "Back link"). Pure.
//
//   obsidian://vaultmate-idea|vaultmate-review|vaultmate-daily?...&back=app
//   -> vaultmate://back?kind=idea|review|daily&result=done|cancel|error

export type BackKind = "idea" | "review" | "daily";
export type BackResult = "done" | "cancel" | "error";

/** Whether the link asks to return to the app once the work is finished. */
export function wantsBack(params: Readonly<Record<string, string | undefined>>): boolean {
	return params.back === "app";
}

export function backUrl(kind: BackKind, result: BackResult): string {
	return `vaultmate://back?kind=${kind}&result=${result}`;
}

/** The vault path of a daily note: the folder of the Daily notes plugin (may be empty or have slashes around it), then the formatted name with `.md`. */
export function dailyNotePath(folder: string | undefined, name: string): string {
	const parts = (folder ?? "").split("/").filter((part) => part.trim() !== "");
	return [...parts, `${name}.md`].join("/");
}
