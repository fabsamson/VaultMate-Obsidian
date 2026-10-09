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
}

/** Nested per feature; a feature's settings live under its own key. */
export interface VaultMateSettings {
	journal: JournalSettings;
	journalState: JournalState;
	ai: AiSettings;
	aiState: AiState;
}

export const DEFAULT_SETTINGS: VaultMateSettings = {
	journal: { enabled: true, decisionTag: "decision", predictionTag: "prediction" },
	journalState: { lastNoticeDate: "" },
	ai: { enabled: true, baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna", apiKeySecret: "", actionsFolder: "VaultMate/AI actions" },
	aiState: { confirmed: {} },
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
	return {
		ai: {
			enabled: typeof ai.enabled === "boolean" ? ai.enabled : aiDefaults.enabled,
			baseUrl: typeof ai.baseUrl === "string" && validateBaseUrl(ai.baseUrl) === undefined ? ai.baseUrl.trim() : aiDefaults.baseUrl,
			model: typeof ai.model === "string" && ai.model.trim() !== "" ? ai.model.trim() : aiDefaults.model,
			apiKeySecret: typeof ai.apiKeySecret === "string" ? ai.apiKeySecret : aiDefaults.apiKeySecret,
			actionsFolder: typeof ai.actionsFolder === "string" && cleanFolderPath(ai.actionsFolder) !== "" ? cleanFolderPath(ai.actionsFolder) : aiDefaults.actionsFolder,
		},
		aiState: { confirmed },
		journal: { enabled: typeof journal.enabled === "boolean" ? journal.enabled : defaults.enabled, decisionTag, predictionTag },
		journalState: { lastNoticeDate },
	};
}
