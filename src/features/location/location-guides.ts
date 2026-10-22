// Chapter 8 of the book, the epilogue: the Places page (`places`). The story is a first novel; here the notes get pinned
// to the lighthouse that inspires it and to the café of the launch reading. Each picture is drawn with the real classes.
import { createPanel, createSpriteButton } from "../../ui/components";
import type { Guide } from "../../ui/guide/guide";
import { SPRITES } from "../../ui/sprites";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#location";

const LIGHTHOUSE = "Créac'h lighthouse";
const PLACES = [
	{ name: LIGHTHOUSE, detail: "lighthouse · Ouessant" },
	{ name: "Créac'h", detail: "hamlet · Ouessant" },
];

/** A property row, as Obsidian draws it. */
function property(parent: HTMLElement, key: string, value: string): void {
	const row = parent.createDiv({ cls: "vaultmate-guide-prop" });
	row.createSpan({ cls: "vaultmate-guide-prop-key", text: key });
	row.createSpan({ text: value });
}

/** One pin of the pixel map: a diamond and the name of the note. */
function pin(parent: HTMLElement, text: string, x: number, y: number): void {
	const el = parent.createDiv({ cls: "vaultmate-guide-pin" });
	el.style.left = `${x}%`;
	el.style.top = `${y}%`;
	el.createSpan({ cls: "vaultmate-guide-pin-label", text });
}

export const PLACES_GUIDE: Guide = {
	id: "places",
	sprite: SPRITES.moduleLocation,
	purpose: "Pin a note to a real place, and see all your places on a map.",
	steps: [
		{
			when: "Month 8",
			cat: SPRITES.mascotMap,
			text: "For the map on the book's website, **Search a place** finds the real lighthouse on OpenStreetMap. Pick a result, tidy the label, then **Add to note**.",
			mock: (el) => {
				const row = el.createDiv({ cls: "vaultmate-search-row" });
				const input = row.createEl("input", { cls: "vaultmate-input", attr: { type: "text", readonly: "", tabindex: "-1" } });
				input.value = "Créac'h";
				row.createEl("button", { cls: "vaultmate-button mod-cta", text: "Search", attr: { type: "button", tabindex: "-1" } });
				const list = createPanel(el, "vaultmate-places");
				PLACES.forEach((place, index) => {
					const item = list.createEl("button", { cls: "vaultmate-place", attr: { type: "button", tabindex: "-1" } });
					item.toggleClass("is-selected", index === 0);
					item.createDiv({ cls: "vaultmate-action-name", text: place.name });
					item.createDiv({ cls: "vaultmate-muted", text: place.detail });
				});
			},
		},
		{
			when: "Same day",
			cat: SPRITES.mascotPoint,
			text: "Chapter 3 now holds **latitude**, **longitude** and **location** in its properties. VaultMate writes only these three.",
			mock: (el) => {
				property(el, "latitude", "48.4593");
				property(el, "longitude", "-5.1311");
				property(el, "location", LIGHTHOUSE);
			},
		},
		{
			when: "Launch day",
			cat: SPRITES.mascotTea,
			text: "At the launch reading in the café, **Add current location** asks the optional VaultMate Android app for your position, so the note says where it happened.",
			mock: (el) => {
				const panel = createPanel(el);
				panel.createEl("p", { cls: "vaultmate-muted", text: "Location of the launch reading" });
				panel.createEl("p", { cls: "vaultmate-action-name", text: "Café des quais" });
				createSpriteButton(el, { sprite: SPRITES.actionLocate, text: "Add current location" });
			},
		},
		{
			when: "After launch",
			cat: SPRITES.mascotBook,
			text: "Make a Base with a **Map** view and set **Marker coordinates** to [latitude, longitude]. Your chapters show up as pins, and the printed book is on the shelf.",
			mock: (el) => {
				const map = el.createDiv({ cls: "vaultmate-guide-map" });
				map.createDiv({ cls: "vaultmate-guide-land" });
				pin(map, "Chapter 3", 38, 14);
				pin(map, "Chapter 4", 40, 42);
				pin(map, "Research notes", 4, 72);
			},
		},
	],
	write: { caption: "Chapter 3, in the note's properties", lines: ["---", "latitude: 48.4593", "longitude: -5.1311", "location: Créac'h lighthouse", "---"] },
	tips: [
		"A search sends only your text, at most once a second, and never while you type.",
		"VaultMate asks before it replaces a location already in the note.",
		"The three property names can be changed in the settings, under Location.",
	],
	readme: README,
};
