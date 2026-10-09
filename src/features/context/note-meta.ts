// What the context finder knows about a note besides its text: the graph and the properties. Pure:
// the glue reads the MetadataCache and hands the raw values to `buildNoteMeta`.
import { foldText } from "./tokenizer";

export interface PropertyValue {
	/** Property name as the user configured it (`author`). */
	property: string;
	/** Folded value, to compare. */
	key: string;
	/** Value as written, without wikilink brackets. */
	label: string;
}

export interface NoteMeta {
	path: string;
	/** File name without extension. */
	title: string;
	aliases: string[];
	/** Paths this note links to (resolved, deduplicated). */
	links: string[];
	/** Lowercase tags without `#`. */
	tags: string[];
	people: PropertyValue[];
	geo: { lat: number; lon: number } | null;
}

export interface MetaInput {
	path: string;
	links: readonly string[];
	/** Tags as the metadata cache reports them, with or without `#`. */
	tags: readonly string[];
	frontmatter: Record<string, unknown> | undefined;
}

export interface MetaOptions {
	/** Property names whose values are people or places (`author`, `people`). */
	peopleProperties: readonly string[];
	latitudeProperty: string;
	longitudeProperty: string;
}

export function baseName(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

/** Whether a path is inside one of the folders (or is that folder). */
export function isExcluded(path: string, folders: readonly string[]): boolean {
	return folders.some((folder) => folder !== "" && (path === folder || path.startsWith(`${folder}/`)));
}

function lookup(frontmatter: Record<string, unknown> | undefined, name: string): unknown {
	if (!frontmatter) return undefined;
	if (name in frontmatter) return frontmatter[name];
	const wanted = name.toLowerCase();
	const key = Object.keys(frontmatter).find((candidate) => candidate.toLowerCase() === wanted);
	return key === undefined ? undefined : frontmatter[key];
}

function textValues(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (typeof value === "number") return [String(value)];
	if (Array.isArray(value)) return value.flatMap(textValues);
	return [];
}

/** `[[Target|Shown]]` -> `Shown`, `[[Target]]` -> `Target`, other text as is. */
function stripWikilink(text: string): string {
	const match = /^\[\[([^\]|]*)(?:\|([^\]]*))?\]\]$/.exec(text.trim());
	return (match ? (match[2] ?? match[1] ?? "") : text).trim();
}

function parseCoordinate(value: unknown, limit: number): number | null {
	const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim().replace(",", ".")) : NaN;
	return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function buildNoteMeta(input: MetaInput, options: MetaOptions): NoteMeta {
	const { frontmatter } = input;
	const title = baseName(input.path);
	const aliasValue = lookup(frontmatter, "aliases") ?? lookup(frontmatter, "alias");
	const aliases = (typeof aliasValue === "string" ? aliasValue.split(",") : textValues(aliasValue)).map((alias) => alias.trim()).filter((alias) => alias !== "");
	const people: PropertyValue[] = [];
	for (const property of options.peopleProperties) {
		for (const raw of textValues(lookup(frontmatter, property))) {
			const label = stripWikilink(raw);
			if (label !== "") people.push({ property, key: foldText(label), label });
		}
	}
	const lat = parseCoordinate(lookup(frontmatter, options.latitudeProperty), 90);
	const lon = parseCoordinate(lookup(frontmatter, options.longitudeProperty), 180);
	return {
		path: input.path,
		title,
		aliases,
		links: [...new Set(input.links)].filter((link) => link !== input.path),
		tags: [...new Set(input.tags.map((tag) => tag.replace(/^#/, "").toLowerCase()).filter((tag) => tag !== ""))],
		people,
		geo: lat !== null && lon !== null ? { lat, lon } : null,
	};
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
	const rad = Math.PI / 180;
	const dLat = (b.lat - a.lat) * rad;
	const dLon = (b.lon - a.lon) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
	return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}
