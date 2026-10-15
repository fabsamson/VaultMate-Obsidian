import { describe, expect, it } from "vitest";

import { shortName } from "../src/features/projects/short-name";

// The table shared with the Android app: the same cases, the same expected text.
const raw = import.meta.glob<string>("./fixtures/short-name-cases.json", { query: "?raw", import: "default", eager: true });
const cases = JSON.parse(Object.values(raw)[0] ?? "[]") as Array<{ input: string; max: number; expected: string }>;

describe("shortName", () => {
	it("loads the shared table", () => {
		expect(cases.length).toBeGreaterThan(10);
	});

	it.each(cases.map((entry, index) => ({ index, ...entry })))("shared case $index", ({ input, max, expected }) => {
		expect(shortName(input, max)).toBe(expected);
	});

	it("defaults to 80 code points", () => {
		expect(Array.from(shortName("a".repeat(100))).length).toBe(80);
	});
});
