import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import { cacheDatabaseName, openLocalCache } from "../src/core/local-cache";

describe("local cache", () => {
	it("derives a database name per vault and per cache", () => {
		expect(cacheDatabaseName("abc", "context")).not.toBe(cacheDatabaseName("def", "context"));
		expect(cacheDatabaseName("abc", "context")).not.toBe(cacheDatabaseName("abc", "other"));
	});

	it("puts, reads, deletes and clears entries", async () => {
		const cache = await openLocalCache<{ n: number; m: Map<string, number> }>("v", "t", 1, new IDBFactory());
		expect((await cache.getAll()).size).toBe(0);
		await cache.putMany([
			["a.md", { n: 1, m: new Map([["x", 2]]) }],
			["b.md", { n: 2, m: new Map() }],
		]);
		const all = await cache.getAll();
		expect([...all.keys()].sort()).toEqual(["a.md", "b.md"]);
		expect(all.get("a.md")?.m.get("x")).toBe(2);
		await cache.putMany([["a.md", { n: 9, m: new Map() }]]);
		expect((await cache.getAll()).get("a.md")?.n).toBe(9);
		await cache.delete(["a.md"]);
		expect([...(await cache.getAll()).keys()]).toEqual(["b.md"]);
		await cache.clear();
		expect((await cache.getAll()).size).toBe(0);
	});

	it("keeps the data across opens with the same version", async () => {
		const factory = new IDBFactory();
		const first = await openLocalCache<number>("v", "t", 1, factory);
		await first.putMany([["k", 7]]);
		first.close();
		const second = await openLocalCache<number>("v", "t", 1, factory);
		expect((await second.getAll()).get("k")).toBe(7);
	});

	it("clears the store when the schema version changes, in either direction", async () => {
		const factory = new IDBFactory();
		const v2 = await openLocalCache<number>("v", "t", 2, factory);
		await v2.putMany([["k", 1]]);
		v2.close();
		const v3 = await openLocalCache<number>("v", "t", 3, factory);
		expect((await v3.getAll()).size).toBe(0);
		await v3.putMany([["k", 1]]);
		v3.close();
		const back = await openLocalCache<number>("v", "t", 1, factory);
		expect((await back.getAll()).size).toBe(0);
	});

	it("keeps vaults apart", async () => {
		const factory = new IDBFactory();
		const one = await openLocalCache<number>("one", "t", 1, factory);
		await one.putMany([["k", 1]]);
		const two = await openLocalCache<number>("two", "t", 1, factory);
		expect((await two.getAll()).size).toBe(0);
	});
});
