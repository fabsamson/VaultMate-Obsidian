import { Notice, PluginSettingTab, SecretComponent, type Setting, type SettingDefinitionItem } from "obsidian";

import { validateBaseUrl } from "./core/ai/endpoint";
import { DEFAULT_SETTINGS, validateActionsFolder, validateDistinctTags, validateTag } from "./core/settings-model";
import { createDefaultActions } from "./features/ai-actions/default-actions";
import type VaultMatePlugin from "./main";

/** Controls use `feature.name` keys (`journal.enabled`), which map to the nested settings object. */
export class VaultMateSettingTab extends PluginSettingTab {
	public constructor(private readonly plugin: VaultMatePlugin) {
		super(plugin.app, plugin);
	}

	public getSettingDefinitions(): SettingDefinitionItem[] {
		const { journal } = this.plugin.settings;
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
						desc: "Creates the Challenge this note action in the actions folder, without overwriting anything.",
						render: (setting) => setting.addButton((button) => button.setButtonText("Create actions").onClick(() => void this.createActions())),
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
		return this.featureSettings(feature)?.[name];
	}

	public async setControlValue(key: string, value: unknown): Promise<void> {
		const [feature = "", name = ""] = key.split(".");
		const settings = this.featureSettings(feature);
		if (!settings) return;
		settings[name] = value;
		await this.plugin.saveSettings();
		this.plugin.onSettingsChanged();
	}

	private featureSettings(feature: string): Record<string, unknown> | undefined {
		return (this.plugin.settings as unknown as Record<string, Record<string, unknown> | undefined>)[feature];
	}
}
