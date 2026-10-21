import { describe, expect, it } from "vitest";

import { crispSpriteSize, nearestCrispSize } from "../src/ui/pixel";

describe("nearestCrispSize", () => {
	it("may round up, so a mark does not shrink to one sprite pixel per device pixel", () => {
		// 18 CSS px at 1.44 = 25.9 device px: x2 (32 device px, 22.2 CSS px) is nearer than x1 (11.1 CSS px).
		expect(nearestCrispSize(16, 18, 1.44)).toBeCloseTo(22.2, 1);
		// At 2.39 (the test phone): x3, about 20 CSS px.
		expect(nearestCrispSize(16, 18, 2.39) * 2.39).toBeCloseTo(48);
	});

	it("keeps the natural size when it is the nearest", () => {
		expect(nearestCrispSize(16, 18, 1)).toBe(16);
		expect(nearestCrispSize(16, 18, 2)).toBe(16);
	});
});

describe("crispSpriteSize", () => {
	it("uses the largest whole device-pixel scale that fits", () => {
		// 96 CSS px at DPR 2 = 192 device px: a 48 px sprite fits at x4.
		expect(crispSpriteSize(48, 96, 2)).toBe(96);
	});

	it("keeps whole device pixels on a fractional density", () => {
		// 96 CSS px at DPR 2.39 = 229 device px: x4 = 192 device px, about 80.3 CSS px.
		const size = crispSpriteSize(48, 96, 2.39);
		expect(size * 2.39).toBeCloseTo(192);
		expect(size).toBeLessThanOrEqual(96);
	});

	it("never scales below one device pixel per sprite pixel", () => {
		expect(crispSpriteSize(48, 10, 1)).toBe(48);
	});
});
