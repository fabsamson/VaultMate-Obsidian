// The journal index: every decision and prediction entry of the vault, kept current from the metadata
// cache by the shared tagged-line index.
import { TaggedLineIndex } from "../../core/tagged-line-index";
import { isTagOrSubtag } from "../../core/task-line";
import type VaultMatePlugin from "../../main";
import { classifyLine, type JournalEntry, type JournalTags } from "./journal-line";
import { getChildren } from "./journal-note";

/** An entry with its place in the vault. L1.B reads these. */
export interface JournalItem {
	path: string;
	/** 0-based line number at the time the note was indexed. */
	line: number;
	/** The line as read; a write refuses to touch the note when the line no longer equals this text. */
	raw: string;
	entry: JournalEntry;
	/** Text of the sub-items (Why, Expected, Signals, earlier reviews), without list markers. */
	children: string[];
}

/** Whether a cached tag (`#decision`, `#Decision/work`) is one of the journal tags. */
export function isJournalTag(tag: string, tags: JournalTags): boolean {
	return isTagOrSubtag(tag, tags.decisionTag) || isTagOrSubtag(tag, tags.predictionTag);
}

export class JournalIndex extends TaggedLineIndex<JournalItem> {
	public constructor(plugin: VaultMatePlugin) {
		super(plugin, {
			enabled: () => plugin.settings.journal.enabled,
			key: () => `${plugin.settings.journal.decisionTag}
${plugin.settings.journal.predictionTag}`,
			isTag: (tag) => isJournalTag(tag, plugin.settings.journal),
			parse: (path, line, raw, lines) => {
				const cls = classifyLine(raw, plugin.settings.journal);
				return cls?.type === "entry" ? { path, line, raw, entry: cls.entry, children: getChildren(lines, line).items } : null;
			},
		});
	}

	public entries(): JournalItem[] {
		return this.items();
	}
}
