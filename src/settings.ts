import { PluginSettingTab, type SettingDefinitionItem } from "obsidian";

import { validateDistinctTags, validateTag } from "./core/settings-model";
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
		];
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
