import { describe, expect, it } from "vitest";

import { prefillName, trackFormState } from "../src/features/projects/track-form";

describe("trackFormState and the prefill", () => {
	it("cleans the typed name with shortName", () => {
		expect(trackFormState("  ★ [[Plan|The plan]]  ", "explore", [])).toEqual({ name: "The plan", valid: true, duplicate: false, showTask: false });
		expect(trackFormState("#^|", "progress", [])).toMatchObject({ valid: false, showTask: true });
	});
	it("prefills with 60 characters cut at a word", () => {
		const text = "Avoir une gestion des idée similaires a decision ou prediction, avec possibilité de créer un projet";
		expect(prefillName(text)).toBe("Avoir une gestion des idée similaires a decision ou");
	});
});
