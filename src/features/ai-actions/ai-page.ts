// The hub's "AI actions" page: the valid actions as compact cards.
import type { HubPage } from "../../ui/hub-view";
import { createPanel } from "../../ui/components";
import { SPRITES } from "../../ui/sprites";
import type { ActionDefinition, ActionEntry } from "./definition";
import { createActionIcon } from "./run-modal";

export interface AiPageHost {
	enabled(): boolean;
	entries(): ActionEntry[];
	folder(): string;
	/** Name of the note an action started from the hub runs on, or null. */
	contextName(): string | null;
	/** What is missing before a call can be made, or null. */
	configurationProblem(): string | null;
	run(action: ActionDefinition): void;
}

export function createAiPage(host: AiPageHost): HubPage {
	return {
		id: "ai-actions",
		order: 30,
		title: "AI actions",
		// Placeholder sprite: switch to module_questions.png once it is in assets.
		sprite: SPRITES.moduleIdeas,
		enabled: () => host.enabled(),
		summary: () => {
			if (host.configurationProblem()) return "Set up a provider in settings";
			const count = host.entries().filter((entry) => entry.ok).length;
			if (count === 0) return "No actions yet";
			const name = host.contextName();
			return `${count} action${count === 1 ? "" : "s"} · ${name ? `runs on ${name}` : "open a note to run"}`;
		},
		render: (body) => {
			const entries = host.entries();
			const valid = entries.flatMap((entry) => (entry.ok ? [entry.action] : []));
			const invalid = entries.length - valid.length;
			if (entries.length === 0) {
				const panel = createPanel(body);
				panel.createEl("p", { cls: "vaultmate-empty-title", text: "No AI actions yet" });
				panel.createEl("p", { cls: "vaultmate-muted", text: `Create the default actions in the VaultMate settings, or add action files to ${host.folder()}.` });
				return;
			}
			const name = host.contextName();
			body.createEl("p", { cls: "vaultmate-muted", text: name ? `Runs on ${name}. Nothing is sent before you confirm.` : "Open a note first." });
			for (const action of valid) {
				const card = createPanel(body, "vaultmate-action-card");
				createActionIcon(card, action.icon);
				const text = card.createDiv({ cls: "vaultmate-action-text" });
				text.createDiv({ cls: "vaultmate-action-name", text: action.name });
				if (action.description) text.createDiv({ cls: "vaultmate-muted", text: action.description });
				const run = card.createEl("button", { cls: "vaultmate-button", text: "Run", attr: { type: "button", "aria-label": `Run ${action.name}` } });
				run.addEventListener("click", () => host.run(action));
			}
			if (invalid > 0) body.createEl("p", { cls: "vaultmate-muted", text: `${invalid} unavailable action${invalid === 1 ? "" : "s"}. Run Open AI actions to see why.` });
		},
	};
}
