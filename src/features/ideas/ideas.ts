// The ideas feature: wires the idea index. The editor capture, the portal and the hub page come later.
import type VaultMatePlugin from "../../main";
import { IdeaIndex } from "./idea-index";

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
		this.plugin.app.workspace.onLayoutReady(() => void this.index.sync());
	}

	/** Call after a setting changed: the index follows the tag and the on/off switch. */
	public onSettingsChanged(): void {
		void this.index.sync();
	}
}
