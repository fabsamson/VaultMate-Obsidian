// The sheet that a page's "?" button opens: a chapter of the book, told as moments in time with the cat acting
// each one, the Markdown to write and a few tips. Built from a `Guide`; the pictures are inert copies of the
// real components. The footer moves to the neighbouring chapters without closing the sheet.
import { Modal, type App } from "obsidian";

import { createMark } from "../components";
import { focusFromInput } from "../focus";
import { createSprite } from "../pixel";
import { SPRITES } from "../sprites";
import { setQuickTooltip } from "../tooltip";
import { CHAPTERS, chapterNumber, neighbours, type Chapter } from "./chapters";
import type { Guide } from "./guide";

/** README is a file name: keep its capitals. */
const README_LINK = "Full reference in the README";

const STEP_MARKS = [SPRITES.stateStep1, SPRITES.stateStep2, SPRITES.stateStep3, SPRITES.stateStep4];

/** Tags, dates and the markers of a task line stand out in the example. */
const HIGHLIGHT = /(#[\p{L}\p{N}_/-]+|\d{4}-\d{2}-\d{2}|[➕📅⏳✅]|\[[ x]\])/gu;

/** What the sheet needs from the plugin. */
export interface GuideHost {
	/** The written guide of a chapter, or undefined while it is coming. */
	guide(id: string): Guide | undefined;
	/** A guide was shown: remember it (an update never reopens it). */
	markSeen(id: string): void;
	/** Opens the page of a chapter in the panel. */
	openPage(chapter: Chapter): void;
}

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

/** A sentence with `**bold**` names of the interface. */
function story(parent: HTMLElement, text: string): void {
	text.split("**").forEach((part, index) => {
		if (index % 2 === 1) parent.createEl("strong", { text: part });
		else parent.appendText(part);
	});
}

/** The largest size of the picture's unit (`--g`) at which it still fits its frame, in px; null in a stacked layout, which keeps the CSS size. */
function fitMock(frame: HTMLElement, inner: HTMLElement): number {
	const style = frame.win.getComputedStyle(frame);
	const room = frame.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
	let low = 8;
	let high = 22;
	for (let i = 0; i < 7; i++) {
		const middle = (low + high) / 2;
		inner.style.setProperty("--g", `${middle}px`);
		if (inner.offsetHeight <= room && inner.scrollWidth <= inner.clientWidth + 1) low = middle;
		else high = middle;
	}
	return low;
}

export class GuideModal extends Modal {
	private shown: string;
	private observer: ResizeObserver | null = null;

	/**
	 * `current` is the guide of the page that is open in the panel; `animate`: the cards come in one after the
	 * other (the Animations setting and the system's reduced motion).
	 */
	public constructor(
		app: App,
		start: string,
		private readonly current: string,
		private readonly animate: boolean,
		private readonly host: GuideHost,
	) {
		super(app);
		this.shown = start;
		this.modalEl.addClasses(["vaultmate", "vaultmate-guide"]);
		this.modalEl.setAttr("role", "dialog");
		this.modalEl.setAttr("aria-modal", "true");
	}

	public onOpen(): void {
		this.show(this.shown, true);
		// Obsidian moves the focus into the window after `onOpen`: ask again once it has.
		const close = this.contentEl.querySelector<HTMLElement>(".vaultmate-guide-close");
		if (close) close.win.setTimeout(() => focusFromInput(close), 50);
	}

	public onClose(): void {
		this.observer?.disconnect();
		this.contentEl.empty();
	}

	/** Draws the chapter `id` in the sheet. */
	private show(id: string, first = false): void {
		const guide = this.host.guide(id);
		const chapter = CHAPTERS.find((candidate) => candidate.id === id);
		if (!guide || !chapter) return;
		this.shown = id;
		this.host.markSeen(id);
		const { contentEl } = this;
		this.observer?.disconnect();
		contentEl.empty();
		contentEl.addClass("vaultmate-guide-sheet");
		contentEl.toggleClass("is-animated", this.animate);
		contentEl.toggleClass("is-short", contentEl.win.innerHeight < 700);

		contentEl.createDiv({ cls: "vaultmate-pattern-band" }).setCssProps({ "--vaultmate-pattern": `url("${SPRITES.patternSeigaiha.src}")` });
		const head = contentEl.createEl("header", { cls: "vaultmate-guide-head" });
		createSprite(head, guide.sprite, 48);
		const heading = head.createDiv({ cls: "vaultmate-guide-heading" });
		heading.createDiv({ cls: "vaultmate-guide-eyebrow", text: `Chapter ${chapterNumber(id)} of ${CHAPTERS.length} · ${chapter.page}` });
		const title = heading.createEl("h2", { cls: "vaultmate-guide-title", text: chapter.title, attr: { id: "vaultmate-guide-title" } });
		this.modalEl.setAttr("aria-labelledby", title.id);
		heading.createEl("p", { cls: "vaultmate-guide-purpose", text: guide.purpose });
		const close = head.createEl("button", { cls: "vaultmate-guide-close", text: "Close", attr: { type: "button" } });
		close.addEventListener("click", () => this.close());

		const steps = contentEl.createEl("ol", { cls: "vaultmate-guide-steps" });
		steps.setCssProps({ "--vaultmate-steps": String(guide.steps.length) });
		const mocks: Array<{ frame: HTMLElement; inner: HTMLElement }> = [];
		guide.steps.forEach((step, index) => {
			const card = steps.createEl("li", { cls: "vaultmate-guide-step" });
			card.setCssProps({ "--vaultmate-step-index": String(index) });
			const top = card.createDiv({ cls: "vaultmate-guide-step-head" });
			const when = top.createDiv({ cls: "vaultmate-guide-when" });
			const mark = STEP_MARKS[index];
			if (mark) createSprite(when, mark, 32);
			when.createEl("h3", { text: step.when });
			const cat = createSprite(top, step.cat, 64);
			// In a short window the cat is 48 px: crisp at 1x and 2x, a little uneven at 1.5x, and it leaves the pictures more room.
			if (contentEl.hasClass("is-short")) cat.setCssProps({ "--vaultmate-sprite-size": "48px" });
			// A picture of the page at this moment: the story below carries the meaning.
			const frame = card.createDiv({ cls: "vaultmate-guide-mock", attr: { "aria-hidden": "true", inert: "" } });
			const inner = frame.createDiv({ cls: "vaultmate-guide-mock-inner" });
			step.mock(inner);
			mocks.push({ frame, inner });
			story(card.createEl("p", { cls: "vaultmate-guide-step-text" }), step.text);
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
		const around = neighbours(id);
		this.navButton(foot, around.previous, `‹ ${around.previous?.title ?? ""}`, "is-previous");
		const middle = foot.createDiv({ cls: "vaultmate-guide-foot-links" });
		if (id !== this.current) {
			const open = middle.createEl("button", { cls: "vaultmate-button", text: "Open this page", attr: { type: "button" } });
			open.addEventListener("click", () => {
				this.host.openPage(chapter);
				this.close();
			});
		}
		middle.createEl("a", { text: README_LINK, attr: { href: guide.readme, target: "_blank", rel: "noopener" } });
		this.navButton(foot, around.next, `${around.next?.title ?? ""} ›`, "is-next");

		// The pictures share one size, the largest that fits them all, so the same Book looks the same from card to card.
		const fit = (): void => {
			const stacked = contentEl.win.getComputedStyle(contentEl).display === "block";
			if (stacked) {
				for (const { inner } of mocks) inner.style.removeProperty("--g");
				return;
			}
			const size = Math.min(...mocks.map(({ frame, inner }) => fitMock(frame, inner)));
			for (const { inner } of mocks) inner.style.setProperty("--g", `${size}px`);
		};
		contentEl.win.requestAnimationFrame(fit);
		this.observer = new ResizeObserver(fit);
		this.observer.observe(contentEl);
		if (!first) focusFromInput(close);
	}

	/** A button to a neighbouring chapter; disabled, with the reason, while its guide is not written. */
	private navButton(parent: HTMLElement, chapter: Chapter | null, label: string, cls: string): void {
		if (!chapter) {
			parent.createSpan({ cls: `vaultmate-guide-nav ${cls}` });
			return;
		}
		const button = parent.createEl("button", { cls: `vaultmate-button vaultmate-guide-nav ${cls}`, text: label, attr: { type: "button" } });
		if (!this.host.guide(chapter.id)) {
			button.setAttr("aria-disabled", "true");
			setQuickTooltip(button, `${chapter.title}: coming soon`);
			return;
		}
		button.addEventListener("click", () => this.show(chapter.id));
	}
}
