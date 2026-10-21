// A page guide is data: what the "?" button of a page opens (see `guide-modal.ts`).
import type { Sprite } from "../pixel";

export interface GuideStep {
	/** A few words: what you do in this step. */
	title: string;
	text: string;
	/** Draws a small, inert picture of the interface in `el` with the real components. */
	mock(el: HTMLElement): void;
}

export interface Guide {
	/** Stable, never tied to the plugin version: an update must not reopen a guide (`guides.seen`). */
	id: string;
	/** The sprite of the page. */
	sprite: Sprite;
	/** The promise of the page. */
	title: string;
	/** One line: what the page is for. */
	purpose: string;
	/** 3 or 4 cards, side by side. */
	steps: GuideStep[];
	/** The real Markdown of the example, one entry per line. */
	write: { caption: string; lines: string[] };
	/** 2 or 3 short tips. */
	tips: string[];
	/** The cat of the guide, once, with a speech bubble. */
	cat: { sprite: Sprite; bubble: string };
	/** Absolute URL of the README with an anchor. */
	readme: string;
}

/** How much each part of a guide may say: guides stay airy and fit the sheet without scrolling. */
export const GUIDE_LIMITS = { stepTitle: 24, stepText: 150, tip: 100, bubble: 60, purpose: 90, title: 40, caption: 60, lines: 6 } as const;
