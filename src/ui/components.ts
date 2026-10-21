// Reusable DOM pieces in VaultMate's look (styles.css). Parents must sit inside a `.vaultmate` element
// (the hub, or a modal whose `modalEl` has the class) so the palette tokens apply.
import { nextChoiceIndex } from "./choice-keys";
import { createNearestSprite, createSmallSprite, createSprite, type Sprite } from "./pixel";
import { SPRITES } from "./sprites";
import { setIconTooltip, setQuickTooltip } from "./tooltip";

/** CSS size of a mark next to text; a 16 px sprite lands between 13 and 22 px, whatever the density. */
const MARK = 18;

/** A mark next to text: a 16 px source is drawn crisp at the size nearest to 18 px, a larger one (a 48 px seal) is shrunk smoothed to 18 px. */
export function createMark(parent: HTMLElement, sprite: Sprite): HTMLImageElement {
	return sprite.pixels <= MARK ? createNearestSprite(parent, sprite, MARK) : createSmallSprite(parent, sprite, MARK);
}

let descriptionCount = 0;

/**
 * An icon-only button: a 16 px sprite drawn crisp at 32 px in a 40 px target (44 px on a phone), or a larger one
 * (a 48 px seal) smoothed at 28 px. `label` names the action only; it is also the tooltip.
 * `primary` gives it the filled look of a main action. `describedBy` is the row's text (its object), read after the name.
 */
export function createIconButton(parent: HTMLElement, sprite: Sprite, label: string, onClick: (event: MouseEvent) => void, options: { primary?: boolean; describedBy?: HTMLElement } = {}): HTMLButtonElement {
	const button = parent.createEl("button", { cls: options.primary ? "vaultmate-icon-button mod-primary" : "vaultmate-icon-button", attr: { type: "button" } });
	setIconTooltip(button, label);
	if (options.describedBy) {
		if (!options.describedBy.id) options.describedBy.id = `vaultmate-desc-${++descriptionCount}`;
		button.setAttribute("aria-describedby", options.describedBy.id);
	}
	if (sprite.pixels <= MARK) createSprite(button, sprite, 32);
	else createSmallSprite(button, sprite, 28);
	button.addEventListener("click", onClick);
	return button;
}

export interface SpriteButtonOptions {
	sprite: Sprite;
	text: string;
	/** Accessible name when it must say more than `text`. */
	label?: string;
	/** The filled style of the main action. */
	cta?: boolean;
}

/** A button with a mark (`createMark`) before its word, for a page's main actions. */
export function createSpriteButton(parent: HTMLElement, options: SpriteButtonOptions): HTMLButtonElement {
	const button = parent.createEl("button", { cls: options.cta ? "vaultmate-button vaultmate-sprite-button mod-cta" : "vaultmate-button vaultmate-sprite-button", attr: { type: "button" } });
	if (options.label) button.setAttribute("aria-label", options.label);
	createMark(button, options.sprite);
	button.createSpan({ text: options.text });
	return button;
}

/** Small capitals label and a rule (SectionHeader.kt). */
export function createSectionHeader(parent: HTMLElement, label: string): HTMLElement {
	const header = parent.createDiv({ cls: "vaultmate-section-header", attr: { role: "heading", "aria-level": "2" } });
	header.createSpan({ cls: "vaultmate-section-label", text: label });
	header.createDiv({ cls: "vaultmate-section-rule" });
	return header;
}

/** Paper panel with a border and a hard offset shadow (PixelPanel.kt). */
export function createPanel(parent: HTMLElement, cls?: string): HTMLElement {
	return parent.createDiv({ cls: cls ? `vaultmate-panel ${cls}` : "vaultmate-panel" });
}

export interface InfoPanelOptions {
	sprite: Sprite;
	/** What the panel says, in a few words and without a final period. */
	title: string;
	/** A sentence that tells what to do next. */
	text?: string;
	/** A small sprite for a notice inside a page; the default is the large one of an empty page. */
	compact?: boolean;
}

/** A paper panel with a sprite, a title and an optional sentence: empty states and notices. */
export function createInfoPanel(parent: HTMLElement, options: InfoPanelOptions): HTMLElement {
	const panel = createPanel(parent, "vaultmate-empty");
	createSprite(panel, options.sprite, options.compact ? 48 : 96);
	panel.createEl("p", { cls: "vaultmate-empty-title", text: options.title });
	if (options.text) panel.createEl("p", { cls: "vaultmate-muted", text: options.text });
	return panel;
}

export interface HankoStampOptions {
	sprite: Sprite;
	/** Visible text; the stamp's meaning is never carried by the sprite alone. */
	label: string;
	/** Second line under the label, for example "Done" or "Not yet". */
	state?: string;
	/** An unearned stamp is faded; pair it with `state` so the difference is also written. Default: true. */
	earned?: boolean;
}

/** A hanko seal with its label (HankoStamp.kt). */
export function createHankoStamp(parent: HTMLElement, options: HankoStampOptions): HTMLElement {
	const stamp = parent.createDiv({ cls: "vaultmate-hanko" });
	if (options.earned === false) stamp.addClass("vaultmate-hanko-unearned");
	createSprite(stamp, options.sprite, 40);
	stamp.createSpan({ cls: "vaultmate-hanko-label", text: options.label });
	if (options.state) stamp.createSpan({ cls: "vaultmate-hanko-state", text: options.state });
	return stamp;
}

export interface Choice<T extends string> {
	value: T;
	label: string;
	/** A mark before the label (`createMark`: a status seal, a scope); the label still carries the meaning. */
	sprite?: Sprite;
	/** Why the choice cannot be picked now (its tooltip); it stays visible but the keyboard skips it. */
	disabled?: string;
}

export interface ChoiceGroupOptions<T extends string> {
	/** Accessible name of the group ("What happened?"). */
	label: string;
	choices: readonly Choice<T>[];
	/** Initially selected value, or null for none. */
	value: T | null;
	onChange: (value: T) => void;
}

export interface ChoiceGroup<T extends string> {
	el: HTMLElement;
	getValue(): T | null;
	setValue(value: T | null): void;
}

function createChoiceGroup<T extends string>(parent: HTMLElement, groupCls: string, options: ChoiceGroupOptions<T>): ChoiceGroup<T> {
	const el = parent.createDiv({ cls: `vaultmate-choice ${groupCls}`, attr: { role: "radiogroup", "aria-label": options.label } });
	let value = options.value;
	const buttons = options.choices.map((choice) => {
		const button = el.createEl("button", { cls: "vaultmate-choice-option", attr: { type: "button", role: "radio" } });
		if (choice.disabled) button.setAttr("aria-disabled", "true");
		// The reason is the tooltip and, with the label, the accessible name: the label stays the first thing read.
		if (choice.disabled) setQuickTooltip(button, `${choice.label}: ${choice.disabled}`);
		if (choice.sprite) createMark(button, choice.sprite);
		button.createSpan({ text: choice.label });
		return button;
	});
	const disabled = options.choices.map((choice) => !!choice.disabled);
	const firstEnabled = disabled.indexOf(false);

	// Roving tabindex: one tab stop per group, on the selected option (or the first when none is selected).
	const sync = (): void => {
		const selected = options.choices.findIndex((choice) => choice.value === value);
		buttons.forEach((button, index) => {
			button.setAttribute("aria-checked", String(index === selected));
			button.tabIndex = index === (selected < 0 || disabled[selected] ? firstEnabled : selected) ? 0 : -1;
			button.toggleClass("is-selected", index === selected);
		});
	};
	const select = (index: number): void => {
		const choice = options.choices[index];
		if (!choice || disabled[index]) return;
		value = choice.value;
		sync();
		options.onChange(choice.value);
	};

	buttons.forEach((button, index) => {
		button.addEventListener("click", () => select(index));
		button.addEventListener("keydown", (event) => {
			const next = nextChoiceIndex(event.key, index, buttons.length, disabled);
			if (next === null) return;
			event.preventDefault();
			buttons[next]?.focus();
			select(next);
		});
	});
	sync();

	return {
		el,
		getValue: () => value,
		setValue: (next) => {
			value = next;
			sync();
		},
	};
}

/** Single choice shown as joined buttons ("Better / As expected / Worse"). Radio group semantics, arrow keys. */
export function createSegmentedControl<T extends string>(parent: HTMLElement, options: ChoiceGroupOptions<T>): ChoiceGroup<T> {
	return createChoiceGroup(parent, "vaultmate-segmented", options);
}

/** Single choice shown as separate chips ("1 week … 1 year"). Same behaviour as the segmented control. */
export function createChipRow<T extends string>(parent: HTMLElement, options: ChoiceGroupOptions<T>): ChoiceGroup<T> {
	return createChoiceGroup(parent, "vaultmate-chips", options);
}

export interface Disclosure {
	/** The content; hidden while the disclosure is closed. */
	body: HTMLElement;
	button: HTMLButtonElement;
	setOpen(open: boolean): void;
}

/** A toggle button (`aria-expanded`, a pixel caret that turns a quarter) that shows or hides a block. The label stays the same. */
export function createDisclosure(parent: HTMLElement, options: { label: string; open?: boolean; onToggle?: (open: boolean) => void }): Disclosure {
	const button = parent.createEl("button", { cls: "vaultmate-link vaultmate-disclosure", attr: { type: "button", "aria-expanded": "false" } });
	createSprite(button, SPRITES.actionPickerCaret, 16);
	button.createSpan({ text: options.label });
	const body = parent.createDiv();
	const setOpen = (open: boolean): void => {
		button.setAttribute("aria-expanded", String(open));
		body.hidden = !open;
	};
	setOpen(options.open ?? false);
	button.addEventListener("click", () => {
		const open = button.getAttribute("aria-expanded") !== "true";
		setOpen(open);
		options.onToggle?.(open);
	});
	return { body, button, setOpen };
}
