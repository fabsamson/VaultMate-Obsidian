import { Notice, PluginSettingTab, SecretComponent, type Setting, type SettingDefinitionItem } from "obsidian";

import { validateBaseUrl } from "./core/ai/endpoint";
import { DEFAULT_SETTINGS, MAX_CONNECTIONS, validateActionsFolder, validateDistinctCollectionProperties, validateDistinctProperties, validateDistinctTags, validatePropertyList, validatePropertyName, validateTag, parseList, cleanFolderPath } from "./core/settings-model";
import { createDefaultActions } from "./features/ai-actions/default-actions";
import type VaultMatePlugin from "./main";

/** Settings stored as a list but edited as comma-separated text. */
const LIST_KEYS = new Set(["context.excludedFolders", "context.peopleProperties"]);
/** Settings stored as a number but edited in a dropdown, which holds text. */
const NUMBER_KEYS = new Set(["context.maxConnections"]);

/** Controls use `feature.name` keys (`journal.enabled`), which map to the nested settings object. */
export class VaultMateSettingTab extends PluginSettingTab {
	public constructor(private readonly plugin: VaultMatePlugin) {
		super(plugin.app, plugin);
	}

	public getSettingDefinitions(): SettingDefinitionItem[] {
		const { journal, location, collections } = this.plugin.settings;
		const propertyValidator = (index: 0 | 1 | 2) => (value: string): string | undefined => {
			const names = [location.latitudeProperty, location.longitudeProperty, location.labelProperty];
			names[index] = value;
			return validatePropertyName(value) ?? validateDistinctProperties(names);
		};
		return [
			{
				type: "group",
				heading: "Decision journal",
				items: [
					{
						name: "Enable decision journal",
						desc: "Track decisions and predictions written as task lines, and review them from the VaultMate panel.",
						control: { type: "toggle", key: "journal.enabled" },
					},
					{
						name: "Decision tag",
						desc: "Lines with this tag are decisions. Enter it without #.",
						control: {
							type: "text",
							key: "journal.decisionTag",
							placeholder: "decision",
							validate: (value) => validateTag(value) ?? validateDistinctTags(value, journal.predictionTag),
						},
					},
					{
						name: "Prediction tag",
						desc: "Lines with this tag are predictions. Enter it without #.",
						control: {
							type: "text",
							key: "journal.predictionTag",
							placeholder: "prediction",
							validate: (value) => validateTag(value) ?? validateDistinctTags(journal.decisionTag, value),
						},
					},
				],
			},
			{
				type: "group",
				heading: "AI actions",
				items: [
					{
						name: "Enable AI actions",
						desc: "Run actions defined by files in your vault. Nothing is sent without a click and a preview of what leaves your vault.",
						control: { type: "toggle", key: "ai.enabled" },
					},
					{
						name: "AI base URL",
						desc: "OpenAI-compatible Chat Completions base URL. HTTPS is required, except for a local server.",
						control: { type: "text", key: "ai.baseUrl", placeholder: DEFAULT_SETTINGS.ai.baseUrl, validate: validateBaseUrl },
					},
					{
						name: "AI model",
						desc: "Model identifier supplied by your AI provider.",
						control: { type: "text", key: "ai.model", placeholder: DEFAULT_SETTINGS.ai.model, validate: (value) => (value.trim() ? undefined : "Enter an AI model identifier.") },
					},
					{
						name: "API key secret",
						desc: "Choose or create the named secret that holds your API key. It can be the same secret as another plugin's. The key itself is not saved in the plugin settings. A local server needs no key.",
						render: (setting) => this.addSecretPicker(setting),
					},
					{
						name: "Actions folder",
						desc: "Each Markdown file in this folder is an AI action.",
						control: { type: "folder", key: "ai.actionsFolder", placeholder: DEFAULT_SETTINGS.ai.actionsFolder, validate: validateActionsFolder },
					},
					{
						name: "Create default actions",
						desc: "Creates the Challenge this note and Recommend me actions in the actions folder, without overwriting anything.",
						render: (setting) => setting.addButton((button) => button.setButtonText("Create actions").onClick(() => void this.createActions())),
					},
				],
			},
			{
				type: "group",
				heading: "Collections",
				items: [
					{
						name: "Collections folder",
						desc: "Folder of your collection notes (movies, series, books...). Leave empty to look in the whole vault. Used by the Recommend me action.",
						control: { type: "folder", key: "collections.folder", placeholder: "Whole vault" },
					},
					{
						name: "Type property",
						desc: "Property that tells what a note is, such as movie, series or book.",
						control: {
							type: "text",
							key: "collections.typeProperty",
							placeholder: DEFAULT_SETTINGS.collections.typeProperty,
							validate: (value) => validatePropertyName(value) ?? validateDistinctCollectionProperties(value, collections.ratingProperty),
						},
					},
					{
						name: "Rating property",
						desc: "Property that holds your rating from 0 to 10. 0 or empty means not rated.",
						control: {
							type: "text",
							key: "collections.ratingProperty",
							placeholder: DEFAULT_SETTINGS.collections.ratingProperty,
							validate: (value) => validatePropertyName(value) ?? validateDistinctCollectionProperties(collections.typeProperty, value),
						},
					},
				],
			},
			{
				type: "group",
				heading: "Location",
				items: [
					{
						name: "Enable location",
						desc: "Add a place to a note's properties by searching OpenStreetMap. A search is sent only when you press Search.",
						control: { type: "toggle", key: "location.enabled" },
					},
					{
						name: "Latitude property",
						desc: "Property that receives the latitude, as a number.",
						control: { type: "text", key: "location.latitudeProperty", placeholder: DEFAULT_SETTINGS.location.latitudeProperty, validate: propertyValidator(0) },
					},
					{
						name: "Longitude property",
						desc: "Property that receives the longitude, as a number.",
						control: { type: "text", key: "location.longitudeProperty", placeholder: DEFAULT_SETTINGS.location.longitudeProperty, validate: propertyValidator(1) },
					},
					{
						name: "Place label property",
						desc: "Property that receives the name of the place, as text.",
						control: { type: "text", key: "location.labelProperty", placeholder: DEFAULT_SETTINGS.location.labelProperty, validate: propertyValidator(2) },
					},
					{
						name: "Use the VaultMate Android app for the current position",
						desc: "On Android, adds a command that asks the VaultMate app for your current position. It needs the VaultMate app, which is optional; leave this off without it.",
						control: { type: "toggle", key: "location.androidApp" },
					},
				],
			},
			{
				type: "group",
				heading: "New connections",
				items: [
					{
						name: "Enable new connections",
						desc: "Find a few notes that are not connected to the active note yet but whose ideas could work with it, with the reasons. Everything is computed on this device; nothing is sent anywhere.",
						control: { type: "toggle", key: "context.enabled" },
					},
					{
						name: "Excluded folders",
						desc: "Notes in these folders are never proposed. Separate folders with commas, for example Templates, Scripts.",
						control: { type: "text", key: "context.excludedFolders", placeholder: "Templates, Scripts" },
					},
					{
						name: "People and place properties",
						desc: "Two notes with the same value in one of these properties can be connected. Separate property names with commas.",
						control: { type: "text", key: "context.peopleProperties", placeholder: DEFAULT_SETTINGS.context.peopleProperties.join(", "), validate: validatePropertyList },
					},
					{
						name: "Maximum connections",
						desc: "Most connections shown for a note. Fewer is often better: nothing new is a normal result.",
						control: { type: "dropdown", key: "context.maxConnections", options: Object.fromEntries(Array.from({ length: MAX_CONNECTIONS }, (_, i) => [String(i + 1), String(i + 1)])) },
					},
				],
			},
		];
	}

	private addSecretPicker(setting: Setting): void {
		setting.addComponent((container) =>
			new SecretComponent(this.app, container).setValue(this.plugin.settings.ai.apiKeySecret).onChange(async (value) => {
				this.plugin.settings.ai.apiKeySecret = value;
				await this.plugin.saveSettings();
				this.plugin.onSettingsChanged();
			}),
		);
	}

	private async createActions(): Promise<void> {
		try {
			const created = await createDefaultActions(this.app, this.plugin.settings.ai.actionsFolder);
			new Notice(created.length > 0 ? `Created ${created.join(", ")}` : "The default actions already exist.");
		} catch (error) {
			new Notice(`Unable to create the default actions: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	public getControlValue(key: string): unknown {
		const [feature = "", name = ""] = key.split(".");
		const value = this.featureSettings(feature)?.[name];
		if (NUMBER_KEYS.has(key)) return String(value);
		return LIST_KEYS.has(key) && Array.isArray(value) ? value.join(", ") : value;
	}

	public async setControlValue(key: string, value: unknown): Promise<void> {
		const [feature = "", name = ""] = key.split(".");
		const settings = this.featureSettings(feature);
		if (!settings) return;
		if (NUMBER_KEYS.has(key)) settings[name] = Number(value);
		else settings[name] = LIST_KEYS.has(key) && typeof value === "string" ? parseList(value).map(key === "context.excludedFolders" ? cleanFolderPath : (item) => item).filter((item) => item !== "") : value;
		await this.plugin.saveSettings();
		this.plugin.onSettingsChanged();
	}

	private featureSettings(feature: string): Record<string, unknown> | undefined {
		return (this.plugin.settings as unknown as Record<string, Record<string, unknown> | undefined>)[feature];
	}
}