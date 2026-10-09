// The messages of one request. Pure: the preview shows the sizes of exactly these texts.
import type { ActionDefinition, SourceName } from "./definition";
import { questionsContract } from "./questions";
import type { SourceText } from "./sources";

const LABELS: Record<SourceName, string> = { note: "Note", selection: "Selection", properties: "Properties" };

export interface RequestMessages {
	system: string;
	user: string;
}

/** System = the action's prompt, then the output contract (last, so the prompt cannot override it). User = labelled sources. */
export function buildMessages(action: ActionDefinition, sources: SourceText[]): RequestMessages {
	return {
		system: `${action.prompt}\n\n${questionsContract(action.count)}`,
		user: sources.map((source) => `### ${LABELS[source.name]}\n${source.text}`).join("\n\n"),
	};
}
