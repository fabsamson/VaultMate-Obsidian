// The messages of one request. Pure: the preview shows the sizes of exactly these texts.
import type { ActionDefinition, SourceName } from "./definition";
import type { CollectionNote } from "./collection";
import { collectionProfile } from "./collection-profile";
import { questionsContract } from "./questions";
import { suggestionsContract } from "./suggestions";
import { noteSource, propertiesSource, selectionSource, type SourceText } from "./sources";

const LABELS: Record<SourceName, string> = { note: "Note", selection: "Selection", properties: "Properties", "collection-profile": "Collection profile" };

export interface RequestMessages {
	system: string;
	user: string;
}

/** The prompt with each `{{name}}` replaced by the label chosen for that parameter. */
export function applyParams(prompt: string, labels: Record<string, string>): string {
	return Object.entries(labels).reduce((text, [name, label]) => text.replaceAll(`{{${name}}}`, label), prompt);
}

/** System = the action's prompt, then the output contract (last, so the prompt cannot override it). User = labelled sources. */
export function buildMessages(action: ActionDefinition, sources: SourceText[], labels: Record<string, string> = {}): RequestMessages {
	return {
		system: `${applyParams(action.prompt, labels)}\n\n${(action.output === "suggestions" ? suggestionsContract : questionsContract)(action.count)}`,
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
			case "collection-profile": {
				const type = values.type ?? "";
				return collectionProfile(input.collection, type, input.notInterested[type] ?? []).source;
			}
		}
	});
}

/** Why the action cannot run on these sources, or null. */
export function sourceProblem(sources: SourceText[]): string | null {
	if (sources.some((source) => source.name === "selection" && source.chars === 0)) return "Select some text first.";
	return sources.find((source) => source.problem)?.problem ?? null;
}
