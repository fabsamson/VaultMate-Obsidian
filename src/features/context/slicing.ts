// Helpers to run a long job without freezing the interface. Pure: no `obsidian` import.

/**
 * Lets the event loop run (rendering, input), then continues. A timer would not do: Chromium throttles
 * `setTimeout(0)` to about one per second in a hidden or background window; a message round trip is not
 * throttled.
 */
export function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = () => {
			channel.port1.close();
			resolve();
		};
		channel.port2.postMessage(null);
	});
}

/** `fn` on every item, at most `limit` at a time; results keep the order of the items. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	const worker = async (): Promise<void> => {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}
