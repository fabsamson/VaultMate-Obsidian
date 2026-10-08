import mascotTea from "../../assets/sprites/mascot_tea.png";
import patternSeigaiha from "../../assets/sprites/pattern_seigaiha.png";

import type { Sprite } from "./pixel";

// Sprites are drawn and built in obsidian_widget/tools/sprites; `npm run sync-sprites` copies them here.
export const SPRITES = {
	mascotTea: { src: mascotTea, pixels: 48 },
	patternSeigaiha: { src: patternSeigaiha, pixels: 16 },
} satisfies Record<string, Sprite>;
