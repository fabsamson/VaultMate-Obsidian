// Chapter 6 of the book: the New connections page (`connections`). Notes on lighthouses pile up, and during the final
// revision the page proposes the chapter they belong to. Each picture is drawn with the real classes of the connection card.
import { setIcon } from "obsidian";

import { createIconButton, createPanel } from "../../ui/components";
import type { Guide } from "../../ui/guide/guide";
import { SPRITES } from "../../ui/sprites";
import { aboutParts, locationLine, REASON_ICONS } from "./context-labels";
import type { ReasonKind } from "./engine";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#new-connections";
const noop = (): void => undefined;

/** The connection card of Chapter 3 (Month 6) for Research notes: lighthouses, with only the parts shown at that moment. */
function card(parent: HTMLElement, parts: { about?: boolean; reasons?: boolean; actions?: boolean }): void {
	const panel = createPanel(parent, "vaultmate-related-card");
	panel.createSpan({ cls: "vaultmate-related-title", text: "Chapter 3" });
	if (parts.about) {
		const about = panel.createEl("p", { cls: "vaultmate-related-about" });
		for (const part of aboutParts(["storm", "keeper"])) {
			if (part.term) about.createEl("em", { text: part.text });
			else about.appendText(part.text);
		}
		panel.createEl("p", { cls: "vaultmate-muted vaultmate-related-folder", text: locationLine("Chapter 3.md", "Research.md") });
	}
	if (parts.reasons) {
		const list = panel.createEl("ul", { cls: "vaultmate-related-reasons" });
		const reasons: Array<[ReasonKind, string]> = [
			["mention", "Named in this note without a link: Chapter 3"],
			["place", "800 m away"],
		];
		for (const [kind, text] of reasons) {
			const row = list.createEl("li");
			setIcon(row.createSpan({ cls: "vaultmate-related-icon", attr: { "aria-hidden": "true" } }), REASON_ICONS[kind]);
			row.createSpan({ text });
		}
	}
	if (parts.actions) {
		const actions = panel.createDiv({ cls: "vaultmate-related-actions vaultmate-icon-actions" });
		createIconButton(actions, SPRITES.actionLink, "Insert link", noop, { primary: true });
		createIconButton(actions, SPRITES.actionCopy, "Copy link", noop);
		createIconButton(actions, SPRITES.actionDismiss, "Not useful", noop);
	}
}

export const CONNECTIONS_GUIDE: Guide = {
	id: "connections",
	sprite: SPRITES.moduleContext,
	purpose: "Find the notes that belong together but are not linked yet.",
	steps: [
		{
			when: "Month 6",
			cat: SPRITES.mascotRead,
			text: "In the final revision, your lighthouse notes from Month 1 sit in **Research notes: lighthouses**. None of them links to the chapters.",
			mock: (el) => {
				for (const title of ["Chapter 1", "Chapter 2", "Chapter 3", "Research notes: lighthouses"]) {
					el.createDiv({ cls: title.startsWith("Research") ? "vaultmate-guide-file is-open" : "vaultmate-guide-file", text: title });
				}
			},
		},
		{
			when: "A thread",
			cat: SPRITES.mascotYarn,
			text: "With Research notes: lighthouses open, **New connections** proposes **Chapter 3**. Its two most telling shared words say why: storm and keeper.",
			mock: (el) => card(el, { about: true }),
		},
		{
			when: "Why it fits",
			cat: SPRITES.mascotThink,
			text: "Under the card come the reasons: a mention of the title without a link, or a place within a kilometre. Pairs already linked are never shown.",
			mock: (el) => card(el, { reasons: true }),
		},
		{
			when: "The link",
			cat: SPRITES.mascotCheer,
			text: "**Insert link** puts the link at your cursor. If the pair is no use, **Not useful** hides it for good, in both directions.",
			mock: (el) => {
				card(el, { actions: true });
				el.createDiv({ cls: "vaultmate-guide-note-line", text: "The storm scene is in [[Chapter 3]]." });
			},
		},
	],
	write: { caption: "In Research notes: lighthouses, after Insert link", lines: ["The storm scene is in [[Chapter 3]]."] },
	tips: [
		"Everything is computed on your device. The first index takes a few seconds.",
		"Notes already linked, or cited together by a third note, are never proposed.",
		"Excluded folders and the maximum count are in the settings, under New connections.",
	],
	readme: README,
};
