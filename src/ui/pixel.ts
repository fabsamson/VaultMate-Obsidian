export interface Sprite {
	src: string;
	/** Width and height of the square sprite, in sprite pixels. */
	pixels: number;
}

/**
 * CSS size at which every sprite pixel covers a whole number of device pixels, so pixel art stays
 * crisp. Obsidian mobile often runs at a fractional devicePixelRatio (about 2.39 on the test phone),
 * where a whole CSS-pixel scale would still be resampled and blur.
 */
export function crispSpriteSize(spritePixels: number, maxCssPixels: number, devicePixelRatio: number): number {
	const scale = Math.max(1, Math.floor((maxCssPixels * devicePixelRatio) / spritePixels));
	return (scale * spritePixels) / devicePixelRatio;
}

/** Appends a decorative sprite no larger than `maxCssPixels`; nearby text must carry its meaning. */
export function createSprite(parent: HTMLElement, sprite: Sprite, maxCssPixels: number): HTMLImageElement {
	const size = crispSpriteSize(sprite.pixels, maxCssPixels, parent.win.devicePixelRatio || 1);
	const image = parent.createEl("img", { cls: "vaultmate-sprite", attr: { src: sprite.src, alt: "" } });
	image.setCssProps({ "--vaultmate-sprite-size": `${size}px` });
	return image;
}
