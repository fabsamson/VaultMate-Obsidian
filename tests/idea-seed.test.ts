import { describe, expect, it } from "vitest";

import { cleanSeedSubtag, normalizeSettings, validateSeedSubtag } from "../src/core/settings-model";
import { buildIdeaItem, isProjectSeed, retagAsSeed, type IdeaItem } from "../src/features/ideas/idea-line";
import { groupOpen, seedCount, tendQueue, tendSummary } from "../src/features/ideas/ideas-model";

const TODAY = new Date(2026, 9, 13);
const SEED = { tag: "idea", subtag: "projet" };

function item(line: string, created = "2026-10-12"): IdeaItem {
	const found = buildIdeaItem("A.md", "A", created, 0, [line], "idea");
	if (!found) throw new Error("not an idea");
	return found;
}

describe("isProjectSeed", () => {
	it("is the exact sub-tag or a sub-tag of it, in any case", () => {
		expect(isProjectSeed("- [ ] X #idea/projet ➕ 2026-10-13", "idea", "projet")).toBe(true);
		expect(isProjectSeed("- [ ] X #Idea/Projet/app", "idea", "projet")).toBe(true);
		expect(isProjectSeed("- [ ] X #idea", "idea", "projet")).toBe(false);
		expect(isProjectSeed("- [ ] X #idea/projets", "idea", "projet")).toBe(false);
		expect(isProjectSeed("- [ ] X #idea/work", "idea", "projet")).toBe(false);
	});
	it("is never true without a sub-tag", () => {
		expect(isProjectSeed("- [ ] X #idea/projet", "idea", "")).toBe(false);
	});
});

describe("retagAsSeed", () => {
	it("turns the idea tag into the seed tag and changes nothing else", () => {
		expect(retagAsSeed("- [ ] Brief du soir #idea ➕ 2026-10-13", "idea", "projet")).toBe("- [ ] Brief du soir #idea/projet ➕ 2026-10-13");
		expect(retagAsSeed("  > - [ ] A #x #Idea [k: v] ➕ 2026-10-13 ^b1", "idea", "projet")).toBe("  > - [ ] A #x #idea/projet [k: v] ➕ 2026-10-13 ^b1");
	});
	it("keeps a tagged line that is not a task as it is, open", () => {
		expect(retagAsSeed("- Une idée #idea", "idea", "projet")).toBe("- Une idée #idea/projet");
		expect(retagAsSeed("Une idée #idea", "idea", "projet")).toBe("Une idée #idea/projet");
	});
	it("replaces another sub-tag", () => {
		expect(retagAsSeed("- [ ] A #idea/work ➕ 2026-10-13", "idea", "projet")).toBe("- [ ] A #idea/projet ➕ 2026-10-13");
	});
	it("refuses a seed, a closed idea, another line and an empty sub-tag", () => {
		expect(retagAsSeed("- [ ] A #idea/projet", "idea", "projet")).toBeNull();
		expect(retagAsSeed("- [x] A #idea [result: dropped] ✅ 2026-10-13", "idea", "projet")).toBeNull();
		expect(retagAsSeed("- [-] A #idea", "idea", "projet")).toBeNull();
		expect(retagAsSeed("- [ ] A #decision", "idea", "projet")).toBeNull();
		expect(retagAsSeed("- [ ] A #idea", "idea", "")).toBeNull();
	});
	it("is read back as an open seed", () => {
		const line = retagAsSeed("- [ ] A #idea ➕ 2026-10-13", "idea", "projet") ?? "";
		expect(isProjectSeed(line, "idea", "projet")).toBe(true);
		expect(item(line).idea).toMatchObject({ type: "task", entry: { status: "open", statement: "A" } });
	});
});

describe("seeds in the ideas model", () => {
	const items = [
		item("- [ ] Plain old #idea ➕ 2026-09-01"),
		item("- [ ] Seed fresh #idea/projet ➕ 2026-10-13"),
		item("- [ ] Seed old #idea/projet ➕ 2026-09-01"),
		item("Seed plain #idea/projet"),
		item("- [x] Closed seed #idea/projet [result: dropped] ✅ 2026-10-10"),
	];

	it("keeps seeds out of the tend groups when the sub-tag is set", () => {
		const groups = groupOpen(items, TODAY, SEED);
		expect(groups.fresh).toEqual([]);
		expect(groups.waiting).toEqual([]);
		expect(groups.wilting.map((entry) => entry.raw)).toEqual(["- [ ] Plain old #idea ➕ 2026-09-01"]);
		expect(tendQueue(items, TODAY, SEED)).toEqual([]);
		expect(tendSummary(items, TODAY, SEED)).toBe("1 wilting");
	});

	it("counts the open seeds", () => {
		expect(seedCount(items, SEED)).toBe(3);
	});

	it("changes nothing when the sub-tag is empty", () => {
		const off = { tag: "idea", subtag: "" };
		expect(groupOpen(items, TODAY, off)).toEqual(groupOpen(items, TODAY));
		expect(groupOpen(items, TODAY).fresh).toHaveLength(2);
		expect(seedCount(items, off)).toBe(0);
	});
});

describe("the seed sub-tag setting", () => {
	it("is empty by default", () => {
		expect(normalizeSettings({}).ideas.seedSubtag).toBe("");
	});
	it("is cleaned of #, slashes and spaces at both ends", () => {
		expect(cleanSeedSubtag(" #/projet/ ")).toBe("projet");
		expect(cleanSeedSubtag("a/b")).toBe("a/b");
		expect(normalizeSettings({ ideas: { seedSubtag: " #projet/ " } }).ideas.seedSubtag).toBe("projet");
	});
	it("falls back to empty when it is not a tag", () => {
		expect(normalizeSettings({ ideas: { seedSubtag: "two words" } }).ideas.seedSubtag).toBe("");
		expect(normalizeSettings({ ideas: { seedSubtag: 3 } }).ideas.seedSubtag).toBe("");
	});
	it("validates what is typed; empty turns seeds off", () => {
		expect(validateSeedSubtag("")).toBeUndefined();
		expect(validateSeedSubtag("#projet")).toBeUndefined();
		expect(validateSeedSubtag("a b")).toBeTruthy();
		expect(validateSeedSubtag("a*")).toBeTruthy();
	});
});
