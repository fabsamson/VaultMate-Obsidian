// The sheet that a page's "?" button opens: the promise of the page, its story in 3 or 4 cards, the Markdown
// to write and a few tips. Built from a `Guide`; the pictures are inert copies of the real components.
import { Modal, type App } from "obsidian";

import { createMark } from "../components";
import { focusFromInput } from "../focus";
import { createSprite } from "../pixel";
import { SPRITES } from "../sprites";
import type { Guide } from "./guide";

/** README is a file name: keep its capitals. */
const README_LINK = "Full reference in the README";

const STEP_MARKS = [SPRITES.stateStep1, SPRITES.stateStep2, SPRITES.stateStep3, SPRITES.stateStep4];

/** Tags, dates and the markers of a task line stand out in the example. */
const HIGHLIGHT = /(#[\p{L}\p{N}_/-]+|\d{4}-\d{2}-\d{2}|[➕📅⏳✅]|\[[ x]\])/gu;

function writeLine(parent: HTMLElement, line: string): void {
	const row = parent.createDiv({ cls: "vaultmate-guide-code-line" });
	let last = 0;
	for (const match of line.matchAll(HIGHLIGHT)) {
		const text = match[0];
		if (match.index > last) row.appendText(line.slice(last, match.index));
		row.createSpan({ cls: text.startsWith("#") ? "is-tag" : /^\d/.test(text) ? "is-date" : "is-mark", text });
		last = match.index + text.length;
	}
	row.appendText(line.slice(last));
}

export class GuideModal extends Modal {
	/** `animate`: the cards come in one after the other (the Animations setting and the system's reduced motion). */
	public constructor(
		app: App,
		private readonly guide: Guide,
		private readonly animate: boolean,
	) {
		super(app);
		this.modalEl.addClasses(["vaultmate", "vaultmate-guide"]);
		this.modalEl.setAttr("role", "dialog");
		this.modalEl.setAttr("aria-modal", "true");
	}

	public onOpen(): void {
		const { guide, contentEl } = this;
		contentEl.addClass("vaultmate-guide-sheet");
		if (this.animate) contentEl.addClass("is-animated");

		contentEl.createDiv({ cls: "vaultmate-pattern-band" }).setCssProps({ "--vaultmate-pattern": `url("${SPRITES.patternSeigaiha.src}")` });
		// Page and cat sprites are crisp at whole multiples; in a short window they take the smaller step.
		const big = contentEl.win.innerHeight < 700 ? 40 : 64;
		const head = contentEl.createEl("header", { cls: "vaultmate-guide-head" });
		createSprite(head, guide.sprite, big);
		const heading = head.createDiv({ cls: "vaultmate-guide-heading" });
		const title = heading.createEl("h2", { cls: "vaultmate-guide-title", text: guide.title, attr: { id: "vaultmate-guide-title" } });
		this.modalEl.setAttr("aria-labelledby", title.id);
		heading.createEl("p", { cls: "vaultmate-guide-purpose", text: guide.purpose });
		const close = head.createEl("button", { cls: "vaultmate-guide-close", text: "Close", attr: { type: "button" } });
		close.addEventListener("click", () => this.close());

		const steps = contentEl.createEl("ol", { cls: "vaultmate-guide-steps" });
		steps.setCssProps({ "--vaultmate-steps": String(guide.steps.length) });
		guide.steps.forEach((step, index) => {
			const card = steps.createEl("li", { cls: "vaultmate-guide-step" });
			card.setCssProps({ "--vaultmate-step-index": String(index) });
			const top = card.createDiv({ cls: "vaultmate-guide-step-head" });
			const mark = STEP_MARKS[index];
			if (mark) createSprite(top, mark, 32);
			top.createEl("h3", { text: step.title });
			// A picture of the page: the caption below carries the meaning.
			const mock = card.createDiv({ cls: "vaultmate-guide-mock", attr: { "aria-hidden": "true", inert: "" } });
			step.mock(mock.createDiv({ cls: "vaultmate-guide-mock-inner" }));
			card.createEl("p", { cls: "vaultmate-guide-step-text", text: step.text });
		});

		const bottom = contentEl.createDiv({ cls: "vaultmate-guide-bottom" });
		const write = bottom.createDiv({ cls: "vaultmate-guide-write" });
		const writeHead = write.createDiv({ cls: "vaultmate-guide-write-head" });
		writeHead.createEl("h3", { text: "Write it like this" });
		writeHead.createSpan({ cls: "vaultmate-guide-caption", text: guide.write.caption });
		const code = write.createDiv({ cls: "vaultmate-guide-code" });
		for (const line of guide.write.lines) writeLine(code, line);
		const tips = bottom.createDiv({ cls: "vaultmate-guide-tips" });
		tips.createEl("h3", { text: "Good to know" });
		const list = tips.createEl("ul");
		for (const tip of guide.tips) {
			const item = list.createEl("li");
			createMark(item, SPRITES.stateFresh);
			item.createSpan({ text: tip });
		}

		const foot = contentEl.createEl("footer", { cls: "vaultmate-guide-foot" });
		const cat = foot.createDiv({ cls: "vaultmate-guide-cat" });
		cat.createSpan({ cls: "vaultmate-guide-bubble", text: guide.cat.bubble });
		createSprite(cat, guide.cat.sprite, big);
		foot.createEl("a", { text: README_LINK, attr: { href: guide.readme, target: "_blank", rel: "noopener" } });

		// Obsidian moves the focus into the window after `onOpen`: ask again once it has.
		close.win.setTimeout(() => focusFromInput(close), 50);
	}

	public onClose(): void {
		this.contentEl.empty();
	}
}
