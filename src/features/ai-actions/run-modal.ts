// The run window of an action: preview of what will be sent, one explicit Send, then the question cards.
import { Modal, Notice, setIcon, type App } from "obsidian";

import { complete, configurationProblem } from "../../core/ai/client";
import { baseUrlHost } from "../../core/ai/endpoint";
import type VaultMatePlugin from "../../main";
import { createPanel, createSectionHeader } from "../../ui/components";
import { isConfirmed, withConfirmation } from "./confirmation";
import type { ActionDefinition } from "./definition";
import { insertQuestions } from "./insert-write";
import { renderLine } from "./insertion";
import { parseQuestions, type Question } from "./questions";
import { buildMessages, collectSources, sourceProblem, type RequestMessages, type SourceInput } from "./request";
import type { SourceText } from "./sources";

/** The note an action runs on, with what was read from it when the action started. */
export interface RunContext extends SourceInput {
	path: string;
}

const SOURCE_LABELS = { note: "Note", selection: "Selection", properties: "Properties" } as const;

function formatCount(count: number): string {
	return `${count.toLocaleString("en-US")} characters`;
}

type State = { type: "preview" } | { type: "loading" } | { type: "results"; questions: Question[] } | { type: "error"; message: string };

export class RunModal extends Modal {
	private readonly sources: SourceText[];
	private readonly messages: RequestMessages;
	private state: State = { type: "preview" };
	private closed = false;

	public constructor(
		app: App,
		private readonly plugin: VaultMatePlugin,
		private readonly action: ActionDefinition,
		private readonly context: RunContext,
	) {
		super(app);
		this.modalEl.addClass("vaultmate");
		this.sources = collectSources(action, context);
		this.messages = buildMessages(action, this.sources);
	}

	public onOpen(): void {
		this.render();
	}

	public onClose(): void {
		this.closed = true;
		this.contentEl.empty();
	}

	private get host(): string {
		return baseUrlHost(this.plugin.settings.ai.baseUrl);
	}

	private render(): void {
		const { contentEl, action } = this;
		contentEl.empty();
		createSectionHeader(contentEl, action.name);
		if (action.description) contentEl.createEl("p", { cls: "vaultmate-muted", text: action.description });
		switch (this.state.type) {
			case "preview":
				this.renderPreview();
				break;
			case "loading":
				createPanel(contentEl).createEl("p", { text: `Waiting for ${this.host}…` });
				break;
			case "results":
				this.renderResults(this.state.questions);
				break;
			case "error":
				this.renderError(this.state.message);
				break;
		}
	}

	private button(parent: HTMLElement, text: string, cta: boolean, onClick: () => void): HTMLButtonElement {
		const button = parent.createEl("button", { cls: cta ? "vaultmate-button mod-cta" : "vaultmate-button", text, attr: { type: "button" } });
		button.addEventListener("click", onClick);
		return button;
	}

	// ---- Preview ------------------------------------------------------------------------------------

	private problem(): string | null {
		const { ai } = this.plugin.settings;
		if (!ai.enabled) return "AI actions are turned off in the VaultMate settings.";
		return sourceProblem(this.sources) ?? configurationProblem(this.app, ai);
	}

	private renderPreview(): void {
		const { contentEl, action, sources, context } = this;
		const { ai, aiState } = this.plugin.settings;
		const panel = createPanel(contentEl);
		const row = (label: string, value: string): void => {
			const line = panel.createDiv({ cls: "vaultmate-source-row" });
			line.createSpan({ cls: "vaultmate-field-label", text: label });
			line.createSpan({ text: value });
		};
		row("Note", context.path);
		row("Sent to", `${this.host} · ${ai.model.trim()}`);
		for (const source of sources) row(SOURCE_LABELS[source.name], `${formatCount(source.chars)}${source.truncated ? " (truncated)" : ""}`);
		row("Total", formatCount(sources.reduce((sum, source) => sum + source.chars, 0)));

		const details = contentEl.createEl("details", { cls: "vaultmate-details" });
		details.createEl("summary", { text: "Show the exact messages" });
		details.createEl("pre", { cls: "vaultmate-pre", text: `System:\n${this.messages.system}\n\nUser:\n${this.messages.user}` });

		const problem = this.problem();
		if (problem) contentEl.createEl("p", { cls: "vaultmate-error", text: problem, attr: { role: "alert" } });

		const needsConfirmation = !isConfirmed(aiState.confirmed, action.path, action.sources);
		let box: HTMLInputElement | null = null;
		if (needsConfirmation && !problem) {
			const label = contentEl.createEl("label", { cls: "vaultmate-confirm" });
			box = label.createEl("input", { attr: { type: "checkbox" } });
			label.createSpan({ text: `Send this to ${this.host}` });
		}
		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		this.button(actions, "Cancel", false, () => this.close());
		const send = this.button(actions, "Send", true, () => void this.send());
		send.disabled = problem !== null || box !== null;
		box?.addEventListener("change", () => {
			send.disabled = !box.checked;
		});
	}

	// ---- The call -----------------------------------------------------------------------------------

	private async send(): Promise<void> {
		const { action, plugin } = this;
		if (this.problem()) return;
		if (!isConfirmed(plugin.settings.aiState.confirmed, action.path, action.sources)) {
			plugin.settings.aiState.confirmed = withConfirmation(plugin.settings.aiState.confirmed, action.path, action.sources);
			await plugin.saveSettings();
		}
		await this.ask();
	}

	/** One request. Called only from a click on Send or Ask again. */
	private async ask(): Promise<void> {
		this.state = { type: "loading" };
		this.render();
		try {
			const answer = await complete(this.app, this.plugin.settings.ai, this.messages);
			if (this.closed) return;
			this.state = { type: "results", questions: parseQuestions(answer, { count: this.action.count, noteText: this.context.raw }) };
		} catch (error) {
			if (this.closed) return;
			this.state = { type: "error", message: error instanceof Error ? error.message : String(error) };
		}
		this.render();
	}

	// ---- Results ------------------------------------------------------------------------------------

	private renderError(message: string): void {
		const { contentEl } = this;
		contentEl.createEl("p", { cls: "vaultmate-error", text: message, attr: { role: "alert" } });
		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		this.button(actions, "Close", false, () => this.close());
		this.button(actions, "Ask again", true, () => void this.ask());
	}

	private renderResults(questions: Question[]): void {
		const { contentEl, action } = this;
		if (questions.length === 0) {
			createPanel(contentEl).createEl("p", { text: "The AI answer had no usable questions." });
			const none = contentEl.createDiv({ cls: "vaultmate-actions" });
			this.button(none, "Close", false, () => this.close());
			this.button(none, "Ask again", true, () => void this.ask());
			return;
		}
		const checks: HTMLInputElement[] = [];
		const list = createPanel(contentEl, "vaultmate-questions");
		for (const question of questions) {
			const card = list.createEl("label", { cls: "vaultmate-question" });
			createActionIcon(card, "circle-help");
			const box = card.createEl("input", { attr: { type: "checkbox" } });
			box.checked = true;
			checks.push(box);
			const body = card.createDiv({ cls: "vaultmate-question-body" });
			if (question.kind) body.createSpan({ cls: "vaultmate-chip", text: question.kind });
			body.createSpan({ cls: "vaultmate-question-text", text: question.text });
		}
		const actions = contentEl.createDiv({ cls: "vaultmate-actions" });
		const selected = (): string[] => questions.filter((_, index) => checks[index]?.checked).map((question) => question.text);

		this.button(actions, "Close", false, () => this.close());
		this.button(actions, "Ask again", false, () => void this.ask());
		this.button(actions, "Copy", false, () => void this.copy(selected()));
		if (action.insert) {
			const { insert } = action;
			this.button(actions, "Insert selected", true, () => void this.insert(insert, selected()));
		}
	}

	private async copy(texts: string[]): Promise<void> {
		if (texts.length === 0) return void new Notice("Select at least one question.");
		const line = this.action.insert?.line;
		await activeWindow.navigator.clipboard.writeText(texts.map((text) => (line ? renderLine(line, text) : text)).join("\n"));
		new Notice("Copied.");
	}

	private async insert(target: NonNullable<ActionDefinition["insert"]>, texts: string[]): Promise<void> {
		if (texts.length === 0) return void new Notice("Select at least one question.");
		const result = await insertQuestions(this.app, this.context.path, target, texts);
		new Notice(
			{
				inserted: "Questions inserted.",
				"already-there": "Those questions are already in the note.",
				"needs-cursor": "Open the note and place the cursor where the questions should go.",
				missing: "VaultMate could not find this note.",
			}[result],
		);
	}
}

/** Small helper for the catalogue and the hub: the action's Lucide icon in `parent`. */
export function createActionIcon(parent: HTMLElement, icon: string): HTMLElement {
	const el = parent.createSpan({ cls: "vaultmate-action-icon", attr: { "aria-hidden": "true" } });
	setIcon(el, icon);
	return el;
}
