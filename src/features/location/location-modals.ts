// The windows of the location feature: the place search and the "replace the location?" question.
import { Modal, requestUrl, type App } from "obsidian";

import { createPanel, createSectionHeader } from "../../ui/components";
import type { Place } from "./location-properties";
import { MIN_REQUEST_INTERVAL_MS, buildSearchUrl, parseSearchResults, requestErrorMessage, type PlaceResult, type SearchOptions } from "./nominatim";

function button(parent: HTMLElement, text: string, cta: boolean, onClick: () => void): HTMLButtonElement {
	const el = parent.createEl("button", { cls: cta ? "vaultmate-button mod-cta" : "vaultmate-button", text, attr: { type: "button" } });
	el.addEventListener("click", onClick);
	return el;
}

/** Time of the last request, shared by every window: Nominatim allows one request per second. */
let lastRequestAt = 0;

async function waitForTurn(): Promise<void> {
	const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
	lastRequestAt = Math.max(Date.now(), lastRequestAt + MIN_REQUEST_INTERVAL_MS);
	if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
}

export class SearchModal extends Modal {
	private query = "";
	private results: PlaceResult[] = [];
	private message = "";
	private busy = false;
	private chosen: PlaceResult | null = null;
	private label = "";
	private closed = false;

	public constructor(
		app: App,
		private readonly noteName: string,
		private readonly userAgent: string,
		/** Search options read when the search runs (language, last position). */
		private readonly options: () => SearchOptions,
		private readonly onChoose: (place: Place) => void,
	) {
		super(app);
		this.modalEl.addClass("vaultmate");
	}

	public onOpen(): void {
		this.render(true);
	}

	public onClose(): void {
		this.closed = true;
		this.contentEl.empty();
	}

	private render(focusInput = false): void {
		const { contentEl } = this;
		contentEl.empty();
		createSectionHeader(contentEl, "Search a place");
		contentEl.createEl("p", { cls: "vaultmate-muted", text: `The location of ${this.noteName} will be set from the place you choose. Only the text you type is sent to OpenStreetMap, when you press Search.` });

		const row = contentEl.createDiv({ cls: "vaultmate-search-row" });
		const input = row.createEl("input", { cls: "vaultmate-input", attr: { type: "text", placeholder: "Name, address or city", "aria-label": "Place to search" } });
		input.value = this.query;
		const search = button(row, "Search", true, () => void this.search());
		search.disabled = this.busy;
		input.addEventListener("input", () => {
			this.query = input.value;
		});
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.isComposing) {
				event.preventDefault();
				void this.search();
			}
		});

		if (this.message) contentEl.createEl("p", { cls: "vaultmate-muted", text: this.message, attr: { role: "status" } });
		if (this.results.length > 0) this.renderResults();
		if (this.chosen) this.renderLabel();

		const attribution = contentEl.createEl("p", { cls: "vaultmate-muted" });
		attribution.appendText("© ");
		attribution.createEl("a", { text: "OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" });
		if (focusInput) input.focus();
	}

	private renderResults(): void {
		const list = createPanel(this.contentEl, "vaultmate-places");
		for (const result of this.results) {
			const item = list.createEl("button", { cls: "vaultmate-place", attr: { type: "button" } });
			item.toggleClass("is-selected", result === this.chosen);
			item.createDiv({ cls: "vaultmate-action-name", text: result.name || "Unnamed place" });
			const detail = [result.type, result.address].filter((part) => part !== "").join(" · ");
			if (detail) item.createDiv({ cls: "vaultmate-muted", text: detail });
			item.addEventListener("click", () => {
				this.chosen = result;
				this.label = result.name;
				this.render();
			});
		}
	}

	private renderLabel(): void {
		const { contentEl } = this;
		const field = contentEl.createDiv({ cls: "vaultmate-field" });
		field.createEl("label", { cls: "vaultmate-field-label", text: "Label written to the note" });
		const input = field.createEl("input", { cls: "vaultmate-input", attr: { type: "text" } });
		input.value = this.label;
		input.addEventListener("input", () => {
			this.label = input.value;
		});
		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		button(actions, "Cancel", false, () => this.close());
		button(actions, "Add to note", true, () => {
			const chosen = this.chosen;
			if (!chosen) return;
			this.close();
			this.onChoose({ latitude: chosen.latitude, longitude: chosen.longitude, label: this.label });
		});
	}

	private async search(): Promise<void> {
		const query = this.query.trim();
		if (!query || this.busy) return;
		this.busy = true;
		this.chosen = null;
		this.results = [];
		this.message = "Searching…";
		this.render();
		try {
			await waitForTurn();
			const response = await requestUrl({ url: buildSearchUrl(query, this.options()), headers: { "User-Agent": this.userAgent }, throw: false });
			if (this.closed) return;
			if (response.status !== 200) {
				this.message = requestErrorMessage(response.status);
			} else {
				this.results = parseSearchResults(response.json);
				this.message = this.results.length === 0 ? "No place found. Try other words, or add a city." : "";
			}
		} catch {
			if (this.closed) return;
			this.message = requestErrorMessage(null);
		}
		this.busy = false;
		this.render(true);
	}
}

/** Asks whether the location already in the note may be replaced. */
export class ReplaceModal extends Modal {
	private answered = false;

	public constructor(
		app: App,
		private readonly before: string,
		private readonly after: string,
		private readonly answer: (replace: boolean) => void,
	) {
		super(app);
		this.modalEl.addClass("vaultmate");
	}

	public onOpen(): void {
		const { contentEl } = this;
		createSectionHeader(contentEl, "Replace the location of this note?");
		const panel = createPanel(contentEl);
		const row = (label: string, value: string): void => {
			const line = panel.createDiv({ cls: "vaultmate-source-row" });
			line.createSpan({ cls: "vaultmate-field-label", text: label });
			line.createSpan({ text: value });
		};
		row("Current", this.before);
		row("New", this.after);
		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		button(actions, "Cancel", false, () => this.finish(false));
		button(actions, "Replace", true, () => this.finish(true));
	}

	public onClose(): void {
		this.contentEl.empty();
		this.finish(false);
	}

	private finish(replace: boolean): void {
		if (this.answered) return;
		this.answered = true;
		this.answer(replace);
		this.close();
	}
}

export function confirmReplace(app: App, before: string, after: string): Promise<boolean> {
	return new Promise((resolve) => new ReplaceModal(app, before, after, resolve).open());
}
