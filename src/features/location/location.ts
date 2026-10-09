// The location feature: place search, the properties it writes, the hub page and the commands.
import { MarkdownView, Notice, Platform, getLanguage, type ObsidianProtocolData, type TFile } from "obsidian";

import type VaultMatePlugin from "../../main";
import {
	addPending,
	checkEcho,
	echoRequestUrl,
	locationRequestUrl,
	nonceFromBytes,
	parseLocationCallback,
	parsePending,
	type RequestKind,
} from "./android-link";
import { confirmReplace, SearchModal } from "./location-modals";
import { createLocationPage, type CurrentLocation } from "./location-page";
import { planLocation, readCoordinates, roundCoordinate, type Place, type PropertyNames } from "./location-properties";
import { simpleLanguage, userAgent, type LatLng } from "./nominatim";

/** Per device and vault (never in data.json): the last position used, to rank search results. */
const LAST_POSITION_KEY = "vaultmate-location-last";

/** Per device and vault: requests sent to the VaultMate app and not answered yet. */
const PENDING_KEY = "vaultmate-location-pending";

export class LocationFeature {
	public constructor(private readonly plugin: VaultMatePlugin) {}

	public enabled(): boolean {
		return this.plugin.settings.location.enabled;
	}

	private names(): PropertyNames {
		const { latitudeProperty, longitudeProperty, labelProperty } = this.plugin.settings.location;
		return { latitude: latitudeProperty, longitude: longitudeProperty, label: labelProperty };
	}

	/** Call from `onload`. */
	public register(): void {
		const { plugin } = this;
		plugin.addCommand({
			id: "search-place",
			name: "Search a place",
			icon: "map-pin",
			checkCallback: (checking) => {
				const file = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file;
				if (!file || !this.enabled()) return false;
				if (!checking) this.openSearch(file);
				return true;
			},
		});
		plugin.addCommand({
			id: "add-current-location",
			name: "Add current location",
			icon: "locate-fixed",
			checkCallback: (checking) => {
				const file = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file;
				if (!file || !this.canAddCurrent()) return false;
				if (!checking) this.requestCurrent(file);
				return true;
			},
		});
		plugin.addCommand({
			id: "test-app-link",
			name: "Test the Android app link",
			icon: "link",
			checkCallback: (checking) => {
				if (!this.enabled() || !plugin.settings.location.androidApp) return false;
				if (!checking) this.sendRequest("echo", "");
				return true;
			},
		});
		plugin.registerObsidianProtocolHandler("vaultmate-location", (params) => void this.onLocationCallback(params));
		plugin.registerObsidianProtocolHandler("vaultmate-echo", (params) => this.onEchoCallback(params));
		plugin.registerHubPage(
			createLocationPage({
				enabled: () => this.enabled(),
				contextName: () => plugin.contextFile()?.basename ?? null,
				current: () => this.currentLocation(plugin.contextFile()),
				canAddCurrent: () => this.canAddCurrent(),
				search: () => {
					const file = plugin.contextFile();
					if (file) this.openSearch(file);
				},
				addCurrent: () => {
					const file = plugin.contextFile();
					if (file) this.requestCurrent(file);
				},
			}),
		);
		// The page shows the properties of a note: redraw when they change.
		plugin.registerEvent(plugin.app.metadataCache.on("changed", (file) => {
			if (file.path === plugin.contextFile()?.path) plugin.refreshHubs();
		}));
	}

	/** The option is on and this is Obsidian on Android, the only place the app can answer. */
	private canAddCurrent(): boolean {
		return this.enabled() && this.plugin.settings.location.androidApp && Platform.isAndroidApp;
	}

	private currentLocation(file: TFile | null): CurrentLocation | null {
		if (!file) return null;
		const names = this.names();
		const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		const label: unknown = frontmatter?.[names.label];
		const position = readCoordinates(frontmatter, names);
		const text = typeof label === "string" ? label.trim() : "";
		return text || position ? { label: text, position } : null;
	}

	// ---- Last position ------------------------------------------------------------------------------

	private lastPosition(): LatLng | null {
		const saved: unknown = this.plugin.app.loadLocalStorage(LAST_POSITION_KEY);
		if (typeof saved !== "object" || saved === null) return null;
		const { latitude, longitude } = saved as Record<string, unknown>;
		return typeof latitude === "number" && typeof longitude === "number" && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
	}

	// ---- Search -------------------------------------------------------------------------------------

	private openSearch(file: TFile): void {
		const { plugin } = this;
		new SearchModal(
			plugin.app,
			file.basename,
			userAgent(plugin.manifest.version),
			() => ({ language: simpleLanguage(getLanguage()), near: this.lastPosition() }),
			(place) => void this.applyPlace(file, place),
		).open();
	}

	// ---- Writing ------------------------------------------------------------------------------------

	/** Plans, asks when something would be replaced, then writes the three properties and nothing else. */
	public async applyPlace(file: TFile, place: Place, accuracy?: number): Promise<boolean> {
		const { app } = this.plugin;
		const names = this.names();
		const plan = planLocation(app.metadataCache.getFileCache(file)?.frontmatter, names, place);
		if (plan.kind === "unchanged") {
			new Notice(`${file.basename} already has this location.`);
			return false;
		}
		const confirmed = plan.kind === "confirm";
		if (confirmed && !(await confirmReplace(app, plan.before, plan.after))) return false;

		let refused = false;
		await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			// The note may have changed while the question was open: check again before writing.
			if (!confirmed && planLocation(frontmatter, names, place).kind === "confirm") {
				refused = true;
				return;
			}
			for (const [key, value] of Object.entries(plan.values)) frontmatter[key] = value;
		});
		if (refused) {
			new Notice("The note changed in the meantime. Nothing was written; try again.");
			return false;
		}
		app.saveLocalStorage(LAST_POSITION_KEY, { latitude: roundCoordinate(place.latitude), longitude: roundCoordinate(place.longitude) });
		const where = place.label.trim() || `${roundCoordinate(place.latitude)}, ${roundCoordinate(place.longitude)}`;
		new Notice(`Location added: ${where}${accuracy === undefined ? "" : ` (±${Math.round(accuracy)} m)`}`);
		this.plugin.refreshHubs();
		return true;
	}

	// ---- VaultMate Android app ----------------------------------------------------------------------

	private requestCurrent(file: TFile): void {
		this.sendRequest("location", file.path);
	}

	/** Remembers the request, then opens the app's link. Obsidian may be suspended until the app answers. */
	private sendRequest(kind: RequestKind, path: string): void {
		const { app } = this.plugin;
		const nonce = nonceFromBytes(crypto.getRandomValues(new Uint8Array(16)));
		const now = Date.now();
		const list = addPending(parsePending(app.loadLocalStorage(PENDING_KEY)), { nonce, kind, path, createdAt: now }, now);
		app.saveLocalStorage(PENDING_KEY, list);
		activeWindow.open(kind === "echo" ? echoRequestUrl(nonce) : locationRequestUrl(nonce));
	}

	private async onLocationCallback(params: ObsidianProtocolData): Promise<void> {
		const { app } = this.plugin;
		if (!this.canAddCurrentSetting()) {
			new Notice("The VaultMate app link is turned off in the VaultMate settings.");
			return;
		}
		const result = parseLocationCallback(params, parsePending(app.loadLocalStorage(PENDING_KEY)), Date.now());
		app.saveLocalStorage(PENDING_KEY, result.rest);
		if (!result.ok) {
			new Notice(result.message);
			return;
		}
		const file = app.vault.getFileByPath(result.request.path);
		if (!file) {
			new Notice(`The note ${result.request.path} no longer exists. Nothing was written.`);
			return;
		}
		await this.applyPlace(file, result.place, result.accuracy);
	}

	private onEchoCallback(params: ObsidianProtocolData): void {
		const { app } = this.plugin;
		const result = checkEcho(params, parsePending(app.loadLocalStorage(PENDING_KEY)), Date.now());
		app.saveLocalStorage(PENDING_KEY, result.rest);
		new Notice(result.ok ? "Link test passed" : result.message, result.ok ? undefined : 10000);
	}

	private canAddCurrentSetting(): boolean {
		return this.enabled() && this.plugin.settings.location.androidApp;
	}
}
