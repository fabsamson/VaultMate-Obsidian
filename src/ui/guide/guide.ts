// A page guide is data: what the "?" button of a page opens (see `guide-modal.ts`). A guide is the chapter of a
// story told as moments in time; its title, number and page are in `chapters.ts`.
import type { Sprite } from "../pixel";

export interface GuideStep {
	/** The moment: "Week 1", "Month 4", "Launch day". */
	when: string;
	/** The cat, in a pose that acts the moment. */
	cat: Sprite;
	/** Two short sentences in "you". `**bold**` marks a name of the interface. */
	text: string;
	/** Draws a small, inert picture of the interface at this moment, with the real components. The same object evolves from step to step. */
	mock(el: HTMLElement): void;
}

export interface Guide {
	/** Stable, never tied to the plugin version: an update must not reopen a guide (`guides.seen`). */
	id: string;
	/** The sprite of the page. */
	sprite: Sprite;
	/** One line: what the page is for. */
	purpose: string;
	/** 3 or 4 moments, side by side. */
	steps: GuideStep[];
	/** The real Markdown of the example, one entry per line, as written at one of the moments. */
	write: { caption: string; lines: string[] };
	/** 2 or 3 short tips. */
	tips: string[];
	/** Absolute URL of the README with an anchor. */
	readme: string;
}

/** The text of a step without its `**` marks. */
export function plainText(text: string): string {
	return text.replaceAll("**", "");
}

/** How much each part of a guide may say: guides stay airy and fit the sheet without scrolling. */
export const GUIDE_LIMITS = { when: 14, stepText: 170, tip: 100, purpose: 90, caption: 60, lines: 6 } as const;
