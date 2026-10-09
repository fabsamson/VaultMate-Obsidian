// The glue between the vault and the pure context engine. The graph (links, tags, properties) comes
// straight from the MetadataCache at query time; the text index is built on the first query, in slices,
// cached per device in IndexedDB with each note's mtime, and then kept current from vault events.
import { debounce, getAllTags, normalizePath, TFile, type App, type TAbstractFile } from "obsidian";

import { openLocalCache, type LocalCache } from "../../core/local-cache";
import type VaultMatePlugin from "../../main";
import { findConnections, type Connection } from "./engine";
import { buildNoteMeta, isExcluded, type NoteMeta } from "./note-meta";
import { mapLimit, yieldToEventLoop } from "./slicing";
import { makeDoc, TextIndex, type DocText } from "./text-index";
import { tokenize } from "./tokenizer";

/** Change it when the stored `DocText` or the tokenizer changes: the cache is then dropped. */
const CACHE_VERSION = 2;
/** Files read at once. */
const READ_BATCH = 25;
/** Work done before giving the interface a turn, ms. */
const SLICE_BUDGET_MS = 12;
const REINDEX_DELAY_MS = 3000;

/** Numbers to measure the cost of the finder (no logging: read them from the feature object). */
export interface ContextStats {
	/** Notes in the text index now. */
	notesTotal: number;
	/** Notes read and tokenized by the last build. */
	notesIndexed: number;
	/** Notes taken from the IndexedDB cache by the last build (same mtime). */
	notesReused: number;
	/** Duration of the last build, ms. */
	buildMs: number;
	/** Duration of the last `connections` call, ms (index freshness checks included). */
	lastQueryMs: number;
	/** Part of the last query spent reading the MetadataCache into `NoteMeta`, ms. */
	lastMetaMs: number;
}

export interface BuildProgress {
	done: number;
	total: number;
}

function vaultId(app: App): string {
	return (app as unknown as { appId?: string }).appId ?? app.vault.getName();
}

export class ContextIndex {
	public readonly text = new TextIndex();
	public stats: ContextStats = { notesTotal: 0, notesIndexed: 0, notesReused: 0, buildMs: 0, lastQueryMs: 0, lastMetaMs: 0 };
	/** Progress of a build in flight, else null. */
	public building: BuildProgress | null = null;

	private cache: LocalCache<DocText> | null = null;
	private cacheTried = false;
	private running: Promise<void> | null = null;
	/** Excluded folders the index was built for; null before the first build. */
	private builtFor: string | null = null;
	private readonly pending = new Set<string>();
	private readonly flushSoon = debounce(() => void this.flush(), REINDEX_DELAY_MS, true);

	public constructor(private readonly plugin: VaultMatePlugin) {}

	private get app(): App {
		return this.plugin.app;
	}

	private excludedFolders(): string[] {
		return this.plugin.settings.context.excludedFolders.map(normalizePath);
	}

	/** Keeps the index current. Nothing is built here; it only reacts once a first build happened. */
	public registerEvents(): void {
		const { vault } = this.app;
		const { plugin } = this;
		plugin.registerEvent(vault.on("modify", (file) => this.queue(file)));
		plugin.registerEvent(vault.on("create", (file) => this.queue(file)));
		plugin.registerEvent(vault.on("delete", (file) => this.forget(file.path)));
		plugin.registerEvent(
			vault.on("rename", (file, oldPath) => {
				if (this.builtFor === null) return;
				const doc = this.text.doc(oldPath);
				this.forget(oldPath);
				if (file instanceof TFile && doc && this.shouldIndex(file)) void this.store(file, doc);
				else this.queue(file);
			}),
		);
	}

	private shouldIndex(file: TAbstractFile): file is TFile {
		return file instanceof TFile && file.extension === "md" && !isExcluded(file.path, this.excludedFolders());
	}

	private queue(file: TAbstractFile): void {
		if (this.builtFor === null || !this.plugin.settings.context.enabled || !this.shouldIndex(file)) return;
		this.pending.add(file.path);
		this.flushSoon();
	}

	private forget(path: string): void {
		this.pending.delete(path);
		if (this.builtFor === null || !this.text.doc(path)) return;
		this.text.remove(path);
		void this.cache?.delete([path]).catch(() => undefined);
	}

	private async store(file: TFile, doc: DocText): Promise<void> {
		this.text.put(file.path, doc, tokenize(file.basename));
		await this.cache?.putMany([[file.path, doc]]).catch(() => undefined);
	}

	/** Re-reads the notes that changed since the last flush. */
	public async flush(): Promise<void> {
		const paths = [...this.pending];
		this.pending.clear();
		for (const path of paths) {
			const file = this.app.vault.getFileByPath(path);
			if (file) await this.reindex(file);
		}
	}

	private async reindex(file: TFile): Promise<void> {
		const { mtime } = file.stat;
		await this.store(file, makeDoc(await this.app.vault.cachedRead(file), mtime));
	}

	/** Makes sure the text index exists and matches the exclusions; the first call builds it. */
	public ensure(): Promise<void> {
		const key = JSON.stringify(this.excludedFolders());
		if (this.running) return this.running;
		if (this.builtFor === key) return Promise.resolve();
		this.running = this.sync(key).finally(() => {
			this.running = null;
			this.building = null;
		});
		return this.running;
	}

	private async openCache(): Promise<Map<string, DocText>> {
		if (!this.cacheTried) {
			this.cacheTried = true;
			try {
				this.cache = await openLocalCache<DocText>(vaultId(this.app), "context", CACHE_VERSION);
			} catch {
				this.cache = null; // no IndexedDB: the index then lives in memory only
			}
		}
		try {
			return (await this.cache?.getAll()) ?? new Map();
		} catch {
			return new Map();
		}
	}

	private async sync(key: string): Promise<void> {
		const started = performance.now();
		const folders = this.excludedFolders();
		const files = this.app.vault.getMarkdownFiles().filter((file) => !isExcluded(file.path, folders));
		this.building = { done: 0, total: files.length };
		const cached = this.builtFor === null ? await this.openCache() : new Map<string, DocText>();
		const wanted = new Set(files.map((file) => file.path));
		const stale = [...new Set([...this.text.paths(), ...cached.keys()])].filter((path) => !wanted.has(path));
		for (const path of stale) this.text.remove(path);
		if (stale.length > 0) await this.cache?.delete(stale).catch(() => undefined);

		let indexed = 0;
		let reused = 0;
		let written: [string, DocText][] = [];
		let sliceStart = performance.now();
		for (let from = 0; from < files.length; from += READ_BATCH) {
			const batch = files.slice(from, from + READ_BATCH);
			// Only the notes that changed since the index or the cache saw them are read, a batch in parallel.
			const changed = batch.filter((file) => this.text.doc(file.path)?.mtime !== file.stat.mtime);
			const docs = await mapLimit(changed, READ_BATCH, async (file) => {
				const known = cached.get(file.path);
				if (known && known.mtime === file.stat.mtime) return known;
				return makeDoc(await this.app.vault.cachedRead(file), file.stat.mtime);
			});
			changed.forEach((file, position) => {
				const doc = docs[position];
				if (cached.get(file.path) === doc) {
					reused++;
				} else {
					indexed++;
					written.push([file.path, doc]);
				}
				this.text.put(file.path, doc, tokenize(file.basename));
			});
			if (performance.now() - sliceStart >= SLICE_BUDGET_MS) {
				await this.cache?.putMany(written).catch(() => undefined);
				written = [];
				this.building = { done: Math.min(from + READ_BATCH, files.length), total: files.length };
				await yieldToEventLoop();
				sliceStart = performance.now();
			}
		}
		await this.cache?.putMany(written).catch(() => undefined);
		this.builtFor = key;
		this.stats = { ...this.stats, notesTotal: this.text.size, notesIndexed: indexed, notesReused: reused, buildMs: performance.now() - started };
	}

	/** The graph of every suggestable note, read from the MetadataCache; the active note is always in it. */
	private snapshot(active: TFile): Map<string, NoteMeta> {
		const { vault, metadataCache } = this.app;
		const { context, location } = this.plugin.settings;
		const options = { peopleProperties: context.peopleProperties, latitudeProperty: location.latitudeProperty, longitudeProperty: location.longitudeProperty };
		const folders = this.excludedFolders();
		const notes = new Map<string, NoteMeta>();
		for (const file of vault.getMarkdownFiles()) {
			if (file.path !== active.path && isExcluded(file.path, folders)) continue;
			const cache = metadataCache.getFileCache(file);
			notes.set(
				file.path,
				buildNoteMeta(
					{
						path: file.path,
						links: Object.keys(metadataCache.resolvedLinks[file.path] ?? {}).filter((path) => path.endsWith(".md")),
						tags: cache ? (getAllTags(cache) ?? []) : [],
						frontmatter: cache?.frontmatter,
					},
					options,
				),
			);
		}
		return notes;
	}

	public async connections(file: TFile, limit: number): Promise<Connection[]> {
		const started = performance.now();
		await this.ensure();
		await this.flush();
		if (this.text.doc(file.path)?.mtime !== file.stat.mtime) await this.reindex(file);
		const metaStarted = performance.now();
		const notes = this.snapshot(file);
		this.stats.lastMetaMs = performance.now() - metaStarted;
		const { vault } = this.app;
		const found = await findConnections({
			active: file.path,
			notes,
			text: this.text,
			limit,
			readText: async (path) => {
				const note = vault.getFileByPath(path);
				return note ? vault.cachedRead(note) : "";
			},
		});
		this.stats.lastQueryMs = performance.now() - started;
		return found;
	}
}
