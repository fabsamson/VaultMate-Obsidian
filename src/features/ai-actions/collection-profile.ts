// The `collection-profile` source: the user's rated notes of one type (best 25, worst 10), or one chosen entry
// with its plot, then every title of that type already in the vault plus the "Not interested" titles, so the
// model does not suggest them.
// Pure, so the preview and the request cannot differ.
import { normalizeTitle, ratingLabel, typeLabel, type CollectionNote } from "./collection";
import { SOURCE_CAPS, type SourceText } from "./sources";

export const TOP_RATED = 25;
export const LOWEST_RATED = 10;
export const MIN_RATED = 3;
export const MAX_PLOT = 400;
const MAX_GENRES = 4;
const MAX_CREATORS = 3;

export interface RatedTitle {
	title: string;
	/** Null for the chosen entry of a one-entry profile when it is not rated. */
	rating: number | null;
}

export interface CollectionProfile {
	/** What is sent. `problem` is set when the action cannot run. */
	source: SourceText;
	/** The rated titles listed in the source: the only ones an answer may cite as a reason. */
	rated: RatedTitle[];
	/** Every title the answer must not suggest: the vault's titles of this type and the Not interested ones. */
	excluded: string[];
}

function line(note: CollectionNote): string {
	const title = note.year ? `${note.title} (${note.year})` : note.title;
	return [title, note.rating === null ? "not rated" : ratingLabel(note.rating), note.genres.slice(0, MAX_GENRES).join(", "), note.creators.slice(0, MAX_CREATORS).join(", ")].filter((part) => part !== "").join(" · ");
}

/** The plot on one line, cut at a word boundary to at most MAX_PLOT characters. */
function trimPlot(plot: string): string {
	const text = plot.replace(/\s+/g, " ").trim();
	if (text.length <= MAX_PLOT) return text;
	const cut = text.slice(0, MAX_PLOT - 1);
	const end = cut.lastIndexOf(" ");
	return `${(end > 0 ? cut.slice(0, end) : cut).trimEnd()}…`;
}

/**
 * The profile of one collection type. `notInterested` are the titles the user rejected for this type.
 * With `entryPath`, the profile is that one entry (rated or not) instead of the user's ratings.
 */
export function collectionProfile(notes: readonly CollectionNote[], type: string, notInterested: readonly string[], entryPath = ""): CollectionProfile {
	const ofType = notes.filter((note) => note.type === type);
	const ratedNotes = ofType
		.flatMap((note) => (note.rating === null ? [] : [{ ...note, rating: note.rating }]))
		.sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));
	const top = ratedNotes.slice(0, TOP_RATED);
	const lowest = ratedNotes.slice(TOP_RATED).slice(-LOWEST_RATED).reverse();

	const seen = new Set<string>();
	const excluded = [...ofType.map((note) => note.title).sort((a, b) => a.localeCompare(b)), ...notInterested].filter((title) => {
		const key = normalizeTitle(title);
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	const label = typeLabel(type);
	const entry = entryPath ? ofType.find((note) => note.path === entryPath) : undefined;
	const head = entry
		? ["Recommend titles close to this one:", line(entry), ...(entry.plot ? [`Plot: ${trimPlot(entry.plot)}`] : [])].join("\n")
		: [
				`Type: ${label}`,
				"Rated by the user, best first (title (year) · rating · genres · creators):",
				...top.map(line),
				...(lowest.length > 0 ? ["Lowest rated:", ...lowest.map(line)] : []),
			].join("\n");
	const intro = "\n\nAlready in the vault (do not suggest):\n";
	const cap = SOURCE_CAPS["collection-profile"];
	let list = excluded.join("; ");
	let truncated = head.length + intro.length + list.length > cap;
	if (truncated) {
		// Keep the rated lines whole and cut the exclusion list at a title boundary.
		const room = Math.max(cap - head.length - intro.length, 0);
		list = list.slice(0, room);
		const end = list.lastIndexOf("; ");
		list = end === -1 ? "" : list.slice(0, end);
	}
	let text = `${head}${intro}${list}`;
	if (text.length > cap) {
		text = text.slice(0, cap);
		truncated = true;
	}
	const problem = entryPath
		? entry
			? undefined
			: "That entry was not found. Choose another one."
		: ratedNotes.length < MIN_RATED
			? `Rate a few more ${label} first (at least ${MIN_RATED}).`
			: undefined;
	return {
		source: { name: "collection-profile", text, chars: text.length, truncated, ...(problem ? { problem } : {}) },
		rated: entry ? [{ title: entry.title, rating: entry.rating }] : [...top, ...lowest].map(({ title, rating }) => ({ title, rating })),
		excluded,
	};
}
