import { describe, expect, it, vi } from "vitest";

// The guides draw with Obsidian components; only their data is read here.
vi.mock("obsidian", () => ({ Menu: class {}, Modal: class {}, SearchComponent: class {}, Platform: { isMobile: false }, displayTooltip: () => undefined, setTooltip: () => undefined, setIcon: () => undefined }));

import { GUIDE_LIMITS } from "../src/ui/guide/guide";
import { GUIDES } from "../src/ui/guide/registry";

describe("page guides", () => {
	it("registers the pilot guides under stable ids", () => {
		expect([...GUIDES.keys()].sort()).toEqual(["project", "projects"]);
		for (const [id, guide] of GUIDES) expect(guide.id).toBe(id);
	});

	for (const [id, guide] of GUIDES) {
		describe(id, () => {
			it("keeps every part short enough to stay airy", () => {
				expect(guide.title.length).toBeLessThanOrEqual(GUIDE_LIMITS.title);
				expect(guide.purpose.length).toBeLessThanOrEqual(GUIDE_LIMITS.purpose);
				expect(guide.write.caption.length).toBeLessThanOrEqual(GUIDE_LIMITS.caption);
				expect(guide.write.lines.length).toBeLessThanOrEqual(GUIDE_LIMITS.lines);
				expect(guide.cat.bubble.length).toBeLessThanOrEqual(GUIDE_LIMITS.bubble);
				for (const step of guide.steps) {
					expect(step.title.length).toBeLessThanOrEqual(GUIDE_LIMITS.stepTitle);
					expect(step.text.length).toBeLessThanOrEqual(GUIDE_LIMITS.stepText);
				}
				for (const tip of guide.tips) expect(tip.length).toBeLessThanOrEqual(GUIDE_LIMITS.tip);
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
