// The project rule: a note is a project when its `tags` property holds the project tag. Pure, so Vitest
// can test it. The parsing mirrors the VaultMate Android app (`propertyTags`), not Obsidian's
// `parseFrontMatterTags`: the `tags` key only, a text value split on commas and blanks, a leading `#` removed.

/** The tags of the `tags` property as the frontmatter object holds them (list or text), without `#`. */
export function propertyTags(frontmatter: Record<string, unknown> | null | undefined): string[] {
	const value = frontmatter?.tags;
	const raw = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? value.split(/[, \t]/) : [];
	return raw.map((tag) => tag.trim().replace(/^#+/, "")).filter((tag) => tag !== "");
}

/** Whether the frontmatter marks a project: `tags` contains `projectTag` exactly, ignoring case (no subtag match). */
export function hasProjectTag(frontmatter: Record<string, unknown> | null | undefined, projectTag: string): boolean {
	const wanted = projectTag.toLowerCase();
	return propertyTags(frontmatter).some((tag) => tag.toLowerCase() === wanted);
}
