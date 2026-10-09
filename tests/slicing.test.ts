import { describe, expect, it } from "vitest";

import { mapLimit, yieldToEventLoop } from "../src/features/context/slicing";

describe("mapLimit", () => {
	it("keeps the order and never runs more than the limit at once", async () => {
		let running = 0;
		let peak = 0;
		const result = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
			running++;
			peak = Math.max(peak, running);
			await yieldToEventLoop();
			running--;
			return n * 2;
		});
		expect(result).toEqual([2, 4, 6, 8, 10, 12, 14]);
		expect(peak).toBe(3);
	});

	it("handles an empty list", async () => {
		expect(await mapLimit([], 5, (n: number) => Promise.resolve(n))).toEqual([]);
	});
});

describe("yieldToEventLoop", () => {
	it("lets queued work run before it resolves", async () => {
		const order: string[] = [];
		const pending = yieldToEventLoop().then(() => order.push("yield"));
		order.push("sync");
		await pending;
		expect(order).toEqual(["sync", "yield"]);
	});
});
