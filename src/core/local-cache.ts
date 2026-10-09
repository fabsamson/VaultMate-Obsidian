// A small per-device IndexedDB store for caches that must never be synced (Syncthing shares the plugin
// folder, so nothing rebuildable goes in data.json). One database per vault and per cache name; a
// schema version change clears the store, because a cache can always be rebuilt.

export interface LocalCache<T> {
	/** Every entry, by key. */
	getAll(): Promise<Map<string, T>>;
	putMany(entries: Iterable<[string, T]>): Promise<void>;
	delete(keys: Iterable<string>): Promise<void>;
	clear(): Promise<void>;
	close(): void;
}

const STORE = "entries";

/** Database name: unique per vault (the vault id Obsidian gives, or its name) and per cache. */
export function cacheDatabaseName(vaultId: string, cacheName: string): string {
	return `vaultmate-${cacheName}-${vaultId}`;
}

function request<R>(req: IDBRequest<R>): Promise<R> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
	});
}

function transactionDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
		tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
	});
}

function open(factory: IDBFactory, name: string, version: number): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = factory.open(name, version);
		req.onupgradeneeded = () => {
			// A new database or an older schema: start from an empty store.
			const db = req.result;
			if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
			db.createObjectStore(STORE);
		};
		req.onsuccess = () => {
			// A newer schema (the plugin was updated and reloaded) needs this connection gone, or its open never completes.
			const db = req.result;
			db.onversionchange = () => db.close();
			resolve(db);
		};
		req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
		req.onblocked = () => reject(new Error("IndexedDB open blocked"));
	});
}

/**
 * Opens (or creates) the cache. A database written by a newer schema (version higher than asked) is
 * deleted and recreated. Rejects when IndexedDB is unavailable; callers then work without a cache.
 */
export async function openLocalCache<T>(vaultId: string, cacheName: string, version: number, factory: IDBFactory = indexedDB): Promise<LocalCache<T>> {
	const name = cacheDatabaseName(vaultId, cacheName);
	let db: IDBDatabase;
	try {
		db = await open(factory, name, version);
	} catch (error) {
		if (!(error instanceof DOMException && error.name === "VersionError")) throw error;
		await request(factory.deleteDatabase(name));
		db = await open(factory, name, version);
	}
	const store = (mode: IDBTransactionMode): { tx: IDBTransaction; store: IDBObjectStore } => {
		const tx = db.transaction(STORE, mode);
		return { tx, store: tx.objectStore(STORE) };
	};
	return {
		async getAll() {
			const { store: s } = store("readonly");
			const [keys, values] = await Promise.all([request(s.getAllKeys()), request(s.getAll())]);
			const all = new Map<string, T>();
			keys.forEach((key, index) => all.set(key as string, values[index] as T));
			return all;
		},
		async putMany(entries) {
			const { tx, store: s } = store("readwrite");
			for (const [key, value] of entries) s.put(value, key);
			await transactionDone(tx);
		},
		async delete(keys) {
			const { tx, store: s } = store("readwrite");
			for (const key of keys) s.delete(key);
			await transactionDone(tx);
		},
		async clear() {
			const { tx, store: s } = store("readwrite");
			s.clear();
			await transactionDone(tx);
		},
		close: () => db.close(),
	};
}
