// Settings data: types, defaults, loading and validation. Pure, so Vitest can test it.
import { validateBaseUrl } from "./ai/endpoint";
import type { Confirmations } from "../features/ai-actions/confirmation";
import { cleanPairs, type NotePair } from "../features/context/dismissed";
import { isTracksHeading } from "../features/projects/project-note";

export interface JournalSettings {
	enabled: boolean;
	/** Tag of decision lines, without `#`. */
	decisionTag: string;
	/** Tag of prediction lines, without `#`. */
	predictionTag: string;
}

export interface IdeasSettings {
	enabled: boolean;
	/** Tag of idea lines, without `#`. */
	tag: string;
	/** Folder of the notes created from ideas; empty = where Obsidian puts new notes. */
	newNoteFolder: string;
	/** Path of the template note for those notes; empty = none. */
	newNoteTemplate: string;
	/** Sub-tag of the idea tag that marks a project seed (`idea/<subtag>`), without #; empty = no project seeds. */
	seedSubtag: string;
}

export interface ProjectsSettings {
	enabled: boolean;
	/** Tag in a note's `tags` property that makes it a project, without `#`. */
	tag: string;
	/** Heading text of the Tracks section the plugin creates (reading recognizes more forms). */
	tracksTitle: string;
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
	/** Properties whose values are people or places; notes sharing a value can be connected. */
	peopleProperties: string[];
	/** Most connections shown for a note, 1 to MAX_CONNECTIONS. */
	maxConnections: number;
}

export const MAX_CONNECTIONS = 5;

/** Small state the connections keep next to their settings (shared between devices). */
export interface ContextState {
	/** Pairs of note paths the user marked "Not useful". */
	notUseful: NotePair[];
}

/** How VaultMate looks and moves. */
export interface UiSettings {
	/** Animate the hub banner and the stamp moment; always off when the system asks for reduced motion. */
	animations: boolean;
}

/** What the plugin did once for this vault (shared between devices). */
export interface FirstRunState {
	/** The idea and project tags were checked against the vault (see `core/tag-check`). */
	tagCheckDone: boolean;
}

/** Nested per feature; a feature's settings live under its own key. */
export interface VaultMateSettings {
	journal: JournalSettings;
	ideas: IdeasSettings;
	projects: ProjectsSettings;
	ai: AiSettings;
	aiState: AiState;
	collections: CollectionsSettings;
	location: LocationSettings;
	context: ContextSettings;
	contextState: ContextState;
	firstRun: FirstRunState;
	ui: UiSettings;
}

export const DEFAULT_SETTINGS: VaultMateSettings = {
	journal: { enabled: true, decisionTag: "decision", predictionTag: "prediction" },
	ideas: { enabled: true, tag: "idea", newNoteFolder: "", newNoteTemplate: "", seedSubtag: "" },
	projects: { enabled: true, tag: "project", tracksTitle: "\u{1F9ED} Tracks" },
	ai: { enabled: true, baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna", apiKeySecret: "", actionsFolder: "VaultMate/AI actions" },
	aiState: { confirmed: {}, notInterested: {} },
	collections: { folder: "", typeProperty: "type", ratingProperty: "rating" },
	location: { enabled: true, latitudeProperty: "latitude", longitudeProperty: "longitude", labelProperty: "location", androidApp: false },
	context: { enabled: true, excludedFolders: [], peopleProperties: ["author", "authors", "people"], maxConnections: 3 },
	contextState: { notUseful: [] },
	firstRun: { tagCheckDone: false },
	ui: { animations: true },
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

/** A project seed sub-tag as stored: without `#`, slashes or spaces at either end. */
export function cleanSeedSubtag(text: string): string {
	return text.replace(/^[#/\s]+|[#/\s]+$/g, "");
}

/** Error message for a project seed sub-tag as typed, or undefined when it is valid (an empty one turns seeds off). */
export function validateSeedSubtag(text: string): string | undefined {
	const subtag = cleanSeedSubtag(text);
	if (subtag === "") return undefined;
	if (/\s/.test(subtag)) return "A tag cannot contain spaces.";
	return TAG_RE.test(subtag) ? undefined : "Use letters, numbers, underscores, hyphens and slashes only.";
}

function sameTag(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

/** Error message when the two journal tags would clash, or undefined. */
export function validateDistinctTags(decisionTag: string, predictionTag: string): string | undefined {
	return sameTag(decisionTag, predictionTag) ? "Decisions and predictions need different tags." : undefined;
}

/** Error message when the idea tag clashes with a journal tag (ignoring case), or undefined. */
export function validateDistinctIdeaTag(ideaTag: string, journalTag: string): string | undefined {
	return sameTag(ideaTag, journalTag) ? "Ideas need a tag different from decisions and predictions." : undefined;
}

/** A project tag as stored: trimmed, without a leading `#`. */
export function cleanProjectTag(text: string): string {
	return text.trim().replace(/^#+/, "");
}

/** Error message for the project tag as typed, or undefined when it is valid. */
export function validateProjectTag(text: string): string | undefined {
	return validateTag(cleanProjectTag(text));
}

/** Error message for the Tracks section title as typed, or undefined. The plugin must be able to read back the section it creates. */
export function validateTracksTitle(title: string): string | undefined {
	const text = title.trim();
	if (text === "") return "Enter a title.";
	if (text.startsWith("#") || /[\r\n]/.test(text)) return "Enter the title without # and on one line.";
	return isTracksHeading(text) ? undefined : "The title needs the \u{1F9ED} symbol or the word track or tracks, so that VaultMate finds the section again.";
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
	const ideas = isRecord(value) && isRecord(value.ideas) ? value.ideas : {};
	const ideaDefaults = DEFAULT_SETTINGS.ideas;
	let ideaTag = validTag(ideas.tag, ideaDefaults.tag);
	if (sameTag(ideaTag, decisionTag) || sameTag(ideaTag, predictionTag)) ideaTag = ideaDefaults.tag;
	if (sameTag(ideaTag, decisionTag) || sameTag(ideaTag, predictionTag)) {
		decisionTag = defaults.decisionTag;
		predictionTag = defaults.predictionTag;
	}
	const projects = isRecord(value) && isRecord(value.projects) ? value.projects : {};
	const projectDefaults = DEFAULT_SETTINGS.projects;
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
	const ctxState = isRecord(value) && isRecord(value.contextState) ? value.contextState : {};
	const ui = isRecord(value) && isRecord(value.ui) ? value.ui : {};
	return {
		ui: { animations: typeof ui.animations === "boolean" ? ui.animations : DEFAULT_SETTINGS.ui.animations },
		contextState: { notUseful: cleanPairs(ctxState.notUseful) },
		context: {
			maxConnections: typeof ctx.maxConnections === "number" && Number.isInteger(ctx.maxConnections) && ctx.maxConnections >= 1 && ctx.maxConnections <= MAX_CONNECTIONS ? ctx.maxConnections : ctxDefaults.maxConnections,
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
		firstRun: { tagCheckDone: isRecord(value) && isRecord(value.firstRun) && typeof value.firstRun.tagCheckDone === "boolean" ? value.firstRun.tagCheckDone : DEFAULT_SETTINGS.firstRun.tagCheckDone },
		collections: { folder: typeof col.folder === "string" ? cleanFolderPath(col.folder) : colDefaults.folder, typeProperty, ratingProperty },
		journal: { enabled: typeof journal.enabled === "boolean" ? journal.enabled : defaults.enabled, decisionTag, predictionTag },
		projects: {
			enabled: typeof projects.enabled === "boolean" ? projects.enabled : projectDefaults.enabled,
			tag: typeof projects.tag === "string" && validateProjectTag(projects.tag) === undefined ? cleanProjectTag(projects.tag) : projectDefaults.tag,
			tracksTitle: typeof projects.tracksTitle === "string" && validateTracksTitle(projects.tracksTitle) === undefined ? projects.tracksTitle.trim() : projectDefaults.tracksTitle,
		},
		ideas: {
			enabled: typeof ideas.enabled === "boolean" ? ideas.enabled : ideaDefaults.enabled,
			tag: ideaTag,
			newNoteFolder: typeof ideas.newNoteFolder === "string" ? cleanFolderPath(ideas.newNoteFolder) : ideaDefaults.newNoteFolder,
			newNoteTemplate: typeof ideas.newNoteTemplate === "string" ? cleanFolderPath(ideas.newNoteTemplate) : ideaDefaults.newNoteTemplate,
			seedSubtag: typeof ideas.seedSubtag === "string" && validateSeedSubtag(ideas.seedSubtag) === undefined ? cleanSeedSubtag(ideas.seedSubtag) : ideaDefaults.seedSubtag,
		},
	};
}
