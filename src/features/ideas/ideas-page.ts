// The hub's "Ideas" page: what to tend (open ideas by age) and what became of the others.
import { keepTogether, startOfDay } from "../../core/dates";
import { matchesQuery } from "../../core/search";
import { createChipRow, createIconButton, createInfoPanel, createPanel, createSectionHeader, createSpriteButton } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
import { addPageSearch, createNoMatch, type PageSearchState } from "../../ui/page-search";
import type { Sprite } from "../../ui/pixel";
import { createSectionNav } from "../../ui/section-nav";
import { SPRITES } from "../../ui/sprites";
import { baseName } from "../context/note-meta";
import { addScopeControls } from "../journal/scope-control";
import { ideaAge, type AgeGroup, type IdeaItem } from "./idea-line";
import {
	ageText,
	doneDate,
	groupOpen,
	ideasSections,
	inScope,
	itemResult,
	itemStatement,
	monthSummary,
	PROCESSED_FILTERS,
	processedRows,
	resultLabel,
	seedCount,
	seedItems,
	seedLine,
	tendSummary,
	type IdeasSectionId,
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
	/** Whether the Projects feature is on (Launch needs it). */
	projectsEnabled(): boolean;
	/** Launches a project seed: opens New project, then closes the seed. */
	launch(item: IdeaItem): void;
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

/** The chip of each section: its mark and its name. */
const SECTION_LOOKS: Record<IdeasSectionId, { sprite: Sprite; label: string }> = {
	fresh: { sprite: SPRITES.stateFresh, label: "Fresh" },
	waiting: { sprite: SPRITES.stateWaiting, label: "Waiting" },
	wilting: { sprite: SPRITES.stateWilting, label: "Wilting" },
	seeds: { sprite: SPRITES.actionSeed, label: "Project seeds" },
	processed: { sprite: SPRITES.stampDone, label: "Processed" },
};

export function createIdeasPage(host: IdeasPageHost): HubPage {
	let filter: ProcessedFilter = "all";
	let shown = PROCESSED_PAGE;
	/** The search, kept while the panel lives. */
	const search: PageSearchState = { query: "" };

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
		createIconButton(actions, SPRITES.actionProcess, "Process", () => host.process(item), { describedBy: open });
		createIconButton(actions, SPRITES.actionDrop, "Drop", () => host.drop(item), { describedBy: open });
	};

	const renderToTend = (parent: HTMLElement, items: IdeaItem[], today: Date): void => {
		const groups = groupOpen(items, today, { tag: host.tag(), subtag: host.seedSubtag() });
		const none = groups.fresh.length + groups.waiting.length + groups.wilting.length === 0;
		if (none && search.query.trim() !== "") {
			parent.remove();
			return;
		}
		createSectionHeader(parent, "To tend");
		if (none) {
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
			const section = parent.createDiv({ cls: "vaultmate-review-group", attr: { "data-section": group } });
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

	/** The project seeds, one line each: the text clamped to two lines, then Launch, Drop and Open in the note. */
	const renderSeeds = (parent: HTMLElement, seeds: IdeaItem[]): void => {
		const group = parent.createDiv({ cls: "vaultmate-review-group", attr: { "data-section": "seeds" } });
		group.createDiv({ cls: "vaultmate-review-group-title", text: `Project seeds · ${seeds.length}`, attr: { role: "heading", "aria-level": "3" } });
		const list = group.createEl("ul", { cls: "vaultmate-idea-lines" });
		for (const item of seeds) {
			const text = itemStatement(item) || "(no text yet)";
			const row = list.createEl("li", { cls: "vaultmate-idea-line" });
			const lineText = row.createSpan({ cls: "vaultmate-idea-line-text", text, attr: { title: text } });
			const actions = row.createDiv({ cls: "vaultmate-icon-actions" });
			if (host.projectsEnabled()) createIconButton(actions, SPRITES.actionLaunch, "Launch", () => host.launch(item), { describedBy: lineText });
			createIconButton(actions, SPRITES.actionDrop, "Drop", () => host.drop(item), { describedBy: lineText });
			createIconButton(actions, SPRITES.actionOpenNote, "Open in the note", () => host.openItem(item), { describedBy: lineText });
		}
	};

	const renderProcessed = (parent: HTMLElement, items: IdeaItem[]): void => {
		if (search.query.trim() !== "" && processedRows(items, "all").length === 0) {
			parent.remove();
			return;
		}
		createSectionHeader(parent, "Processed").dataset.section = "processed";
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
		order: 10,
		title: "Ideas",
		sprite: SPRITES.moduleIdea,
		enabled: () => host.enabled(),
		summary: () => tendSummary(host.items(), startOfDay(), { tag: host.tag(), subtag: host.seedSubtag() }),
		render: (body, ctx) => {
			ctx.setGuide("ideas");
			if (host.items().length === 0) {
				renderEmpty(body);
				return;
			}
			const controls = body.createDiv({ cls: "vaultmate-switcher" });
			let allowed = addScopeControls(controls, ctx, host.activeNote(), host.markdownPaths(), (next) => {
				allowed = next;
				renderContent();
			});
			addPageSearch(body, search, "Search ideas", () => {
				shown = PROCESSED_PAGE;
				renderContent();
			});
			const content = body.createDiv();
			const renderContent = (): void => {
				content.empty();
				const scoped = inScope(host.items(), allowed);
				if (scoped.length === 0) {
					renderEmpty(content);
					return;
				}
				const searching = search.query.trim() !== "";
				const items = searching ? scoped.filter((item) => matchesQuery(`${itemStatement(item)} ${baseName(item.path)}`, search.query)) : scoped;
				if (items.length === 0) {
					createNoMatch(content, search.query);
					return;
				}
				createSectionNav(
					content,
					ideasSections(items, startOfDay(), { tag: host.tag(), subtag: host.seedSubtag() }).map((section) => ({
						...SECTION_LOOKS[section.id],
						id: section.id,
						count: section.count,
						target: () => content.querySelector<HTMLElement>(`[data-section="${section.id}"]`),
					})),
				);
				if (!searching) {
					content.createEl("p", { cls: "vaultmate-muted", text: keepTogether(monthSummary(items, startOfDay())) });
					const seeds = seedLine(seedCount(items, { tag: host.tag(), subtag: host.seedSubtag() }));
					if (seeds !== null) content.createEl("p", { cls: "vaultmate-muted", text: seeds });
				}
				renderToTend(content.createDiv({ cls: "vaultmate-hub-section" }), items, startOfDay());
				const waiting = seedItems(items, { tag: host.tag(), subtag: host.seedSubtag() });
				if (waiting.length > 0) renderSeeds(content.createDiv({ cls: "vaultmate-hub-section" }), waiting);
				renderProcessed(content.createDiv({ cls: "vaultmate-hub-section" }), items);
			};
			shown = PROCESSED_PAGE;
			renderContent();
		},
	};
}
