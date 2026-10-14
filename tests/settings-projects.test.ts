import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings, validateTracksTitle } from "../src/core/settings-model";

describe("validateTracksTitle", () => {
	it("accepts titles the reader recognizes as a Tracks section", () => {
		for (const title of ["🧭 Tracks", "🧭 Pistes", "Tracks", "Pistes de travail", "🧭", " Track list "]) expect(validateTracksTitle(title), title).toBeUndefined();
	});

	it("rejects empty, multi-line, hash-prefixed and unrecognizable titles", () => {
		for (const title of ["", "  ", "# Tracks", "Tracks\nmore", "Roadmap", "Notes"]) expect(validateTracksTitle(title), title).toBeTruthy();
	});
});

describe("normalizeSettings for projects", () => {
	it("defaults to projects on with the generic title", () => {
		expect(DEFAULT_SETTINGS.projects).toEqual({ enabled: true, tracksTitle: "🧭 Tracks" });
		for (const data of [undefined, {}, { projects: null }, { projects: [] }, { projects: "x" }]) {
			expect(normalizeSettings(data).projects).toEqual(DEFAULT_SETTINGS.projects);
		}
	});

	it("merges key by key and trims the title", () => {
		expect(normalizeSettings({ projects: { enabled: false } }).projects).toEqual({ ...DEFAULT_SETTINGS.projects, enabled: false });
		expect(normalizeSettings({ projects: { tracksTitle: " 🧭 Pistes " } }).projects.tracksTitle).toBe("🧭 Pistes");
	});

	it("falls back to the default for an invalid title or a wrong type", () => {
		for (const tracksTitle of ["", "# Tracks", "Roadmap", 3, null]) {
			expect(normalizeSettings({ projects: { tracksTitle } }).projects.tracksTitle, String(tracksTitle)).toBe("🧭 Tracks");
		}
		expect(normalizeSettings({ projects: { enabled: "yes" } }).projects.enabled).toBe(true);
	});
});
