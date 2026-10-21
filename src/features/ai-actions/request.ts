// The messages of one request. Pure: the preview shows the sizes of exactly these texts.
import type { ActionDefinition, SourceName } from "./definition";
import type { CollectionNote } from "./collection";
import { collectionProfile } from "./collection-profile";
import { itemsContract } from "./items";
import { questionsContract } from "./questions";
import { suggestionsContract } from "./suggestions";
import { noteSource, propertiesSource, selectionSource, type SourceText } from "./sources";
import { noteLines, trackSource } from "./track-source";

const LABELS: Record<SourceName, string> = { note: "Note", selection: "Selection", properties: "Properties", "collection-profile": "Collection profile", track: "Track" };

const CONTRACTS: Record<ActionDefinition["output"], (count: number, entryTitle: string) => string> = {
	questions: (count) => questionsContract(count),
	suggestions: suggestionsContract,
	items: (count) => itemsContract(count),
};

export interface RequestMessages {
	system: string;
	user: string;
}

/** The prompt with each `{{name}}` replaced by the label chosen for that parameter. */
export function applyParams(prompt: string, labels: Record<string, string>): string {
	return Object.entries(labels).reduce((text, [name, label]) => text.replaceAll(`{{${name}}}`, label), prompt);
}

/**
 * System = the action's prompt, then the output contract (last, so the prompt cannot override it). User = labelled sources.
 * `{{based_on}}` is the chosen entry (`entryTitle`) or, without one, the user's ratings.
 */
export function buildMessages(action: ActionDefinition, sources: SourceText[], labels: Record<string, string> = {}, entryTitle = ""): RequestMessages {
	const basedOn = entryTitle ? `the title \u201c${entryTitle}\u201d` : "the titles they rated high and low";
	return {
		system: `${applyParams(action.prompt, { ...labels, based_on: basedOn })}\n\n${CONTRACTS[action.output](action.count, entryTitle)}`,
		user: sources.map((source) => `### ${LABELS[source.name]}\n${source.text}`).join("\n\n"),
	};
}

/** What the sources are read from: the note and the editor selection captured when the action started. */
export interface SourceInput {
	title: string;
	/** Full text of the note, frontmatter included. */
	raw: string;
	selection: string;
	frontmatter: Record<string, unknown> | undefined;
	collection: CollectionNote[];
	/** Collection type -> titles the user does not want suggested again. */
	notInterested: Record<string, string[]>;
}

/** The name of the parameter that chooses one entry, if the action has one. */
export function entryParam(action: ActionDefinition): string | undefined {
	return action.params.find((param) => param.choices === "collection-entries")?.name;
}

/** The name of the parameter that chooses the track, if the action has one. */
export function trackParam(action: ActionDefinition): string | undefined {
	return action.params.find((param) => param.choices === "project-tracks")?.name;
}

/** The texts the action's sources send, in the order the action lists them. */
export function collectSources(action: ActionDefinition, input: SourceInput, values: Record<string, string> = {}): SourceText[] {
	return action.sources.map((name) => {
		switch (name) {
			case "note":
				return noteSource(input.title, input.raw);
			case "selection":
				return selectionSource(input.selection);
			case "properties":
				return propertiesSource(input.frontmatter);
			case "track": {
				const param = trackParam(action);
				return trackSource(input.title, noteLines(input.raw), param ? (values[param] ?? "") : "");
			}
			case "collection-profile": {
				const type = values.type ?? "";
				const entry = entryParam(action);
				return collectionProfile(input.collection, type, input.notInterested[type] ?? [], entry ? (values[entry] ?? "") : "").source;
			}
		}
	});
}

/** Why the action cannot run on these sources, or null. */
export function sourceProblem(sources: SourceText[]): string | null {
	if (sources.some((source) => source.name === "selection" && source.chars === 0)) return "Select some text first.";
	return sources.find((source) => source.problem)?.problem ?? null;
}
