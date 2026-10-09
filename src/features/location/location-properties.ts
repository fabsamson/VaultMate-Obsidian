// Planning the write of a place into a note's properties. Pure: the caller does the actual write.

export interface Place {
	latitude: number;
	longitude: number;
	/** Empty means "no label": the label property is then left alone. */
	label: string;
}

export interface PropertyNames {
	latitude: string;
	longitude: string;
	label: string;
}

export type LocationValues = Record<string, number | string>;

export type LocationPlan =
	| { kind: "write"; values: LocationValues }
	| { kind: "unchanged" }
	/** Existing values would be replaced: ask first, showing `before` and `after`. */
	| { kind: "confirm"; values: LocationValues; before: string; after: string };

/** Coordinates are stored with 5 decimals (about 1 m). */
export function roundCoordinate(value: number): number {
	return Math.round(value * 1e5) / 1e5;
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function show(value: unknown): string {
	if (isEmpty(value)) return "none";
	if (typeof value === "string" || typeof value === "number") return String(value);
	return JSON.stringify(value) ?? "unreadable value";
}

/** "Café, Lyon (45.76404, 4.83566)", from raw property values. */
export function describeLocation(label: unknown, latitude: unknown, longitude: unknown): string {
	const coordinates = isEmpty(latitude) && isEmpty(longitude) ? "no coordinates" : `${show(latitude)}, ${show(longitude)}`;
	return isEmpty(label) ? coordinates : `${show(label)} (${coordinates})`;
}

/** The numbers in the note when both are numbers, else null. */
export function readCoordinates(frontmatter: Record<string, unknown> | undefined, names: PropertyNames): { latitude: number; longitude: number } | null {
	const latitude = frontmatter?.[names.latitude];
	const longitude = frontmatter?.[names.longitude];
	return typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

/**
 * Compares the note's current values with the place. Empty or missing values are written; equal values
 * need nothing; any other value (different, a list, text in a coordinate) must be confirmed first.
 */
export function planLocation(frontmatter: Record<string, unknown> | undefined, names: PropertyNames, place: Place): LocationPlan {
	const values: LocationValues = {
		[names.latitude]: roundCoordinate(place.latitude),
		[names.longitude]: roundCoordinate(place.longitude),
	};
	const label = place.label.trim();
	if (label !== "") values[names.label] = label;

	let different = false;
	let missing = false;
	for (const [key, next] of Object.entries(values)) {
		const current = frontmatter?.[key];
		if (isEmpty(current)) missing = true;
		else if (typeof next === "number" ? current !== next : typeof current !== "string" || current.trim() !== next) different = true;
	}
	if (different) {
		const before = describeLocation(frontmatter?.[names.label], frontmatter?.[names.latitude], frontmatter?.[names.longitude]);
		return { kind: "confirm", values, before, after: describeLocation(label, values[names.latitude], values[names.longitude]) };
	}
	return missing ? { kind: "write", values } : { kind: "unchanged" };
}
