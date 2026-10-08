// The journal index: every decision and prediction entry of the vault, kept current from the metadata
// cache. Only notes whose cached tags include a journal tag are read (so code blocks are skipped: the
// cache only reports real tags), and only the tagged lines are parsed.
import { debounce, TFile, type EventRef } from "obsidian";

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
	const name = tag.replace(/^#/, "").toLowerCase();
	return [tags.decisionTag, tags.predictionTag].some((wanted) => name === wanted.toLowerCase() || name.startsWith(`${wanted.toLowerCase()}/`));
}

export class JournalIndex {
	private readonly byPath = new Map<string, JournalItem[]>();
	private readonly listeners = new Set<() => void>();
	private readonly versions = new Map<string, number>();
	private builtFor = "";
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

	/** Builds the index, or empties it when the journal is off; rebuilds when the tag names changed. */
	public async sync(): Promise<void> {
		const { journal } = this.plugin.settings;
		if (!journal.enabled) {
			this.byPath.clear();
			this.built = false;
			this.builtFor = "";
			this.notify();
			return;
		}
		const key = `${journal.decisionTag}\n${journal.predictionTag}`;
		if (this.built && key === this.builtFor) return;
		this.builtFor = key;
		this.byPath.clear();
		await Promise.all(this.plugin.app.vault.getMarkdownFiles().map((file) => this.indexFile(file, false)));
		this.built = true;
		this.notify();
	}

	public entries(): JournalItem[] {
		return [...this.byPath.values()].flat();
	}

	public forFile(path: string): JournalItem[] {
		return this.byPath.get(path) ?? [];
	}

	/** Calls `listener` (debounced) whenever the index changed; returns a function that stops it. */
	public onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private async indexFile(file: TFile, notify = true): Promise<void> {
		const { journal } = this.plugin.settings;
		if (!journal.enabled || (notify && this.builtFor === "") || file.extension !== "md") return;
		const version = (this.versions.get(file.path) ?? 0) + 1;
		this.versions.set(file.path, version);
		const lines = new Set<number>();
		for (const tag of this.plugin.app.metadataCache.getFileCache(file)?.tags ?? []) {
			if (isJournalTag(tag.tag, journal)) lines.add(tag.position.start.line);
		}
		let items: JournalItem[] = [];
		if (lines.size > 0) {
			const text = await this.plugin.app.vault.cachedRead(file);
			if (this.versions.get(file.path) !== version) return; // a newer pass owns this note
			const all = text.split(/\r?\n/);
			items = [...lines]
				.sort((a, b) => a - b)
				.flatMap((line) => {
					const raw = all[line] ?? "";
					const cls = classifyLine(raw, journal);
					return cls?.type === "entry" ? [{ path: file.path, line, raw, entry: cls.entry, children: getChildren(all, line).items }] : [];
				});
		}
		if (items.length > 0) this.byPath.set(file.path, items);
		else this.byPath.delete(file.path);
		if (notify) this.notify();
	}
}
