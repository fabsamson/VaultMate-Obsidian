// The stamp moment (about 400 ms, then a short rest and a fade): the hanko comes down, presses, leaves its
// ink and settles. It is drawn over the whole window, centred, so it does not depend on the modal or page
// that is closing underneath. The timeline lives in styles.css (`vaultmate-stamp-*`); the sprites and their
// order are in obsidian_widget/tools/sprites/README.md.
import { stampScale } from "./motion";
import type { Sprite } from "./pixel";
import { SCENES } from "./sprites";

/** The moment is removed after its CSS animation (1500 ms) with a little margin. */
const LIFETIME_MS = 1700;

/** Shows the stamp over the window. The caller has already decided that animations are on. */
export function playStampMoment(sprite: Sprite): void {
	const doc = activeDocument;
	const unit = stampScale(activeWindow.devicePixelRatio || 1);
	const overlay = doc.body.createDiv({ cls: "vaultmate-stamp-moment", attr: { "aria-hidden": "true" } });
	const canvas = overlay.createDiv({ cls: "vaultmate-stamp-canvas" });
	canvas.setCssProps({ "--vaultmate-px": `${unit}px` });
	SCENES.ink.forEach((ink, index) => canvas.createEl("img", { cls: `vaultmate-stamp-ink vaultmate-stamp-ink-${index + 1}`, attr: { src: ink, alt: "" } }));
	canvas.createEl("img", { cls: "vaultmate-stamp-seal", attr: { src: sprite.src, alt: "" } });
	overlay.win.setTimeout(() => overlay.remove(), LIFETIME_MS);
}
