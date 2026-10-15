// The project-note index: the notes whose cached headings include a Tracks section. It is built from the
// metadata cache alone (no note is read), so it stays cheap; a note is read and parsed only on demand.
// No folder or tag is hard-coded: a project note is a note that has a Tracks section.
import { debounce, TFile, type EventRef } from "obsidian";

import type VaultMatePlugin from "../../main";
import { hasTracksSection, readProject, trackCounts, type ProjectModel } from "./project-note";
import { projectTags, type ProjectCounts } from "./projects-model";

export interface ProjectNote extends ProjectCounts {
	path: string;
	/** File name without extension. */
	name: string;
}

/** A project note read from the vault: its lines (no line breaks) and the parsed model. */
export interface ProjectContent {
	path: string;
	name: string;
	lines: string[];
	model: ProjectModel;
}

export class ProjectIndex {
	private readonly byPath = new Map<string, ProjectNote>();
	private readonly listeners = new Set<() => void>();
	private readonly versions = new Map<string, number>();
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
		track(metadataCache.on("changed", (file) => void this.update(file, true)));
		track(
			vault.on("delete", (file) => {
				if (this.byPath.delete(file.path)) this.notify();
			}),
		);
		track(
			vault.on("rename", (file, oldPath) => {
				const entry = this.byPath.get(oldPath);
				if (!(file instanceof TFile) || !entry) return;
				this.byPath.delete(oldPath);
				this.byPath.set(file.path, { ...entry, path: file.path, name: file.basename });
				this.notify();
			}),
		);
	}

	/** Builds the index, or empties it when the feature is off. */
	public async sync(): Promise<void> {
		this.byPath.clear();
		this.built = false;
		if (this.plugin.settings.projects.enabled) {
			await Promise.all(this.plugin.app.vault.getMarkdownFiles().map((file) => this.update(file, false)));
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
		return { path: file.path, name: file.basename, lines, model: readProject(lines, projectTags(this.plugin.settings)) };
	}

	/** Reads the note when its cached headings show a Tracks section, to count its tracks and ideas. */
	private async update(file: TFile, notify: boolean): Promise<void> {
		if (!this.plugin.settings.projects.enabled || (notify && !this.built) || file.extension !== "md") return;
		const version = (this.versions.get(file.path) ?? 0) + 1;
		this.versions.set(file.path, version);
		const headings = this.plugin.app.metadataCache.getFileCache(file)?.headings ?? [];
		if (!hasTracksSection(headings.map((heading) => ({ text: heading.heading, level: heading.level })))) {
			if (this.byPath.delete(file.path) && notify) this.notify();
			return;
		}
		const lines = (await this.plugin.app.vault.cachedRead(file)).split(/\r?\n/);
		if (this.versions.get(file.path) !== version) return; // a newer pass owns this note
		const model = readProject(lines, projectTags(this.plugin.settings));
		if (!model.tracksSection) {
			if (this.byPath.delete(file.path) && notify) this.notify();
			return;
		}
		this.byPath.set(file.path, { path: file.path, name: file.basename, tracks: trackCounts(model.tracks), ideas: model.ideas.length });
		if (notify) this.notify();
	}
}
