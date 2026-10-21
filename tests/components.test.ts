import { describe, expect, it } from "vitest";

import { nextChoiceIndex } from "../src/ui/choice-keys";

describe("nextChoiceIndex", () => {
	it("moves with the arrow keys and wraps around", () => {
		expect(nextChoiceIndex("ArrowRight", 0, 3)).toBe(1);
		expect(nextChoiceIndex("ArrowDown", 2, 3)).toBe(0);
		expect(nextChoiceIndex("ArrowLeft", 1, 3)).toBe(0);
		expect(nextChoiceIndex("ArrowUp", 0, 3)).toBe(2);
	});

	it("jumps with Home and End", () => {
		expect(nextChoiceIndex("Home", 2, 5)).toBe(0);
		expect(nextChoiceIndex("End", 0, 5)).toBe(4);
	});

	it("skips disabled options, wrapping around", () => {
		const disabled = [false, true, false];
		expect(nextChoiceIndex("ArrowRight", 0, 3, disabled)).toBe(2);
		expect(nextChoiceIndex("ArrowRight", 2, 3, disabled)).toBe(0);
		expect(nextChoiceIndex("ArrowLeft", 2, 3, disabled)).toBe(0);
		expect(nextChoiceIndex("ArrowLeft", 0, 3, disabled)).toBe(2);
	});

	it("sends Home and End to the first and last enabled option", () => {
		const disabled = [true, false, false, true];
		expect(nextChoiceIndex("Home", 2, 4, disabled)).toBe(1);
		expect(nextChoiceIndex("End", 1, 4, disabled)).toBe(2);
	});

	it("stays put when it is the only enabled option, and returns null when none is", () => {
		expect(nextChoiceIndex("ArrowDown", 1, 3, [true, false, true])).toBe(1);
		expect(nextChoiceIndex("Home", 0, 2, [true, true])).toBeNull();
	});

	it("ignores other keys", () => {
		expect(nextChoiceIndex("a", 0, 3)).toBeNull();
		expect(nextChoiceIndex("Tab", 0, 3)).toBeNull();
	});
});
