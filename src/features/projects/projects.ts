// The projects feature: tracks and ideas of the project notes. This lot wires the settings and the index;
// the page, the dialogs and the commands come with the next one.
import type VaultMatePlugin from "../../main";
import { ProjectIndex } from "./project-index";

export class ProjectsFeature {
	public readonly index: ProjectIndex;

	public constructor(private readonly plugin: VaultMatePlugin) {
		this.index = new ProjectIndex(plugin);
	}

	public enabled(): boolean {
		return this.plugin.settings.projects.enabled;
	}

	/** Title of the Tracks section created in a note that has none. */
	public tracksTitle(): string {
		return this.plugin.settings.projects.tracksTitle;
	}

	/** Call from `onload`: registers the index events; the first pass waits for the layout. */
	public register(): void {
		this.index.registerEvents();
		this.plugin.app.workspace.onLayoutReady(() => this.index.sync());
	}

	/** Call after a setting changed: the index follows the on/off switch. */
	public onSettingsChanged(): void {
		if (this.enabled() !== this.index.ready) this.index.sync();
	}
}
