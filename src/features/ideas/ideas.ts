// The ideas feature: wires the idea index and the editor capture. The portal and the hub page come later.
import type { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";

import type VaultMatePlugin from "../../main";
import { IdeaCaptureSuggest, plantIdea } from "./capture-suggest";
import { IdeaIndex } from "./idea-index";
import { canTrackAsIdea } from "./idea-line";

export class IdeasFeature {
	public readonly index: IdeaIndex;

	public constructor(private readonly plugin: VaultMatePlugin) {
		this.index = new IdeaIndex(plugin);
	}

	public enabled(): boolean {
		return this.plugin.settings.ideas.enabled;
	}

	public tag(): string {
		return this.plugin.settings.ideas.tag;
	}

	/** Call from `onload`: registers the index events; the first pass waits for the layout. */
	public register(): void {
		this.index.registerEvents();
		this.plugin.registerEditorSuggest(new IdeaCaptureSuggest(this.plugin.app, this));
		this.plugin.addCommand({
			id: "track-idea",
			name: "Track this line as an idea",
			icon: "lightbulb",
			editorCheckCallback: (checking, editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				const lineNo = editor.getCursor().line;
				if (!ctx.file || !this.enabled() || !canTrackAsIdea(editor.getLine(lineNo), this.tag())) return false;
				if (!checking) plantIdea(editor, lineNo, this.tag());
				return true;
			},
		});
		this.plugin.app.workspace.onLayoutReady(() => void this.index.sync());
	}

	/** Call after a setting changed: the index follows the tag and the on/off switch. */
	public onSettingsChanged(): void {
		void this.index.sync();
	}
}
