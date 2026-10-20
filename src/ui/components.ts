// Reusable DOM pieces in VaultMate's look (styles.css). Parents must sit inside a `.vaultmate` element
// (the hub, or a modal whose `modalEl` has the class) so the palette tokens apply.
import { createSmallSprite, createSprite, type Sprite } from "./pixel";

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
	/** A 16 px mark before the label (a status seal); the label still carries the meaning. */
	sprite?: Sprite;
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

/** Index to focus after an arrow, Home or End key in a radio group, or null for any other key. Arrows wrap. */
export function nextChoiceIndex(key: string, current: number, count: number): number | null {
	switch (key) {
		case "ArrowRight":
		case "ArrowDown":
			return (current + 1) % count;
		case "ArrowLeft":
		case "ArrowUp":
			return (current - 1 + count) % count;
		case "Home":
			return 0;
		case "End":
			return count - 1;
		default:
			return null;
	}
}

function createChoiceGroup<T extends string>(parent: HTMLElement, groupCls: string, options: ChoiceGroupOptions<T>): ChoiceGroup<T> {
	const el = parent.createDiv({ cls: `vaultmate-choice ${groupCls}`, attr: { role: "radiogroup", "aria-label": options.label } });
	let value = options.value;
	const buttons = options.choices.map((choice) => {
		const button = el.createEl("button", { cls: "vaultmate-choice-option", attr: { type: "button", role: "radio" } });
		if (choice.sprite) createSmallSprite(button, choice.sprite, 16);
		button.createSpan({ text: choice.label });
		return button;
	});

	// Roving tabindex: one tab stop per group, on the selected option (or the first when none is selected).
	const sync = (): void => {
		const selected = options.choices.findIndex((choice) => choice.value === value);
		buttons.forEach((button, index) => {
			button.setAttribute("aria-checked", String(index === selected));
			button.tabIndex = index === (selected < 0 ? 0 : selected) ? 0 : -1;
			button.toggleClass("is-selected", index === selected);
		});
	};
	const select = (index: number): void => {
		const choice = options.choices[index];
		if (!choice) return;
		value = choice.value;
		sync();
		options.onChange(choice.value);
	};

	buttons.forEach((button, index) => {
		button.addEventListener("click", () => select(index));
		button.addEventListener("keydown", (event) => {
			const next = nextChoiceIndex(event.key, index, buttons.length);
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

/** A toggle button (`aria-expanded`, a triangle that turns) that shows or hides a block. The label stays the same. */
export function createDisclosure(parent: HTMLElement, options: { label: string; open?: boolean; onToggle?: (open: boolean) => void }): Disclosure {
	const button = parent.createEl("button", { cls: "vaultmate-link vaultmate-disclosure", text: options.label, attr: { type: "button", "aria-expanded": "false" } });
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
