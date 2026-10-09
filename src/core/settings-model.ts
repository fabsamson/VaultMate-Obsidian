// Settings data: types, defaults, loading and validation. Pure, so Vitest can test it.
import { validateBaseUrl } from "./ai/endpoint";
import type { Confirmations } from "../features/ai-actions/confirmation";

export interface JournalSettings {
	enabled: boolean;
	/** Tag of decision lines, without `#`. */
	decisionTag: string;
	/** Tag of prediction lines, without `#`. */
	predictionTag: string;
}

/** Small state a feature keeps next to its settings (shared between devices by Syncthing, rarely written). */
export interface JournalState {
	/** Day (`YYYY-MM-DD`) of the last "reviews due" notice; empty until one was shown. */
	lastNoticeDate: string;
}

export interface AiSettings {
	enabled: boolean;
	/** OpenAI-compatible base URL; HTTPS except for a local server. */
	baseUrl: string;
	model: string;
	/** Name of the SecretStorage secret that holds the API key (never the key itself). */
	apiKeySecret: string;
	/** Folder of the action files. */
	actionsFolder: string;
}

export interface AiState {
	/** Action file path -> sorted source list the user confirmed for it. */
	confirmed: Confirmations;
	/** Collection type (`movie`) -> titles the user does not want suggested again. */
	notInterested: Record<string, string[]>;
}

/** Where the AI actions find the user's collection notes (`CollectionProperties`). */
export interface CollectionsSettings {
	/** Folder of the collection notes; empty = the whole vault. */
	folder: string;
	typeProperty: string;
	ratingProperty: string;
}

export interface LocationSettings {
	enabled: boolean;
	/** Property names the location is written to. All different. */
	latitudeProperty: string;
	longitudeProperty: string;
	labelProperty: string;
	/** Ask the VaultMate Android app for the current position (off by default; the app is optional). */
	androidApp: boolean;
}

export interface ContextSettings {
	enabled: boolean;
	/** Folders whose notes are neither indexed nor suggested. */
	excludedFolders: string[];
	/** Properties whose values are people or places; notes sharing a value are related. */
	peopleProperties: string[];
}

/** Nested per feature; a feature's settings live under its own key. */
export interface VaultMateSettings {
	journal: JournalSettings;
	journalState: JournalState;
	ai: AiSettings;
	aiState: AiState;
	collections: CollectionsSettings;
	location: LocationSettings;
	context: ContextSettings;
}

export const DEFAULT_SETTINGS: VaultMateSettings = {
	journal: { enabled: true, decisionTag: "decision", predictionTag: "prediction" },
	journalState: { lastNoticeDate: "" },
	ai: { enabled: true, baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna", apiKeySecret: "", actionsFolder: "VaultMate/AI actions" },
	aiState: { confirmed: {}, notInterested: {} },
	collections: { folder: "", typeProperty: "type", ratingProperty: "rating" },
	location: { enabled: true, latitudeProperty: "latitude", longitudeProperty: "longitude", labelProperty: "location", androidApp: false },
	context: { enabled: true, excludedFolders: [], peopleProperties: ["author", "authors", "people"] },
};

const TAG_RE = /^[\p{L}\p{N}\p{M}_/-]+$/u;

/** Error message for a tag name as the user typed it, or undefined when it is valid. */
export function validateTag(tag: string): string | undefined {
	if (tag.trim() === "") return "Enter a tag.";
	if (tag.startsWith("#")) return "Enter the tag without #.";
	if (/\s/.test(tag)) return "A tag cannot contain spaces.";
	if (!TAG_RE.test(tag)) return "Use letters, numbers, underscores, hyphens and slashes only.";
	if (!/\D/.test(tag)) return "A tag needs at least one non-numeric character.";
	return undefined;
}

function sameTag(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

/** Error message when the two journal tags would clash, or undefined. */
export function validateDistinctTags(decisionTag: string, predictionTag: string): string | undefined {
	return sameTag(decisionTag, predictionTag) ? "Decisions and predictions need different tags." : undefined;
}

/** Folder path as stored: no backslashes, repeated, leading or trailing slashes. Empty when nothing is left. */
export function cleanFolderPath(path: string): string {
	return path.trim().replace(/\\/g, "/").split("/").filter((part) => part.trim() !== "").join("/");
}

/** Error message for an actions folder as typed, or undefined. */
export function validateActionsFolder(path: string): string | undefined {
	return cleanFolderPath(path) === "" ? "Enter a folder path." : undefined;
}

/** Error message for a property name as typed, or undefined when it is valid. */
export function validatePropertyName(name: string): string | undefined {
	if (name.trim() === "") return "Enter a property name.";
	if (!/^[\p{L}\p{N}\p{M}_-]+$/u.test(name)) return "Use letters, numbers, underscores and hyphens only.";
	return undefined;
}

/** Error message when the type and rating properties are the same (ignoring case), or undefined. */
export function validateDistinctCollectionProperties(typeProperty: string, ratingProperty: string): string | undefined {
	return typeProperty.toLowerCase() === ratingProperty.toLowerCase() ? "The type and the rating need different property names." : undefined;
}

/** Error message when the three property names are not all different (ignoring case), or undefined. */
export function validateDistinctProperties(names: readonly string[]): string | undefined {
	const lower = names.map((name) => name.toLowerCase());
	return new Set(lower).size === lower.length ? undefined : "Latitude, longitude and label need different property names.";
}

/** Items of a comma- or line-separated list as typed, trimmed, without empty items or duplicates. */
export function parseList(text: string): string[] {
	return [...new Set(text.split(/[,\n]/).map((item) => item.trim()).filter((item) => item !== ""))];
}

/** Error message for a comma-separated list of property names, or undefined (an empty list is valid). */
export function validatePropertyList(text: string): string | undefined {
	for (const name of parseList(text)) {
		const error = validatePropertyName(name);
		if (error) return `"${name}": ${error}`;
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validTag(value: unknown, fallback: string): string {
	return typeof value === "string" && validateTag(value) === undefined ? value : fallback;
}

/**
 * Merges loaded data with the defaults key by key. `data.json` is shared between devices and may come
 * from an older or newer version, so every value is checked and unknown keys are dropped.
 */
export function normalizeSettings(value: unknown): VaultMateSettings {
	const journal = isRecord(value) && isRecord(value.journal) ? value.journal : {};
	const defaults = DEFAULT_SETTINGS.journal;
	let decisionTag = validTag(journal.decisionTag, defaults.decisionTag);
	let predictionTag = validTag(journal.predictionTag, defaults.predictionTag);
	if (sameTag(decisionTag, predictionTag)) {
		decisionTag = defaults.decisionTag;
		predictionTag = defaults.predictionTag;
	}
	const state = isRecord(value) && isRecord(value.journalState) ? value.journalState : {};
	const lastNoticeDate = typeof state.lastNoticeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(state.lastNoticeDate) ? state.lastNoticeDate : "";
	const ai = isRecord(value) && isRecord(value.ai) ? value.ai : {};
	const aiDefaults = DEFAULT_SETTINGS.ai;
	const confirmedRaw = isRecord(value) && isRecord(value.aiState) && isRecord(value.aiState.confirmed) ? value.aiState.confirmed : {};
	const confirmed: Confirmations = {};
	for (const [path, sources] of Object.entries(confirmedRaw)) {
		if (Array.isArray(sources) && sources.every((source) => typeof source === "string")) confirmed[path] = [...sources];
	}
	const notInterestedRaw = isRecord(value) && isRecord(value.aiState) && isRecord(value.aiState.notInterested) ? value.aiState.notInterested : {};
	const notInterested: Record<string, string[]> = {};
	for (const [type, titles] of Object.entries(notInterestedRaw)) {
		if (Array.isArray(titles)) notInterested[type] = titles.filter((title): title is string => typeof title === "string");
	}
	const col = isRecord(value) && isRecord(value.collections) ? value.collections : {};
	const colDefaults = DEFAULT_SETTINGS.collections;
	let typeProperty = typeof col.typeProperty === "string" && validatePropertyName(col.typeProperty.trim()) === undefined ? col.typeProperty.trim() : colDefaults.typeProperty;
	let ratingProperty = typeof col.ratingProperty === "string" && validatePropertyName(col.ratingProperty.trim()) === undefined ? col.ratingProperty.trim() : colDefaults.ratingProperty;
	if (validateDistinctCollectionProperties(typeProperty, ratingProperty)) {
		typeProperty = colDefaults.typeProperty;
		ratingProperty = colDefaults.ratingProperty;
	}
	const loc = isRecord(value) && isRecord(value.location) ? value.location : {};
	const locDefaults = DEFAULT_SETTINGS.location;
	const propertyName = (raw: unknown, fallback: string): string => (typeof raw === "string" && validatePropertyName(raw.trim()) === undefined ? raw.trim() : fallback);
	let names = [propertyName(loc.latitudeProperty, locDefaults.latitudeProperty), propertyName(loc.longitudeProperty, locDefaults.longitudeProperty), propertyName(loc.labelProperty, locDefaults.labelProperty)];
	if (validateDistinctProperties(names)) names = [locDefaults.latitudeProperty, locDefaults.longitudeProperty, locDefaults.labelProperty];
	const ctx = isRecord(value) && isRecord(value.context) ? value.context : {};
	const ctxDefaults = DEFAULT_SETTINGS.context;
	const stringList = (raw: unknown, clean: (item: string) => string): string[] | undefined =>
		Array.isArray(raw) ? [...new Set(raw.filter((item): item is string => typeof item === "string").map(clean).filter((item) => item !== ""))] : undefined;
	return {
		context: {
			enabled: typeof ctx.enabled === "boolean" ? ctx.enabled : ctxDefaults.enabled,
			excludedFolders: stringList(ctx.excludedFolders, cleanFolderPath) ?? [...ctxDefaults.excludedFolders],
			peopleProperties: stringList(ctx.peopleProperties, (item) => item.trim())?.filter((item) => validatePropertyName(item) === undefined) ?? [...ctxDefaults.peopleProperties],
		},
		location: {
			enabled: typeof loc.enabled === "boolean" ? loc.enabled : locDefaults.enabled,
			latitudeProperty: names[0] ?? locDefaults.latitudeProperty,
			longitudeProperty: names[1] ?? locDefaults.longitudeProperty,
			labelProperty: names[2] ?? locDefaults.labelProperty,
			androidApp: typeof loc.androidApp === "boolean" ? loc.androidApp : locDefaults.androidApp,
		},
		ai: {
			enabled: typeof ai.enabled === "boolean" ? ai.enabled : aiDefaults.enabled,
			baseUrl: typeof ai.baseUrl === "string" && validateBaseUrl(ai.baseUrl) === undefined ? ai.baseUrl.trim() : aiDefaults.baseUrl,
			model: typeof ai.model === "string" && ai.model.trim() !== "" ? ai.model.trim() : aiDefaults.model,
			apiKeySecret: typeof ai.apiKeySecret === "string" ? ai.apiKeySecret : aiDefaults.apiKeySecret,
			actionsFolder: typeof ai.actionsFolder === "string" && cleanFolderPath(ai.actionsFolder) !== "" ? cleanFolderPath(ai.actionsFolder) : aiDefaults.actionsFolder,
		},
		aiState: { confirmed, notInterested },
		collections: { folder: typeof col.folder === "string" ? cleanFolderPath(col.folder) : colDefaults.folder, typeProperty, ratingProperty },
		journal: { enabled: typeof journal.enabled === "boolean" ? journal.enabled : defaults.enabled, decisionTag, predictionTag },
		journalState: { lastNoticeDate },
	};
}
