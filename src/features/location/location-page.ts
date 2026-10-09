// The hub's "Places" page: the location of the context note, and the ways to set it.
import type { HubPage } from "../../ui/hub-view";
import { createPanel } from "../../ui/components";
import { SPRITES } from "../../ui/sprites";
import { openStreetMapUrl, type LatLng } from "./nominatim";

export interface CurrentLocation {
	label: string;
	position: LatLng | null;
}

export interface LocationPageHost {
	enabled(): boolean;
	/** Name of the context note, or null. */
	contextName(): string | null;
	/** What the context note has now, or null for none. */
	current(): CurrentLocation | null;
	/** Whether the "Add current location" button is offered (Android option on, running on Android). */
	canAddCurrent(): boolean;
	search(): void;
	addCurrent(): void;
}

export function createLocationPage(host: LocationPageHost): HubPage {
	return {
		id: "places",
		order: 40,
		title: "Places",
		// No 24 px location icon exists yet; the map mascot is drawn at the tile size.
		sprite: SPRITES.moduleLocation,
		enabled: () => host.enabled(),
		summary: () => {
			const name = host.contextName();
			if (!name) return "Open a note to set its place";
			const label = host.current()?.label;
			return label || `No location for ${name}`;
		},
		render: (body) => {
			const name = host.contextName();
			if (!name) {
				body.createEl("p", { cls: "vaultmate-muted", text: "Open a note first." });
				return;
			}
			const panel = createPanel(body);
			panel.createEl("p", { cls: "vaultmate-muted", text: `Location of ${name}` });
			const current = host.current();
			if (current) {
				if (current.label) panel.createEl("p", { cls: "vaultmate-action-name", text: current.label });
				if (current.position) {
					const { latitude, longitude } = current.position;
					panel.createEl("p", { text: `${latitude}, ${longitude}` });
					panel.createEl("a", { text: "Open in OpenStreetMap", href: openStreetMapUrl(current.position) });
				}
			} else {
				panel.createEl("p", { cls: "vaultmate-empty-title", text: "No location yet" });
			}
			const actions = body.createDiv({ cls: "vaultmate-actions" });
			actions.createEl("button", { cls: "vaultmate-button mod-cta", text: "Search a place", attr: { type: "button" } }).addEventListener("click", () => host.search());
			if (host.canAddCurrent()) {
				actions.createEl("button", { cls: "vaultmate-button", text: "Add current location", attr: { type: "button" } }).addEventListener("click", () => host.addCurrent());
			}
		},
	};
}
