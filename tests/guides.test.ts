import { describe, expect, it, vi } from "vitest";

// The guides draw with Obsidian components; only their data is read here.
vi.mock("obsidian", () => ({ Menu: class {}, Modal: class {}, SearchComponent: class {}, Platform: { isMobile: false }, displayTooltip: () => undefined, setTooltip: () => undefined, setIcon: () => undefined }));

import { CHAPTERS } from "../src/ui/guide/chapters";
import { GUIDE_LIMITS, plainText } from "../src/ui/guide/guide";
import { GUIDES } from "../src/ui/guide/registry";

describe("page guides", () => {
	it("registers the written guides under stable ids", () => {
		expect([...GUIDES.keys()].sort()).toEqual(["connections", "ideas", "project", "projects"]);
		for (const [id, guide] of GUIDES) expect(guide.id).toBe(id);
	});

	for (const [id, guide] of GUIDES) {
		describe(id, () => {
			it("keeps every part short enough to stay airy", () => {
				expect(guide.purpose.length).toBeLessThanOrEqual(GUIDE_LIMITS.purpose);
				expect(guide.write.caption.length).toBeLessThanOrEqual(GUIDE_LIMITS.caption);
				expect(guide.write.lines.length).toBeLessThanOrEqual(GUIDE_LIMITS.lines);
				for (const step of guide.steps) {
					expect(step.when.length).toBeLessThanOrEqual(GUIDE_LIMITS.when);
					expect(plainText(step.text).length).toBeLessThanOrEqual(GUIDE_LIMITS.stepText);
				}
				for (const tip of guide.tips) expect(tip.length).toBeLessThanOrEqual(GUIDE_LIMITS.tip);
			});

			it("closes every bold mark and tells the story in the second person", () => {
				for (const step of guide.steps) {
					expect(step.text.split("**").length % 2).toBe(1);
					expect(step.text).not.toMatch(new RegExp("\\b(he|she|his|her|him)\\b", "i"));
				}
			});

			it("is a chapter of the book", () => {
				expect(CHAPTERS.some((chapter) => chapter.id === id)).toBe(true);
			});

			it("has 3 or 4 steps and 2 or 3 tips", () => {
				expect(guide.steps.length).toBeGreaterThanOrEqual(3);
				expect(guide.steps.length).toBeLessThanOrEqual(4);
				expect(guide.tips.length).toBeGreaterThanOrEqual(2);
				expect(guide.tips.length).toBeLessThanOrEqual(3);
			});

			it("links to the README with an anchor", () => {
				expect(guide.readme).toMatch(/^https:\/\/github\.com\/fabsamson\/VaultMate-Obsidian#[a-z-]+$/);
			});
		});
	}
});
