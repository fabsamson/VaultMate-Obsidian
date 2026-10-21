// The hub's "Ideas" page: what to tend (open ideas by age) and what became of the others.
import { keepTogether, startOfDay } from "../../core/dates";
import { createChipRow, createIconButton, createInfoPanel, createPanel, createSectionHeader, createSpriteButton } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
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
		createInfoPanel(parent, { sprite: SPRITES.mascotSleep, title: "No ideas yet", text: `Type Idea: or end a line with #${host.tag()} in any note.` });
	};

	const renderCard = (list: HTMLElement, item: IdeaItem, today: Date): void => {
		const statement = itemStatement(item) || "(no text yet)";
		const card = createPanel(list.createEl("li"), "vaultmate-idea-card");
		const open = card.createEl("button", { cls: "vaultmate-idea-statement", text: statement, attr: { type: "button", "aria-label": `Open the note at this idea: ${statement}` } });
		open.addEventListener("click", () => host.openItem(item));
		card.createEl("p", { cls: "vaultmate-muted", text: `in ${baseName(item.path)} · ${keepTogether(ageText(ideaAge(item.date, today)))}` });
		const actions = card.createDiv({ cls: "vaultmate-related-actions vaultmate-icon-actions" });
		createIconButton(actions, SPRITES.actionProcess, `Process idea: ${statement}`, () => host.process(item));
		createIconButton(actions, SPRITES.actionDrop, `Drop idea: ${statement}`, () => host.drop(item));
	};

	const renderToTend = (parent: HTMLElement, items: IdeaItem[], today: Date): void => {
		createSectionHeader(parent, "To tend");
		const groups = groupOpen(items, today, { tag: host.tag(), subtag: host.seedSubtag() });
		if (groups.fresh.length + groups.waiting.length + groups.wilting.length === 0) {
			createInfoPanel(parent, { sprite: SPRITES.mascotTea, title: "Nothing to tend", compact: true });
			return;
		}
		if (groups.fresh.length > 0) {
			const tend = createSpriteButton(parent, { sprite: SPRITES.actionProcess, text: "Tend fresh ideas", cta: true });
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
				createInfoPanel(results, { sprite: SPRITES.mascotSleep, title: "Nothing here yet", compact: true });
				return;
			}
			const list = results.createDiv({ cls: "vaultmate-idea-rows" });
			for (const item of rows.slice(0, shown)) renderRow(list, item);
			if (rows.length > shown) {
				const more = results.createEl("button", { cls: "vaultmate-button vaultmate-show-more", text: `Show ${Math.min(PROCESSED_PAGE, rows.length - shown)} more`, attr: { type: "button" } });
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
				content.createEl("p", { cls: "vaultmate-muted", text: keepTogether(monthSummary(items, startOfDay())) });
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
