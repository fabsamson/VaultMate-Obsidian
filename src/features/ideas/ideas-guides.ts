// Chapter 2 of the book: the Ideas page (`ideas`). The storm idea is caught on a walk, ages a little, is sorted on a
// Sunday and ends up in Chapter 3. Each picture is drawn with the real components and classes.
import { keepTogether } from "../../core/dates";
import { createIconButton, createMark, createPanel, createSectionHeader } from "../../ui/components";
import type { Guide } from "../../ui/guide/guide";
import type { Sprite } from "../../ui/pixel";
import { createSectionNav } from "../../ui/section-nav";
import { SPRITES } from "../../ui/sprites";
import { baseName } from "../context/note-meta";
import { ageText } from "./ideas-model";
import { ACTION_LABELS, portalActions, type PortalAction } from "./portal-actions";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#ideas";
const noop = (): void => undefined;
const STORM = "The keeper hears the storm first";

/** The icon of each portal action, as the portal draws it. */
const ACTION_SPRITES: Record<PortalAction, Sprite> = {
	"new-note": SPRITES.actionNewNote,
	track: SPRITES.actionNewTrack,
	drop: SPRITES.actionDrop,
	add: SPRITES.actionAddToNote,
	decision: SPRITES.stateDecision,
	prediction: SPRITES.statePrediction,
	seed: SPRITES.actionSeed,
	skip: SPRITES.actionSkip,
};

/** The chips of the page: a mark and a count per section. */
function chips(el: HTMLElement): void {
	const row: Array<[string, Sprite, number]> = [
		["Fresh", SPRITES.stateFresh, 3],
		["Waiting", SPRITES.stateWaiting, 2],
		["Wilting", SPRITES.stateWilting, 1],
	];
	createSectionNav(el, row.map(([label, sprite, count]) => ({ id: label, label, sprite, count, target: () => null })));
}

/** One processed idea: its words, then what became of it. */
function processedRow(parent: HTMLElement, text: string, result: string, target: string | null, date: string): void {
	const row = parent.createDiv({ cls: "vaultmate-idea-row" });
	row.createSpan({ cls: "vaultmate-idea-statement", text });
	const meta = row.createDiv({ cls: "vaultmate-idea-meta vaultmate-muted" });
	meta.createSpan({ text: result });
	if (target !== null) meta.createSpan({ cls: "vaultmate-inline-link", text: target });
	meta.createSpan({ text: date });
}

export const IDEAS_GUIDE: Guide = {
	id: "ideas",
	sprite: SPRITES.moduleIdea,
	purpose: "Catch an idea in a second, sort it when you have time.",
	steps: [
		{
			when: "On a walk",
			cat: SPRITES.mascotIdea,
			text: "The storm comes to you outdoors. Type **Idea:** or end the line with #idea and a space: it is planted as a task dated today, with the badge **Idea · today**.",
			mock: (el) => {
				const line = el.createDiv({ cls: "vaultmate-guide-note-line is-task" });
				createMark(line, SPRITES.stateTask);
				line.createSpan({ text: STORM });
				line.createSpan({ cls: "vaultmate-badge", text: "Idea · today" });
			},
		},
		{
			when: "Two days on",
			cat: SPRITES.mascotWater,
			text: "Ideas age. **Fresh** lasts two days, then come **Waiting** and **Wilting**: the chips count them, and each card says how old its idea is.",
			mock: (el) => {
				chips(el);
				const card = createPanel(el, "vaultmate-idea-card");
				card.createSpan({ cls: "vaultmate-idea-statement", text: STORM });
				card.createEl("p", { cls: "vaultmate-muted", text: `in ${baseName("Book.md")} · ${keepTogether(ageText(2))}` });
				const actions = card.createDiv({ cls: "vaultmate-related-actions vaultmate-icon-actions" });
				createIconButton(actions, SPRITES.actionProcess, "Process", noop);
				createIconButton(actions, SPRITES.actionDrop, "Drop", noop);
			},
		},
		{
			when: "Sunday",
			cat: SPRITES.mascotThink,
			text: "**Tend fresh ideas** opens Idea 1 of 3, oldest first. Press **Add to a note**, then pick **Chapter 3**.",
			mock: (el) => {
				createSectionHeader(el, "Idea 1 of 3");
				const row = el.createDiv({ cls: "vaultmate-portal-actions" });
				for (const action of portalActions({ tend: true, projectsEnabled: true, seedSubtag: "seed" })) {
					const button = createIconButton(row, ACTION_SPRITES[action], ACTION_LABELS[action], noop);
					button.setAttribute("aria-pressed", String(action === "add"));
					button.toggleClass("is-selected", action === "add");
				}
				el.createEl("p", { cls: "vaultmate-portal-panel-title", text: ACTION_LABELS.add });
				const field = el.createDiv({ cls: "vaultmate-guide-field" });
				field.createSpan({ cls: "vaultmate-field-label", text: "Note" });
				field.createSpan({ cls: "vaultmate-guide-input", text: "Chapter 3" });
			},
		},
		{
			when: "Later on",
			cat: SPRITES.mascotPoint,
			text: "Under **Processed**, each idea says what became of it. The seed **Audiobook** waits under **Project seeds** until you press **Launch**.",
			mock: (el) => {
				const rows = el.createDiv({ cls: "vaultmate-idea-rows" });
				processedRow(rows, STORM, "Added", "Chapter 3", "2026-10-25");
				processedRow(rows, "Cover with the lamp lit", "Track", "Book", "2026-10-25");
				processedRow(rows, "A rival keeper", "Dropped", null, "2026-10-25");
				const seed = el.createEl("ul", { cls: "vaultmate-idea-lines" }).createEl("li", { cls: "vaultmate-idea-line" });
				seed.createSpan({ cls: "vaultmate-idea-line-text", text: "Audiobook" });
				const actions = seed.createDiv({ cls: "vaultmate-icon-actions" });
				createIconButton(actions, SPRITES.actionLaunch, "Launch", noop);
				createIconButton(actions, SPRITES.actionDrop, "Drop", noop);
			},
		},
	],
	write: {
		caption: "On a walk, then once sorted on Sunday",
		lines: [`- [ ] ${STORM} #idea ➕ 2026-10-23`, `- [x] ${STORM} #idea [result: added] ➕ 2026-10-23 ✅ 2026-10-25`, "\t- Added to [[Chapter 3]]"],
	},
	tips: [
		"Skip keeps an idea fresh: it comes back the next time you tend.",
		"The search finds an idea by its words or by the name of its note.",
		"Project seeds need the Project seed sub-tag setting.",
	],
	readme: README,
};
