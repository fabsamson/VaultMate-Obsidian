import { describe, expect, it } from "vitest";

import { nextChoiceIndex } from "../src/ui/components";

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

	it("ignores other keys", () => {
		expect(nextChoiceIndex("a", 0, 3)).toBeNull();
		expect(nextChoiceIndex("Tab", 0, 3)).toBeNull();
	});
});
