// The idea index: every line with the idea tag in the vault, kept current from the metadata cache by the
// shared tagged-line index. A "Idea:" prose line carries no tag, so it is not indexed (by design).
import { formatDate } from "../../core/dates";
import { TaggedLineIndex } from "../../core/tagged-line-index";
import { isTagOrSubtag } from "../../core/task-line";
import type VaultMatePlugin from "../../main";
import { buildIdeaItem, type IdeaItem } from "./idea-line";

export class IdeaIndex extends TaggedLineIndex<IdeaItem> {
	public constructor(plugin: VaultMatePlugin) {
		super(plugin, {
			enabled: () => plugin.settings.ideas.enabled,
			key: () => plugin.settings.ideas.tag,
			isTag: (tag) => isTagOrSubtag(tag, plugin.settings.ideas.tag),
			parse: (file, line, _raw, lines) =>
				buildIdeaItem(file.path, file.basename, formatDate(new Date(file.stat.ctime)), line, lines, plugin.settings.ideas.tag),
		});
	}
}
