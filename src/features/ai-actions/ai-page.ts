// The hub's "AI actions" page: the valid actions as compact cards.
import type { HubPage } from "../../ui/hub-view";
import { createIconButton, createInfoPanel, createPanel, createSpriteButton } from "../../ui/components";
import { SPRITES } from "../../ui/sprites";
import type { ActionDefinition, ActionEntry } from "./definition";
import { ACTIONS_GUIDE_URL } from "./action-template";
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
	/** Creates the template action file and opens it in a new tab. */
	newAction(): void;
}

export function createAiPage(host: AiPageHost): HubPage {
	return {
		id: "ai-actions",
		order: 50,
		title: "AI actions",
		sprite: SPRITES.moduleQuestions,
		enabled: () => host.enabled(),
		summary: () => {
			if (host.configurationProblem()) return "Set up a provider in settings";
			const count = host.entries().filter((entry) => entry.ok).length;
			if (count === 0) return "No actions yet";
			const name = host.contextName();
			return `${count} action${count === 1 ? "" : "s"} · ${name ? `runs on ${name}` : "open a note to run"}`;
		},
		render: (body, ctx) => {
			ctx.setGuide("ai-actions");
			const entries = host.entries();
			const valid = entries.flatMap((entry) => (entry.ok ? [entry.action] : []));
			const invalid = entries.length - valid.length;
			if (entries.length === 0) {
				const empty = createInfoPanel(body, { sprite: SPRITES.mascotSleep, title: "No AI actions yet", text: `Create the default actions in the VaultMate settings, or add action files to ${host.folder()}.` });
				createSpriteButton(empty, { sprite: SPRITES.actionNewNote, text: "New action" }).addEventListener("click", () => host.newAction());
				return;
			}
			const name = host.contextName();
			if (name) body.createEl("p", { cls: "vaultmate-muted", text: `Runs on ${name}. Nothing is sent before you confirm.` });
			else createInfoPanel(body, { sprite: SPRITES.mascotSleep, title: "Open a note first", compact: true });
			for (const action of valid) {
				const card = createPanel(body, "vaultmate-action-card");
				createActionIcon(card, action.icon);
				const text = card.createDiv({ cls: "vaultmate-action-text" });
				const nameEl = text.createDiv({ cls: "vaultmate-action-name", text: action.name });
				if (action.description) text.createDiv({ cls: "vaultmate-muted", text: action.description });
				createIconButton(card, SPRITES.actionRun, "Run", () => host.run(action), { describedBy: nameEl });
			}
			if (invalid > 0) body.createEl("p", { cls: "vaultmate-muted", text: `${invalid} unavailable action${invalid === 1 ? "" : "s"}. Run Open AI actions to see why.` });
			const own = createInfoPanel(body, {
				sprite: SPRITES.mascotTea,
				title: "Make your own action",
				text: `An action is a note in ${host.folder()}: its properties say what it reads and returns, its text is the prompt.`,
				compact: true,
			});
			createSpriteButton(own, { sprite: SPRITES.actionNewNote, text: "New action" }).addEventListener("click", () => host.newAction());
			own.createEl("a", { cls: "vaultmate-muted", text: "How actions work", href: ACTIONS_GUIDE_URL });
		},
	};
}
