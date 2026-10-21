// Chapter 6 of the book: the AI actions page (`ai-actions`). The story is a first novel; here an AI reads the
// draft as a second reader, only when asked and after the preview. Each picture is drawn with the real classes.
import { setIcon } from "obsidian";

import { createPanel } from "../../ui/components";
import type { Guide } from "../../ui/guide/guide";
import { SPRITES } from "../../ui/sprites";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#ai-actions";
const HOST = "api.openai.com";

const QUESTIONS = ["Why does the keeper stay after the storm?", "What if the light never failed?", "Who reads the logbook?"];
const NEXT_STEPS = ["Brief an illustrator", "Pick the font for the title", "Write the back-cover text"];

function button(parent: HTMLElement, text: string, cta = false): void {
	parent.createEl("button", { cls: cta ? "vaultmate-button mod-cta" : "vaultmate-button", text, attr: { type: "button", tabindex: "-1" } });
}

/** A label and a value, as the settings and the run window draw them. */
function row(parent: HTMLElement, label: string, value: string): void {
	const line = parent.createDiv({ cls: "vaultmate-source-row" });
	line.createSpan({ cls: "vaultmate-field-label", text: label });
	line.createSpan({ text: value });
}

/** The tickable list of the run window, as the questions and the next steps draw it. */
function choices(parent: HTMLElement, texts: string[], checked: boolean[], icon: boolean): void {
	const list = createPanel(parent, "vaultmate-questions vaultmate-guide-compact");
	texts.forEach((text, index) => {
		const card = list.createEl("label", { cls: "vaultmate-question" });
		if (icon) setIcon(card.createSpan({ cls: "vaultmate-action-icon", attr: { "aria-hidden": "true" } }), "circle-help");
		const box = card.createEl("input", { attr: { type: "checkbox", tabindex: "-1" } });
		box.checked = checked[index] ?? false;
		card.createDiv({ cls: "vaultmate-question-body" }).createSpan({ cls: "vaultmate-question-text", text });
	});
}

export const AI_ACTIONS_GUIDE: Guide = {
	id: "ai-actions",
	sprite: SPRITES.moduleQuestions,
	purpose: "Ask an AI for sharp questions or next steps, only when you click.",
	steps: [
		{
			when: "Day 1",
			cat: SPRITES.mascotLaptop,
			text: "Under AI actions in the settings, give a base URL, a model and a key from Obsidian's secret storage. **Create actions** adds three.",
			mock: (el) => {
				const panel = createPanel(el, "vaultmate-guide-compact");
				row(panel, "AI base URL", `https://${HOST}/v1`);
				row(panel, "AI model", "gpt-5.6-luna");
				row(panel, "API key secret", "my-ai-key");
				button(el, "Create actions");
			},
		},
		{
			when: "Week 9",
			cat: SPRITES.mascotThink,
			text: `**Challenge this note** on Chapter 3 opens a preview: the provider and each source with its size. Tick **Send this to ${HOST}**, then **Send**.`,
			mock: (el) => {
				const panel = createPanel(el, "vaultmate-guide-compact");
				row(panel, "Sent to", `${HOST} · gpt-5.6-luna`);
				row(panel, "Note", "4,812 characters");
				const label = el.createEl("label", { cls: "vaultmate-confirm" });
				label.createEl("input", { attr: { type: "checkbox", tabindex: "-1" } }).checked = true;
				label.createSpan({ text: `Send this to ${HOST}` });
				const actions = el.createDiv({ cls: "vaultmate-actions" });
				button(actions, "Cancel");
				button(actions, "Send", true);
			},
		},
		{
			when: "Next minute",
			cat: SPRITES.mascotRead,
			text: "About five short questions come back, such as “Why does the keeper stay after the storm?”. Keep the good ones and press **Insert selected**.",
			mock: (el) => {
				choices(el, QUESTIONS, [true, true, false], true);
				const actions = el.createDiv({ cls: "vaultmate-actions" });
				button(actions, "Ask again");
				button(actions, "Insert selected", true);
			},
		},
		{
			when: "Month 4",
			cat: SPRITES.mascotPaint,
			text: "On the project page the Cover track says **No next task**. **Suggest next steps** proposes three tasks: tick two, then **Add selected**.",
			mock: (el) => {
				choices(el, NEXT_STEPS, [true, true, false], false);
				const actions = el.createDiv({ cls: "vaultmate-actions" });
				button(actions, "Ask again");
				button(actions, "Add selected", true);
			},
		},
	],
	write: { caption: "Chapter 3, after Insert selected", lines: ["## Questions", `- ${QUESTIONS[0]}`, `- ${QUESTIONS[1]}`] },
	tips: [
		"Nothing is sent without your click. Ask again is another call.",
		"You can write your own action: a Markdown file that starts with vaultmate-action: 1.",
		"The key stays in Obsidian's secret storage, never in the plugin's settings.",
	],
	readme: README,
};
