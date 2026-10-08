import { describe, expect, it } from "vitest";

import { crispSpriteSize } from "../src/ui/pixel";

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
