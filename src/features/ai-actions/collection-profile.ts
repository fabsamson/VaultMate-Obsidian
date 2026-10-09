// The `collection-profile` source: the user's rated notes of one type (best 25, worst 10), then every title
// of that type already in the vault plus the "Not interested" titles, so the model does not suggest them.
// Pure, so the preview and the request cannot differ.
import { normalizeTitle, ratingLabel, typeLabel, type CollectionNote } from "./collection";
import { SOURCE_CAPS, type SourceText } from "./sources";

export const TOP_RATED = 25;
export const LOWEST_RATED = 10;
export const MIN_RATED = 3;
const MAX_GENRES = 4;
const MAX_CREATORS = 3;

export interface RatedTitle {
	title: string;
	rating: number;
}

export interface CollectionProfile {
	/** What is sent. `problem` is set when the action cannot run. */
	source: SourceText;
	/** The rated titles listed in the source: the only ones an answer may cite as a reason. */
	rated: RatedTitle[];
	/** Every title the answer must not suggest: the vault's titles of this type and the Not interested ones. */
	excluded: string[];
}

function line(note: CollectionNote & { rating: number }): string {
	const title = note.year ? `${note.title} (${note.year})` : note.title;
	return [title, ratingLabel(note.rating), note.genres.slice(0, MAX_GENRES).join(", "), note.creators.slice(0, MAX_CREATORS).join(", ")].filter((part) => part !== "").join(" · ");
}

/** The profile of one collection type. `notInterested` are the titles the user rejected for this type. */
export function collectionProfile(notes: readonly CollectionNote[], type: string, notInterested: readonly string[]): CollectionProfile {
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
	const head = [
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
	const problem = ratedNotes.length < MIN_RATED ? `Rate a few more ${label} first (at least ${MIN_RATED}).` : undefined;
	return {
		source: { name: "collection-profile", text, chars: text.length, truncated, ...(problem ? { problem } : {}) },
		rated: [...top, ...lowest].map(({ title, rating }) => ({ title, rating })),
		excluded,
	};
}
