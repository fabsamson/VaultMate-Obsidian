import { describe, expect, it } from "vitest";

import { shouldAutoOpen, withSeen } from "../src/ui/guide/auto-open";

const first = { id: "projects", seen: [] as string[], autoOpen: true, modalOpen: false, quiet: false };

describe("shouldAutoOpen", () => {
	it("opens a guide that was never seen", () => {
		expect(shouldAutoOpen(first)).toBe(true);
		expect(shouldAutoOpen({ ...first, seen: ["project", "home"] })).toBe(true);
	});

	it("never reopens a guide that was seen, even with duplicates in the list", () => {
		expect(shouldAutoOpen({ ...first, seen: ["projects"] })).toBe(false);
		expect(shouldAutoOpen({ ...first, seen: ["projects", "projects"] })).toBe(false);
	});

	it("stays closed when the setting is off", () => {
		expect(shouldAutoOpen({ ...first, autoOpen: false })).toBe(false);
	});

	it("stays closed while another window is open", () => {
		expect(shouldAutoOpen({ ...first, modalOpen: true })).toBe(false);
	});

	it("stays closed on a page opened quietly", () => {
		expect(shouldAutoOpen({ ...first, quiet: true })).toBe(false);
	});
});

describe("withSeen", () => {
	it("adds a new id at the end", () => {
		expect(withSeen(["home"], "projects")).toEqual(["home", "projects"]);
	});

	it("returns null for an id already seen, so nothing is saved twice", () => {
		expect(withSeen(["home", "projects"], "projects")).toBeNull();
	});
});
