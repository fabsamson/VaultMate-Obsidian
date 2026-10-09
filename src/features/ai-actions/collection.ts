// Collection notes (Media DB style) as the AI actions see them: read from frontmatter only, never from
// the note body. Rating rules mirror the VaultMate Android app (`parseRating`). Pure.

export interface CollectionProperties {
	/** Folder of the collection notes; empty = the whole vault. */
	folder: string;
	/** Property that holds the kind of item (`movie`, `series`, ...). */
	typeProperty: string;
	/** Property that holds the personal rating, 0 to 10 (0 or empty = not rated). */
	ratingProperty: string;
}

export interface CollectionNote {
	/** Vault path of the note: what identifies an entry. */
	path: string;
	title: string;
	/** Lower-case value of the type property. */
	type: string;
	year: string | null;
	/** Out of 10, or null when not rated. */
	rating: number | null;
	genres: string[];
	creators: string[];
	/** The `plot` property, when it is text. */
	plot: string | null;
}

export interface CollectionType {
	id: string;
	label: string;
	notes: number;
	rated: number;
}

const TYPE_LABELS: Record<string, string> = {
	movie: "Movies",
	series: "Series",
	manga: "Manga",
	game: "Games",
	book: "Books",
	boardgame: "Board games",
};

/** The creator properties, in order: the first one that has a value is used. */
const CREATOR_PROPERTIES = ["director", "author", "authors", "studio", "developers"];

export function typeLabel(id: string): string {
	return TYPE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** A rating out of 10: absent, zero, negative or not a number is "not rated"; above 10 counts as 10. "7,5" and "8/10" are accepted. */
export function parseRating(value: unknown): number | null {
	const text = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
	const number = Number(text.split("/")[0]?.trim().replace(",", "."));
	return Number.isFinite(number) && number > 0 ? Math.min(number, 10) : null;
}

/** "8/10", "7.5/10". */
export function ratingLabel(rating: number): string {
	return `${Number.isInteger(rating) ? rating : rating.toFixed(1)}/10`;
}

/** Text of a property value, with wikilinks reduced to their visible text. */
function plain(value: string): string {
	return value.replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_all, target: string, alias?: string) => alias ?? target).trim();
}

/** A property as a list of short texts: a string is one value (or comma-separated), a list is its items. */
function textList(value: unknown): string[] {
	const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : typeof value === "number" ? [value] : [];
	return items.flatMap((item: unknown) => {
		const text = typeof item === "string" || typeof item === "number" ? plain(String(item)) : "";
		return text ? [text] : [];
	});
}

/**
 * The collection note behind a file, or null when the type property is missing or empty. The title is the
 * `title` property, else the file name (without a trailing "(year)").
 */
export function collectionNoteOf(path: string, frontmatter: Record<string, unknown> | undefined, properties: CollectionProperties): CollectionNote | null {
	if (!frontmatter) return null;
	const type = textList(frontmatter[properties.typeProperty])[0]?.toLowerCase();
	if (!type) return null;
	const fileName = (path.split("/").pop() ?? path).replace(/\.md$/i, "");
	const title = textList(frontmatter.title).join(", ") || fileName.replace(/\s*-?\s*\(\d{4}\)\s*$/, "").trim();
	if (!title) return null;
	const year = /\d{4}/.exec(textList(frontmatter.year).join(" "))?.[0] ?? null;
	const creators = CREATOR_PROPERTIES.map((name) => textList(frontmatter[name])).find((names) => names.length > 0) ?? [];
	return { path, title, type, year, rating: parseRating(frontmatter[properties.ratingProperty]), genres: textList(frontmatter.genres), creators, plot: typeof frontmatter.plot === "string" && frontmatter.plot.trim() ? frontmatter.plot.trim() : null };
}

/** Whether a file path is inside the collections folder (an empty folder is the whole vault). */
export function inFolder(path: string, folder: string): boolean {
	return folder === "" || path.startsWith(`${folder}/`);
}

/** The types found among the notes, most notes first. */
export function collectionTypes(notes: readonly CollectionNote[]): CollectionType[] {
	const found = new Map<string, CollectionType>();
	for (const note of notes) {
		const entry = found.get(note.type) ?? { id: note.type, label: typeLabel(note.type), notes: 0, rated: 0 };
		entry.notes++;
		if (note.rating !== null) entry.rated++;
		found.set(note.type, entry);
	}
	return [...found.values()].sort((a, b) => b.notes - a.notes || a.label.localeCompare(b.label));
}

/**
 * For comparing titles: case, accents, punctuation, a leading article ("The", "Le", "La", "Les", "L'") and a
 * trailing "(year)" do not count. Only Latin accents are removed, so kana and kanji keep their marks.
 */
export function normalizeTitle(title: string): string {
	const base = title
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.normalize("NFKC")
		.toLowerCase()
		.trim()
		.replace(/\s*\(\d{4}\)$/, "");
	const withoutArticle = base.replace(/^(?:the|le|la|les)\s+/, "").replace(/^l['\u2019]\s*/, "");
	return (withoutArticle || base).replace(/[^\p{L}\p{N}\p{M}]+/gu, "");
}

export interface EntryChoice {
	/** The note's path. */
	id: string;
	/** "Heat (1995) · 9/10" or "Heat (1995) · not rated". */
	label: string;
}

/** Every entry of a type, rated or not: highest rating first, then title. */
export function entryChoices(notes: readonly CollectionNote[], type: string): EntryChoice[] {
	return notes
		.filter((note) => note.type === type)
		.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title))
		.map((note) => ({ id: note.path, label: `${note.year ? `${note.title} (${note.year})` : note.title} · ${note.rating === null ? "not rated" : ratingLabel(note.rating)}` }));
}
