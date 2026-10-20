// WCAG 2.x contrast of two sRGB colors, to keep VaultMate's own text readable (at least 4.5:1).

/** Parses `#rgb` or `#rrggbb` into 0-255 channels, or null when it is not a hex color. */
export function parseHex(color: string): [number, number, number] | null {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(color.trim());
	const digits = match?.[1];
	if (!digits) return null;
	const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
	return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as [number, number, number];
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance([red, green, blue]: [number, number, number]): number {
	const linear = (channel: number): number => {
		const value = channel / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** Contrast ratio between two hex colors, 1 to 21, or null when one is not a hex color. */
export function contrastRatio(foreground: string, background: string): number | null {
	const front = parseHex(foreground);
	const back = parseHex(background);
	if (!front || !back) return null;
	const [light, dark] = [luminance(front), luminance(back)].sort((a, b) => b - a) as [number, number];
	return (light + 0.05) / (dark + 0.05);
}
