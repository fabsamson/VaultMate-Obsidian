// The project-note index: the notes whose cached headings include a Tracks section. It is built from the
// metadata cache alone (no note is read), so it stays cheap; a note is read and parsed only on demand.
// No folder or tag is hard-coded: a project note is a note that has a Tracks section.
import { debounce, TFile, type EventRef } from "obsidian";

import type VaultMatePlugin from "../../main";
import { isTracksHeading, readProject, type ProjectModel } from "./project-note";

export interface ProjectNote {
	path: string;
	/** File name without extension. */
	name: string;
}

/** A project note read from the vault: its lines (no line breaks) and the parsed model. */
export interface ProjectContent extends ProjectNote {
	lines: string[];
	model: ProjectModel;
}

export class ProjectIndex {
	private readonly byPath = new Map<string, ProjectNote>();
	private readonly listeners = new Set<() => void>();
	private built = false;
	private readonly notify = debounce(() => this.listeners.forEach((listener) => listener()), 200, true);

	public constructor(private readonly plugin: VaultMatePlugin) {}

	/** True once the first full pass finished (after the layout is ready). */
	public get ready(): boolean {
		return this.built;
	}

	/** Registers the vault events; the index stays empty until `sync` runs. */
	public registerEvents(): void {
		const { vault, metadataCache } = this.plugin.app;
		const track = (ref: EventRef): void => this.plugin.registerEvent(ref);
		track(metadataCache.on("changed", (file) => this.update(file, true)));
		track(
			vault.on("delete", (file) => {
				if (this.byPath.delete(file.path)) this.notify();
			}),
		);
		track(
			vault.on("rename", (file, oldPath) => {
				if (!(file instanceof TFile) || !this.byPath.delete(oldPath)) return;
				this.byPath.set(file.path, { path: file.path, name: file.basename });
				this.notify();
			}),
		);
	}

	/** Builds the index, or empties it when the feature is off. */
	public sync(): void {
		this.byPath.clear();
		this.built = false;
		if (this.plugin.settings.projects.enabled) {
			for (const file of this.plugin.app.vault.getMarkdownFiles()) this.update(file, false);
			this.built = true;
		}
		this.notify();
	}

	/** The project notes, sorted by name. */
	public notes(): ProjectNote[] {
		return [...this.byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
	}

	public has(path: string): boolean {
		return this.byPath.has(path);
	}

	/** Calls `listener` (debounced) whenever the set of project notes changed; returns a function that stops it. */
	public onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Reads and parses one project note; null when the file is gone. */
	public async read(path: string): Promise<ProjectContent | null> {
		const file = this.plugin.app.vault.getFileByPath(path);
		if (!file) return null;
		const lines = (await this.plugin.app.vault.cachedRead(file)).split(/\r?\n/);
		return { path: file.path, name: file.basename, lines, model: readProject(lines) };
	}

	private update(file: TFile, notify: boolean): void {
		if (!this.plugin.settings.projects.enabled || (notify && !this.built) || file.extension !== "md") return;
		const headings = this.plugin.app.metadataCache.getFileCache(file)?.headings ?? [];
		const isProject = headings.some((heading) => isTracksHeading(heading.heading));
		const changed = isProject ? !this.byPath.has(file.path) || this.byPath.get(file.path)?.name !== file.basename : this.byPath.delete(file.path);
		if (isProject) this.byPath.set(file.path, { path: file.path, name: file.basename });
		if (notify && changed) this.notify();
	}
}
