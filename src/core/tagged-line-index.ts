// An index of the tagged lines of the vault, kept current from the metadata cache. Only notes whose
// cached tags include a wanted tag are read (so code blocks are skipped: the cache only reports real
// tags), and only the tagged lines are parsed. The decision journal and the ideas share this rule; each
// one supplies what a tag, a line and an item are (`TaggedLineSource`).
import { debounce, TFile, type EventRef } from "obsidian";

import type VaultMatePlugin from "../main";

export interface TaggedLineSource<T extends { path: string }> {
	/** Whether the feature is on; the index stays empty when it is not. */
	enabled(): boolean;
	/** Changes when the index must be rebuilt (the tag names). */
	key(): string;
	/** Whether a cached tag (`#idea`, `#Idea/work`) is one the feature wants. */
	isTag(tag: string): boolean;
	/** The item for one tagged line, or null when the line is not one. `lines` is the whole note. */
	parse(file: TFile, line: number, raw: string, lines: readonly string[]): T | null;
}

export class TaggedLineIndex<T extends { path: string }> {
	private readonly byPath = new Map<string, T[]>();
	private readonly listeners = new Set<() => void>();
	private readonly versions = new Map<string, number>();
	private builtFor = "";
	private built = false;
	private readonly notify = debounce(() => this.listeners.forEach((listener) => listener()), 200, true);

	public constructor(
		private readonly plugin: VaultMatePlugin,
		private readonly source: TaggedLineSource<T>,
	) {}

	/** True once the first full pass finished (after the layout is ready). */
	public get ready(): boolean {
		return this.built;
	}

	/** Registers the vault events; the index stays empty until `sync` runs. */
	public registerEvents(): void {
		const { vault, metadataCache } = this.plugin.app;
		const track = (ref: EventRef): void => this.plugin.registerEvent(ref);
		track(metadataCache.on("changed", (file) => void this.indexFile(file)));
		track(
			vault.on("delete", (file) => {
				if (file instanceof TFile && this.byPath.delete(file.path)) this.notify();
			}),
		);
		track(
			vault.on("rename", (file, oldPath) => {
				const items = this.byPath.get(oldPath);
				if (!(file instanceof TFile) || !items) return;
				this.byPath.delete(oldPath);
				this.byPath.set(file.path, items.map((item) => ({ ...item, path: file.path })));
				this.notify();
			}),
		);
	}

	/** Builds the index, or empties it when the feature is off; rebuilds when the key changed. */
	public async sync(): Promise<void> {
		if (!this.source.enabled()) {
			this.byPath.clear();
			this.built = false;
			this.builtFor = "";
			this.notify();
			return;
		}
		const key = this.source.key();
		if (this.built && key === this.builtFor) return;
		this.builtFor = key;
		this.byPath.clear();
		await Promise.all(this.plugin.app.vault.getMarkdownFiles().map((file) => this.indexFile(file, false)));
		this.built = true;
		this.notify();
	}

	public items(): T[] {
		return [...this.byPath.values()].flat();
	}

	public forFile(path: string): T[] {
		return this.byPath.get(path) ?? [];
	}

	/** Calls `listener` (debounced) whenever the index changed; returns a function that stops it. */
	public onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private async indexFile(file: TFile, notify = true): Promise<void> {
		if (!this.source.enabled() || (notify && this.builtFor === "") || file.extension !== "md") return;
		const version = (this.versions.get(file.path) ?? 0) + 1;
		this.versions.set(file.path, version);
		const lines = new Set<number>();
		for (const tag of this.plugin.app.metadataCache.getFileCache(file)?.tags ?? []) {
			if (this.source.isTag(tag.tag)) lines.add(tag.position.start.line);
		}
		let items: T[] = [];
		if (lines.size > 0) {
			const text = await this.plugin.app.vault.cachedRead(file);
			if (this.versions.get(file.path) !== version) return; // a newer pass owns this note
			const all = text.split(/\r?\n/);
			items = [...lines]
				.sort((a, b) => a - b)
				.flatMap((line) => {
					const item = this.source.parse(file, line, all[line] ?? "", all);
					return item ? [item] : [];
				});
		}
		if (items.length > 0) this.byPath.set(file.path, items);
		else this.byPath.delete(file.path);
		if (notify) this.notify();
	}
}
