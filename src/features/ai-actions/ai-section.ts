// The hub's "AI" section: the valid actions as compact cards.
import type { HubSection } from "../../ui/hub-view";
import { createPanel } from "../../ui/components";
import type { ActionDefinition, ActionEntry } from "./definition";
import { createActionIcon } from "./run-modal";

export interface AiSectionHost {
	enabled(): boolean;
	entries(): ActionEntry[];
	folder(): string;
	/** Path of the note an action started from the hub runs on, or null. */
	contextPath(): string | null;
	run(action: ActionDefinition): void;
}

export function createAiSection(host: AiSectionHost): HubSection {
	return {
		id: "ai-actions",
		order: 30,
		label: "AI",
		kanji: "問",
		enabled: () => host.enabled(),
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
			const path = host.contextPath();
			body.createEl("p", { cls: "vaultmate-muted", text: path ? `Runs on ${path}. Nothing is sent before you confirm.` : "Open a note first." });
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
