// OpenStreetMap Nominatim: building the search URL and reading the answer. Pure (no network here).

export const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
export const NOMINATIM_REPOSITORY = "https://github.com/fabsamson/VaultMate-Obsidian";

/** Nominatim's usage policy: at most one request per second. */
export const MIN_REQUEST_INTERVAL_MS = 1000;

export interface LatLng {
	latitude: number;
	longitude: number;
}

export interface PlaceResult extends LatLng {
	/** Name of the place; used as the default label. */
	name: string;
	/** Kind of place ("cafe", "museum"), or "". */
	type: string;
	/** Short address, or "". */
	address: string;
}

export function userAgent(version: string): string {
	return `VaultMate-Obsidian/${version} (+${NOMINATIM_REPOSITORY})`;
}

/** Obsidian's language when it is a plain code such as "fr" or "pt-BR", else null (the server default applies). */
export function simpleLanguage(language: string): string | null {
	return /^[a-z]{2,3}(-[A-Za-z]{2})?$/.test(language) ? language : null;
}

/** `viewbox` value (left,top,right,bottom) of an area about 110 km wide around a position. */
export function viewboxAround(near: LatLng, halfSizeDegrees = 0.5): string {
	const clamp = (value: number, limit: number): number => Math.min(limit, Math.max(-limit, value));
	const left = clamp(near.longitude - halfSizeDegrees, 180);
	const right = clamp(near.longitude + halfSizeDegrees, 180);
	const top = clamp(near.latitude + halfSizeDegrees, 90);
	const bottom = clamp(near.latitude - halfSizeDegrees, 90);
	return [left, top, right, bottom].map((value) => String(Math.round(value * 1e5) / 1e5)).join(",");
}

export interface SearchOptions {
	/** Result language, from {@link simpleLanguage}. */
	language?: string | null;
	/** Last position used: results around it rank higher. Not a restriction. */
	near?: LatLng | null;
}

/** The only data sent: the typed text, and the area around the last position when there is one. */
export function buildSearchUrl(query: string, options: SearchOptions = {}): string {
	let url = `${NOMINATIM_SEARCH}?format=jsonv2&q=${encodeURIComponent(query.trim())}&limit=8&addressdetails=1`;
	if (options.language) url += `&accept-language=${encodeURIComponent(options.language)}`;
	if (options.near) url += `&viewbox=${encodeURIComponent(viewboxAround(options.near))}`;
	return url;
}

function text(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function coordinate(value: unknown, limit: number): number | null {
	const number = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
	return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function shortAddress(address: Record<string, unknown>, name: string): string {
	const road = text(address.road);
	const street = [text(address.house_number), road].filter((part) => part !== "").join(" ");
	const town = text(address.city) || text(address.town) || text(address.village) || text(address.municipality) || text(address.hamlet);
	const parts = [street, text(address.suburb), town, text(address.country)].filter((part) => part !== "" && part !== name);
	return [...new Set(parts)].join(", ");
}

/** Keeps the results that have a usable position; everything else in the answer is ignored. */
export function parseSearchResults(json: unknown): PlaceResult[] {
	if (!Array.isArray(json)) return [];
	const results: PlaceResult[] = [];
	for (const item of json) {
		const entry = record(item);
		const latitude = coordinate(entry.lat, 90);
		const longitude = coordinate(entry.lon, 180);
		if (latitude === null || longitude === null) continue;
		const display = text(entry.display_name);
		const name = text(entry.name) || (display.split(",")[0] ?? "").trim();
		const kind = text(entry.type);
		const type = (kind === "yes" || kind === "" ? text(entry.category) : kind).replace(/_/g, " ");
		const address = shortAddress(record(entry.address), name) || display.split(",").slice(1, 4).join(",").trim();
		results.push({ latitude, longitude, name, type, address });
	}
	return results;
}

/** A user-facing message for a failed request. */
export function requestErrorMessage(status: number | null): string {
	if (status === null) return "Could not reach OpenStreetMap. Check your connection and try again.";
	if (status === 429) return "OpenStreetMap asks you to slow down (HTTP 429). Wait a moment and try again.";
	return `OpenStreetMap answered with HTTP ${status}. Try again later.`;
}

/** Link to the position on openstreetmap.org. */
export function openStreetMapUrl(position: LatLng): string {
	const { latitude, longitude } = position;
	return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}
