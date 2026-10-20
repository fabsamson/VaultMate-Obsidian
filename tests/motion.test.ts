import { describe, expect, it } from "vitest";

import { LOOP_TICKS, SCENE_LAYERS, animationsEnabled, frameAt, sceneForHour, sceneSize, stampScale } from "../src/ui/motion";

describe("animationsEnabled", () => {
	it("needs the setting on and no reduced-motion preference", () => {
		expect(animationsEnabled(true, false)).toBe(true);
		expect(animationsEnabled(true, true)).toBe(false);
		expect(animationsEnabled(false, false)).toBe(false);
		expect(animationsEnabled(false, true)).toBe(false);
	});
});

describe("sceneForHour", () => {
	it("switches at 05:00, 11:00, 17:00 and 21:00", () => {
		const scenes = Array.from({ length: 24 }, (_, hour) => sceneForHour(hour));
		expect(scenes.slice(0, 5)).toEqual(Array(5).fill("night"));
		expect(scenes.slice(5, 11)).toEqual(Array(6).fill("morning"));
		expect(scenes.slice(11, 17)).toEqual(Array(6).fill("day"));
		expect(scenes.slice(17, 21)).toEqual(Array(4).fill("evening"));
		expect(scenes.slice(21)).toEqual(Array(3).fill("night"));
	});
});

describe("frameAt", () => {
	it("follows the frame order of each layer in a loop", () => {
		const frames = (kind: "sun" | "lanterns" | "stars", count: number): number[] => Array.from({ length: count }, (_, tick) => frameAt(kind, tick));
		expect(frames("sun", 8)).toEqual([1, 2, 3, 2, 1, 2, 3, 2]);
		expect(frames("lanterns", 7)).toEqual([1, 3, 2, 1, 2, 3, 1]);
		expect(frames("stars", 7)).toEqual([1, 1, 2, 2, 3, 3, 1]);
	});

	it("repeats exactly after LOOP_TICKS, so the counter can wrap", () => {
		expect(LOOP_TICKS).toBe(12);
		for (const kind of ["sun", "lanterns", "stars"] as const) {
			for (let tick = 0; tick < LOOP_TICKS; tick++) expect(frameAt(kind, tick + LOOP_TICKS)).toBe(frameAt(kind, tick));
		}
	});
});

describe("SCENE_LAYERS", () => {
	it("draws the sun by day, lanterns at dusk and stars under the lanterns at night", () => {
		expect(SCENE_LAYERS.morning).toEqual(["sun"]);
		expect(SCENE_LAYERS.day).toEqual(["sun"]);
		expect(SCENE_LAYERS.evening).toEqual(["lanterns"]);
		expect(SCENE_LAYERS.night).toEqual(["stars", "lanterns"]);
	});
});

describe("sceneSize", () => {
	it("keeps whole device pixels per source pixel", () => {
		for (const [width, ratio] of [[300, 1], [360, 2.39], [900, 1.5], [200, 3]] as const) {
			const size = sceneSize(width, ratio);
			const scale = (size.width * ratio) / 160;
			expect(scale).toBeCloseTo(Math.round(scale));
			expect((size.height * ratio) / 56).toBeCloseTo(scale);
		}
	});

	it("fits the width and stays a strip on a wide panel", () => {
		expect(sceneSize(300, 1)).toEqual({ width: 160, height: 56 });
		expect(sceneSize(400, 1)).toEqual({ width: 320, height: 112 });
		expect(sceneSize(2000, 1)).toEqual({ width: 320, height: 112 });
		const phone = sceneSize(360, 2.39);
		expect(phone.width).toBeLessThanOrEqual(360);
		expect(phone.height).toBeLessThanOrEqual(128);
	});

	it("never goes below one device pixel per source pixel", () => {
		expect(sceneSize(0, 1)).toEqual({ width: 160, height: 56 });
	});
});

describe("stampScale", () => {
	it("is a whole number of device pixels per source pixel within 112 CSS pixels", () => {
		expect(stampScale(1)).toBe(4);
		const scale = stampScale(2.39);
		expect(scale * 2.39).toBeCloseTo(Math.round(scale * 2.39));
		expect(scale * 28).toBeLessThanOrEqual(112);
	});
});
