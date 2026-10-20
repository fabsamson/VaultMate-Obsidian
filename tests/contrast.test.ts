import { describe, expect, it } from "vitest";

import CSS from "virtual:vaultmate-styles";

import { contrastRatio, parseHex } from "../src/ui/contrast";

/** The `--vaultmate-*` tokens declared by the rule whose selector starts with `selector`. */
function tokens(selector: string): Record<string, string> {
	const start = CSS.indexOf(`${selector},`);
	const end = CSS.indexOf("}", start);
	const found: Record<string, string> = {};
	for (const match of CSS.slice(start, end).matchAll(/--vaultmate-([a-z-]+):\s*(#[0-9a-fA-F]{3,6});/gu)) found[match[1]] = match[2];
	return found;
}

const SCHEMES = { light: tokens(".vaultmate"), dark: tokens(".theme-dark .vaultmate") };

/** Text token on the surfaces it is drawn on. Disabled buttons are exempt (WCAG 1.4.3). */
const PAIRS: ReadonlyArray<readonly [text: string, backgrounds: readonly string[]]> = [
	["text", ["surface", "surface-raised", "sakura", "rule"]],
	["text-muted", ["surface", "surface-raised", "sakura"]],
	["primary", ["surface", "surface-raised"]],
	["seal-text", ["surface", "surface-raised"]],
	["on-primary", ["primary"]],
];

describe("contrast ratio", () => {
	it("is 21 for black on white and 1 for the same color", () => {
		expect(contrastRatio("#000", "#ffffff")).toBeCloseTo(21, 5);
		expect(contrastRatio("#315fb8", "#315fb8")).toBeCloseTo(1, 5);
	});

	it("does not depend on the order", () => {
		expect(contrastRatio("#1d315d", "#fffaed")).toBe(contrastRatio("#fffaed", "#1d315d"));
	});

	it("rejects what is not a hex color", () => {
		expect(parseHex("red")).toBeNull();
		expect(contrastRatio("red", "#fff")).toBeNull();
	});
});

describe("VaultMate palette", () => {
	for (const [scheme, palette] of Object.entries(SCHEMES)) {
		it(`${scheme}: declares every token`, () => {
			for (const [text, backgrounds] of PAIRS) for (const name of [text, ...backgrounds]) expect(palette[name], `${scheme} ${name}`).toBeDefined();
		});

		for (const [text, backgrounds] of PAIRS) {
			for (const background of backgrounds) {
				it(`${scheme}: ${text} on ${background} is at least 4.5:1`, () => {
					const ratio = contrastRatio(palette[text] ?? "", palette[background] ?? "");
					expect(ratio).not.toBeNull();
					expect(ratio ?? 0).toBeGreaterThanOrEqual(4.5);
				});
			}
		}
	}
});
