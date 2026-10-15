// The hub's "Ideas" page: what to tend (open ideas by age) and what became of the others.
import { startOfDay } from "../../core/dates";
import { createChipRow, createPanel, createSectionHeader } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
import { createSprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import { baseName } from "../context/note-meta";
import { addScopeControls } from "../journal/scope-control";
import { ideaAge, type AgeGroup, type IdeaItem } from "./idea-line";
import {
	ageText,
	doneDate,
	groupOpen,
	inScope,
	itemResult,
	itemStatement,
	monthSummary,
	PROCESSED_FILTERS,
	processedRows,
	resultLabel,
	seedCount,
	seedLine,
	tendSummary,
	type ProcessedFilter,
} from "./ideas-model";

export const IDEAS_PAGE_ID = "ideas";

/** Processed ideas shown at first, and added by each "Show more". */
const PROCESSED_PAGE = 20;

export interface IdeasPageHost {
	enabled(): boolean;
	/** The tag ideas carry, without `#`. */
	tag(): string;
	/** The project seed sub-tag; empty when seeds are off. */
	seedSubtag(): string;
	items(): IdeaItem[];
	/** Path of the active Markdown note, else the most recent one, or null. */
	activeNote(): string | null;
	/** Every Markdown note of the vault. */
	markdownPaths(): string[];
	/** Opens the note at the idea's line. */
	openItem(item: IdeaItem): void;
	/** Opens the note an idea was sent to. */
	openTarget(item: IdeaItem): void;
	/** Opens the portal. */
	process(item: IdeaItem): void;
	/** Drops the idea without a note, and offers Undo. */
	drop(item: IdeaItem): void;
	/** Starts Tend mode over these (fresh) ideas. */
	tend(items: IdeaItem[]): void;
}

const GROUPS: ReadonlyArray<{ group: AgeGroup; title: string }> = [
	{ group: "fresh", title: "Fresh" },
	{ group: "waiting", title: "Waiting" },
	{ group: "wilting", title: "Wilting" },
];

export function createIdeasPage(host: IdeasPageHost): HubPage {
	let filter: ProcessedFilter = "all";
	let shown = PROCESSED_PAGE;

	const renderEmpty = (parent: HTMLElement): void => {
		const panel = createPanel(parent, "vaultmate-empty");
		createSprite(panel, SPRITES.mascotSleep, 96);
		panel.createEl("p", { cls: "vaultmate-empty-title", text: "No ideas yet" });
		panel.createEl("p", { cls: "vaultmate-muted", text: `Type Idea: or end a line with #${host.tag()} in any note.` });
	};

	const renderCard = (list: HTMLElement, item: IdeaItem, today: Date): void => {
		const statement = itemStatement(item) || "(no text yet)";
		const card = createPanel(list.createEl("li"), "vaultmate-idea-card");
		const open = card.createEl("button", { cls: "vaultmate-idea-statement", text: statement, attr: { type: "button", "aria-label": `Open the note at this idea: ${statement}` } });
		open.addEventListener("click", () => host.openItem(item));
		card.createEl("p", { cls: "vaultmate-muted", text: `in ${baseName(item.path)} · ${ageText(ideaAge(item.date, today))}` });
		const actions = card.createDiv({ cls: "vaultmate-related-actions" });
		const process = actions.createEl("button", { cls: "vaultmate-button", text: "Process", attr: { type: "button", "aria-label": `Process idea: ${statement}` } });
		process.addEventListener("click", () => host.process(item));
		const drop = actions.createEl("button", { cls: "vaultmate-button", text: "Drop", attr: { type: "button", "aria-label": `Drop idea: ${statement}` } });
		drop.addEventListener("click", () => host.drop(item));
	};

	const renderToTend = (parent: HTMLElement, items: IdeaItem[], today: Date): void => {
		createSectionHeader(parent, "To tend");
		const groups = groupOpen(items, today, { tag: host.tag(), subtag: host.seedSubtag() });
		if (groups.fresh.length + groups.waiting.length + groups.wilting.length === 0) {
			parent.createEl("p", { cls: "vaultmate-muted", text: "Nothing to tend." });
			return;
		}
		if (groups.fresh.length > 0) {
			const tend = parent.createEl("button", { cls: "vaultmate-button mod-cta", text: "Tend fresh ideas", attr: { type: "button" } });
			tend.addEventListener("click", () => host.tend(groups.fresh));
		}
		for (const { group, title } of GROUPS) {
			const entries = groups[group];
			if (entries.length === 0) continue;
			const section = parent.createDiv({ cls: "vaultmate-review-group" });
			section.createDiv({ cls: "vaultmate-review-group-title", text: `${title} · ${entries.length}`, attr: { role: "heading", "aria-level": "3" } });
			const list = section.createEl("ul", { cls: "vaultmate-related-list" });
			for (const item of entries) renderCard(list, item, today);
		}
	};

	const renderRow = (list: HTMLElement, item: IdeaItem): void => {
		const statement = itemStatement(item) || "(no text yet)";
		const row = list.createDiv({ cls: "vaultmate-idea-row" });
		const open = row.createEl("button", { cls: "vaultmate-idea-statement", text: statement, attr: { type: "button", "aria-label": `Open the note at this idea: ${statement}` } });
		open.addEventListener("click", () => host.openItem(item));
		const meta = row.createDiv({ cls: "vaultmate-idea-meta vaultmate-muted" });
		meta.createSpan({ text: resultLabel(itemResult(item)) });
		if (item.resultTarget !== null) {
			const target = meta.createEl("button", { cls: "vaultmate-inline-link", text: item.resultTarget, attr: { type: "button", "aria-label": `Open ${item.resultTarget}` } });
			target.addEventListener("click", () => host.openTarget(item));
		}
		const done = doneDate(item);
		if (done !== null) meta.createSpan({ text: done });
	};

	const renderProcessed = (parent: HTMLElement, items: IdeaItem[]): void => {
		createSectionHeader(parent, "Processed");
		const results = parent.createDiv();
		const renderResults = (): void => {
			results.empty();
			const rows = processedRows(items, filter);
			if (rows.length === 0) {
				results.createEl("p", { cls: "vaultmate-muted", text: "Nothing here yet." });
				return;
			}
			const list = results.createDiv({ cls: "vaultmate-idea-rows" });
			for (const item of rows.slice(0, shown)) renderRow(list, item);
			if (rows.length > shown) {
				const more = results.createEl("button", { cls: "vaultmate-link", text: "Show more", attr: { type: "button" } });
				more.addEventListener("click", () => {
					shown += PROCESSED_PAGE;
					renderResults();
				});
			}
		};
		const chips = createChipRow(parent, {
			label: "Result",
			choices: PROCESSED_FILTERS,
			value: filter,
			onChange: (value) => {
				filter = value;
				shown = PROCESSED_PAGE;
				renderResults();
			},
		});
		parent.insertBefore(chips.el, results);
		renderResults();
	};

	return {
		id: IDEAS_PAGE_ID,
		order: 15,
		title: "Ideas",
		sprite: SPRITES.moduleIdea,
		enabled: () => host.enabled(),
		summary: () => tendSummary(host.items(), startOfDay(), { tag: host.tag(), subtag: host.seedSubtag() }),
		render: (body, ctx) => {
			if (host.items().length === 0) {
				renderEmpty(body);
				return;
			}
			const controls = body.createDiv({ cls: "vaultmate-switcher" });
			let allowed = addScopeControls(controls, ctx, host.activeNote(), host.markdownPaths(), (next) => {
				allowed = next;
				renderContent();
			});
			const content = body.createDiv();
			const renderContent = (): void => {
				content.empty();
				const items = inScope(host.items(), allowed);
				if (items.length === 0) {
					renderEmpty(content);
					return;
				}
				content.createEl("p", { cls: "vaultmate-muted", text: monthSummary(items, startOfDay()) });
				const seeds = seedLine(seedCount(items, { tag: host.tag(), subtag: host.seedSubtag() }));
				if (seeds !== null) content.createEl("p", { cls: "vaultmate-muted", text: seeds });
				renderToTend(content.createDiv({ cls: "vaultmate-hub-section" }), items, startOfDay());
				renderProcessed(content.createDiv({ cls: "vaultmate-hub-section" }), items);
			};
			shown = PROCESSED_PAGE;
			renderContent();
		},
	};
}
