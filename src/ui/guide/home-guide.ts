// Chapter 1 of the book: the hub's landing page (`home`). The story opens with a first note for the novel: three plain
// lines that the panel then gathers. Each picture is drawn with the real components and classes.
import { badgedLine, SELF_PUBLISH } from "../../features/journal/journal-guides";
import { weeklySummary } from "../../features/weekly-review/weekly-review";
import { createIconButton } from "../components";
import { createSprite, type Sprite } from "../pixel";
import { SPRITES } from "../sprites";
import { CHAPTERS } from "./chapters";
import type { Guide } from "./guide";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#quick-start";

const IDEA = "- [ ] The keeper hears the storm first #idea ➕ 2026-10-21";
const TASK = "- [ ] Finish chapter 3 ➕ 2026-10-21 📅 2026-10-24";

/** A tile of the landing page, as the hub draws it. */
function homeTile(parent: HTMLElement, sprite: Sprite, label: string, summary: string): void {
	const tile = parent.createDiv({ cls: "vaultmate-tile" });
	createSprite(tile, sprite, 48);
	const text = tile.createDiv({ cls: "vaultmate-tile-text" });
	text.createSpan({ cls: "vaultmate-tile-label", text: label });
	text.createSpan({ cls: "vaultmate-muted", text: summary });
}

export const HOME_GUIDE: Guide = {
	id: "home",
	sprite: SPRITES.moduleIdea,
	purpose: "Everything starts as plain lines in your notes, and the panel gathers them.",
	steps: [
		{
			when: "Day 1",
			cat: SPRITES.mascotWrite,
			text: "You open a note for the novel and write three lines: an idea, a decision with a review date, and a task. The decision gets a small badge.",
			mock: (el) => {
				const day = new Date(2026, 9, 21);
				badgedLine(el, IDEA, day);
				badgedLine(el, SELF_PUBLISH, day);
				badgedLine(el, TASK, day);
			},
		},
		{
			when: "Day 2",
			cat: SPRITES.mascotPoint,
			text: "Open the **VaultMate** panel and the tiles light up. **Ideas** counts the storm idea, and the decision waits for its review date.",
			mock: (el) => {
				const tiles = el.createDiv({ cls: "vaultmate-tiles" });
				homeTile(tiles, SPRITES.moduleIdea, "Ideas", "1 fresh");
				homeTile(tiles, SPRITES.moduleDecision, "Decisions and predictions", "Nothing to review");
				homeTile(tiles, SPRITES.moduleProjects, "Projects", "No projects yet");
			},
		},
		{
			when: "Sundays",
			cat: SPRITES.mascotTea,
			text: "The **Weekly review** command walks you through the reviews due, **Tend fresh ideas**, and any track with no next task.",
			mock: (el) => {
				el.createDiv({ cls: "vaultmate-guide-command", text: "VaultMate: Weekly review" });
				el.createDiv({ cls: "vaultmate-guide-notice", text: weeklySummary({ reviews: 1, ideas: 3, tracks: 1, otherProjects: 0, stopped: false }) });
			},
		},
		{
			when: "Road ahead",
			cat: SPRITES.mascotMap,
			text: "Every page has its own chapter behind **?**, and the book reads in order. Follow the story to the epilogue.",
			mock: (el) => {
				const head = el.createDiv({ cls: "vaultmate-guide-help" });
				createIconButton(head, SPRITES.actionHelp, "How this page works", () => undefined, { primary: true });
				head.createSpan({ cls: "vaultmate-muted", text: "on every page" });
				const list = el.createEl("ol", { cls: "vaultmate-guide-chapters" });
				for (const chapter of CHAPTERS) list.createEl("li", { text: chapter.title });
			},
		},
	],
	write: { caption: "Day 1, in the novel's note", lines: [IDEA, SELF_PUBLISH, TASK] },
	tips: [
		"Plain Markdown: the same lines work on your phone.",
		"Nothing leaves your device unless you run an AI action.",
		"Turn features on or off in the VaultMate settings.",
	],
	readme: README,
};
