// The hub's "Projects" page, on two levels. The dashboard has one tile per project note; a tap opens the
// project's own page in the same view: ideas (one line each), the tracks by status with the decisions and
// predictions written in them, the project's other reviews, and the closed tracks.
import { Menu } from "obsidian";

import { dueLabel, keepTogether, parseDate, startOfDay } from "../../core/dates";
import { matchesQuery } from "../../core/search";
import { createDisclosure, createIconButton, createInfoPanel, createMark, createSpriteButton } from "../../ui/components";
import { focusFromInput } from "../../ui/focus";
import type { HubPage, HubPageContext } from "../../ui/hub-view";
import { addPageSearch, createNoMatch, type PageSearchState } from "../../ui/page-search";
import { createSmallSprite, type Sprite } from "../../ui/pixel";
import { createSectionNav } from "../../ui/section-nav";
import { SPRITES } from "../../ui/sprites";
import type { JournalItem } from "../journal/journal-index";
import { isUntracked, kindName } from "../journal/journal-line";
import { addScopeControls } from "../journal/scope-control";
import { scopePaths } from "../journal/scope";
import type { ProjectContent, ProjectNote } from "./project-index";
import { TRACK_SEALS } from "./track-seals";
import { openTasks, STATUS_INFO, type ProjectIdea, type ProjectTrack, type TrackStatus, type TrackTask } from "./project-note";
import {
	moveTargets,
	needsNextTask,
	nextTaskLine,
	orderTiles,
	primaryAction,
	projectProgress,
	projectProgressText,
	reviewsDueText,
	sectionChips,
	splitEntries,
	summarizeProject,
	taskProgress,
	tileCounters,
	tileSummary,
	type ProjectProgress,
	type ProjectSummary,
	type SectionId,
} from "./projects-model";

export const PROJECTS_PAGE_ID = "projects";

export interface ProjectsPageHost {
	enabled(): boolean;
	/** The project tag, as shown to the user (`#project`). */
	projectTag(): string;
	notes(): ProjectNote[];
	/** The note's lines parsed; from the editor when the note is open there. Null when the note is gone. */
	read(path: string): Promise<ProjectContent | null>;
	/** Path of the active Markdown note, else the most recent one, or null. */
	activeNote(): string | null;
	markdownPaths(): string[];
	/** The `progress` property of the project note (metadata cache), whatever its type; undefined when absent. */
	progressProperty(path: string): unknown;
	/** The journal's entries; empty while the Decisions and predictions module is off. */
	entries(): JournalItem[];
	/** Opens the "Time to judge?" review of an entry. */
	openReview(item: JournalItem): void;
	/** Opens the Track form of an untracked line, as the kind of its tag. */
	track(item: JournalItem): void;
	/** Opens the note at a 0-based line. */
	open(path: string, line: number): void;
	/** Opens the New project form. */
	newProject(): void;
	/** Opens the New track form for the project. */
	newTrack(project: ProjectContent): void;
	/** Opens the Promote form for an idea of the project. */
	promote(project: ProjectContent, idea: ProjectIdea): void;
	drop(path: string, idea: ProjectIdea): void;
	/** Moves the track; Start (to In progress) asks for a first task first. */
	move(path: string, track: ProjectTrack, status: TrackStatus): void;
	addTask(path: string, track: ProjectTrack): void;
	/** Marks an open task done (with today's date) or cancelled, then offers Undo. */
	setTaskState(path: string, task: TrackTask, state: "done" | "cancelled"): void;
	/** Whether the Suggest next steps action can run: it exists and AI is configured. */
	canSuggest(): boolean;
	suggest(path: string, track: ProjectTrack): void;
}

const SEALS = TRACK_SEALS;

/** The seals of the tile counters are 16 px; headings, chips and entries use `createMark`. */
const SMALL = 16;
/** The mark of each section chip: a track status chip shows its seal. */
const CHIP_SPRITES: Record<SectionId, Sprite> = { ideas: SPRITES.stateIdea, reviews: SPRITES.actionReview, closed: SEALS.done, progress: SEALS.progress, backlog: SEALS.backlog, explore: SEALS.explore };
/** The open statuses, in the order of the page. */
const OPEN_STATUSES = ["progress", "backlog", "explore"] as const;

function noteName(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

/** A pixel bar with its text: the project's progress (tile and page header) or the tasks of a track. */
interface Meter {
	label: string;
	now: number;
	max: number;
	text: string;
}

function projectMeter(progress: ProjectProgress): Meter {
	const text = projectProgressText(progress);
	return progress.kind === "percent" ? { label: "Progress", now: progress.percent, max: 100, text } : { label: "Tracks done", now: progress.done, max: progress.total, text };
}

function createMeter(parent: HTMLElement, meter: Meter, cls = ""): void {
	const box = parent.createDiv({ cls: `vaultmate-progress ${cls}`.trim(), attr: { role: "progressbar", "aria-label": meter.label, "aria-valuemin": "0", "aria-valuemax": String(meter.max), "aria-valuenow": String(meter.now), "aria-valuetext": meter.text } });
	box.createDiv({ cls: "vaultmate-progress-bar" }).createDiv({ cls: "vaultmate-progress-fill" }).setCssProps({ "--vaultmate-width": `${(100 * meter.now) / meter.max}%` });
	box.createSpan({ text: meter.text });
}

/** Everything the project page needs about one project. */
interface ProjectView {
	project: ProjectContent;
	byTrack: JournalItem[][];
	outside: JournalItem[];
}

/** What a search leaves of one track: all of it when the title matches, else the matching tasks and entries. */
interface TrackPart {
	tasks: TrackTask[];
	entries: JournalItem[];
}

export function createProjectsPage(host: ProjectsPageHost): HubPage {
	let showOther = false;
	let showClosed = false;
	/** The search, kept while the panel lives; it holds on the dashboard and on a project page. */
	const search: PageSearchState = { query: "" };
	const matches = (text: string): boolean => matchesQuery(text, search.query);

	const sealCounter = (parent: HTMLElement, status: TrackStatus, count: number): void => {
		const counter = parent.createSpan({ cls: "vaultmate-seal-count", attr: { role: "img", "aria-label": `${count} ${STATUS_INFO[status].label.toLowerCase()}` } });
		createSmallSprite(counter, SEALS[status], SMALL);
		counter.createSpan({ text: String(count) });
	};

	// ---- Dashboard ----------------------------------------------------------------------------------

	const renderTile = (parent: HTMLElement, summary: ProjectSummary, open: (path: string) => void): void => {
		const tile = parent.createEl("button", { cls: "vaultmate-project-tile", attr: { type: "button", "data-path": summary.path } });
		tile.createSpan({ cls: "vaultmate-project-tile-name", text: summary.name });
		const { statuses, ideas } = tileCounters(summary);
		const line = tile.createSpan({ cls: "vaultmate-project-tile-line" });
		for (const { status, count } of statuses) sealCounter(line, status, count);
		if (ideas) line.createSpan({ cls: "vaultmate-muted", text: ideas });
		if (statuses.length === 0 && !ideas) line.createSpan({ cls: "vaultmate-muted", text: "No tracks yet" });
		const alert = reviewsDueText(summary.reviewsDue);
		if (alert) line.createSpan({ cls: "vaultmate-track-flag", text: alert });
		const { progress } = summary;
		if (progress) {
			createMeter(tile, projectMeter(progress));
		}
		if (summary.next) tile.createSpan({ cls: "vaultmate-muted vaultmate-project-tile-next", text: `Next: ${keepTogether(nextTaskLine(summary.next))}` });
		tile.addEventListener("click", () => open(summary.path));
	};

	const renderDashboard = (parent: HTMLElement, summaries: ProjectSummary[], open: (path: string) => void): void => {
		const { shown, other } = orderTiles(summaries);
		if (shown.length > 0) {
			const grid = parent.createDiv({ cls: "vaultmate-project-tiles" });
			for (const summary of shown) renderTile(grid, summary, open);
		}
		if (other.length === 0) return;
		const group = parent.createDiv({ cls: "vaultmate-hub-section" });
		const disclosure = createDisclosure(group, { label: `Other projects · ${other.length}`, open: showOther, onToggle: (isOpen) => (showOther = isOpen) });
		const grid = disclosure.body.createDiv({ cls: "vaultmate-project-tiles" });
		for (const summary of other) renderTile(grid, summary, open);
	};

	// ---- Project page -------------------------------------------------------------------------------

	const sectionTitle = (parent: HTMLElement, id: string, sprite: Sprite, text: string): HTMLElement => {
		const section = parent.createDiv({ cls: "vaultmate-project-section", attr: { "data-section": id } });
		const title = section.createDiv({ cls: "vaultmate-project-section-title", attr: { role: "heading", "aria-level": "3" } });
		createMark(title, sprite);
		title.createSpan({ text });
		return section;
	};

	const renderIdeas = (parent: HTMLElement, project: ProjectContent, ideas: readonly ProjectIdea[]): HTMLElement => {
		const section = sectionTitle(parent, "ideas", SPRITES.stateIdea, `Ideas · ${ideas.length}`);
		const list = section.createEl("ul", { cls: "vaultmate-idea-lines" });
		for (const idea of ideas) {
			const text = idea.text || "(no text yet)";
			const row = list.createEl("li", { cls: "vaultmate-idea-line" });
			const lineText = row.createSpan({ cls: "vaultmate-idea-line-text", text, attr: { title: text } });
			const actions = row.createDiv({ cls: "vaultmate-icon-actions" });
			createIconButton(actions, SPRITES.actionPromote, "Promote to a track", () => host.promote(project, idea), { describedBy: lineText });
			createIconButton(actions, SPRITES.actionDrop, "Drop", () => host.drop(project.path, idea), { describedBy: lineText });
			createIconButton(actions, SPRITES.actionOpenNote, "Open in the note", () => host.open(project.path, idea.line), { describedBy: lineText });
		}
		return section;
	};

	/** One open decision or prediction: sprite, statement, review date and Review; an untracked line says so and offers Track. */
	const renderEntry = (parent: HTMLElement, item: JournalItem, projectPath: string, today: Date): void => {
		const { entry } = item;
		const row = parent.createDiv({ cls: "vaultmate-entry-line" });
		createMark(row, entry.kind === "decision" ? SPRITES.stateDecision : SPRITES.statePrediction);
		const main = row.createEl("button", { cls: "vaultmate-entry-main", attr: { type: "button", "aria-label": `Open the note at this ${kindName(entry.kind)}: ${entry.statement}` } });
		const statement = main.createSpan({ cls: "vaultmate-entry-statement", text: entry.statement || "(no text)" });
		const due = entry.due === null ? null : parseDate(entry.due);
		const where = item.path === projectPath ? "" : `${noteName(item.path)} · `;
		main.createSpan({ cls: "vaultmate-muted vaultmate-entry-due", text: `${where}${due ? keepTogether(dueLabel(due, today)) : "not tracked yet"}` });
		main.addEventListener("click", () => host.open(item.path, item.line));
		if (isUntracked(entry)) {
			createIconButton(row, SPRITES.actionTrack, `Track as ${kindName(entry.kind)}`, () => host.track(item), { describedBy: statement });
			return;
		}
		createIconButton(row, SPRITES.actionReview, "Review", () => host.openReview(item), { describedBy: statement });
	};

	/** One open task of a track: sprite, text over its due date, then Done, Drop and Open (a recurring task only has Open). */
	const renderTask = (parent: HTMLElement, projectPath: string, task: TrackTask, today: Date): void => {
		const row = parent.createDiv({ cls: "vaultmate-entry-line" });
		createMark(row, SPRITES.stateTask);
		const main = row.createEl("button", { cls: "vaultmate-entry-main", attr: { type: "button", "aria-label": `Open the note at this task: ${task.text}` } });
		const text = main.createSpan({ cls: "vaultmate-entry-statement", text: task.text || "(no text)" });
		const due = task.due === null ? null : parseDate(task.due);
		if (due) main.createSpan({ cls: "vaultmate-muted vaultmate-entry-due", text: keepTogether(dueLabel(due, today)) });
		main.addEventListener("click", () => host.open(projectPath, task.line));
		const actions = row.createDiv({ cls: "vaultmate-icon-actions" });
		if (!task.recurring) {
			createIconButton(actions, SPRITES.actionDone, "Done", () => host.setTaskState(projectPath, task, "done"), { describedBy: text });
			createIconButton(actions, SPRITES.actionDrop, "Drop", () => host.setTaskState(projectPath, task, "cancelled"), { describedBy: text });
		}
		createIconButton(actions, SPRITES.actionOpenNote, "Open in the note", () => host.open(projectPath, task.line), { describedBy: text });
	};

	const renderTrack = (parent: HTMLElement, view: ProjectView, index: number, today: Date, part: TrackPart): void => {
		const { project } = view;
		const track = project.model.tracks[index];
		if (!track) return;
		const card = parent.createDiv({ cls: "vaultmate-track-row" });
		const row = card.createDiv({ cls: "vaultmate-track-line" });
		const main = row.createDiv({ cls: "vaultmate-track-main" });
		const titleButton = main.createEl("button", { cls: "vaultmate-idea-statement", text: track.title || "(untitled)", attr: { type: "button", "aria-label": `Open the note at this track: ${track.title}` } });
		titleButton.addEventListener("click", () => host.open(project.path, track.line));
		const tasks = taskProgress(track);
		if (tasks) createMeter(main, { label: "Tasks done", now: tasks.done, max: tasks.total, text: `${tasks.done}/${tasks.total} tasks` }, "vaultmate-progress-compact");
		const actions = row.createDiv({ cls: "vaultmate-track-actions" });
		const primary = primaryAction(track.status);
		createIconButton(actions, SEALS[primary.target], primary.label, () => host.move(project.path, track, primary.target), { primary: true, describedBy: titleButton });
		createIconButton(actions, SPRITES.actionMove, "Move to…", (event) => {
			const menu = new Menu();
			for (const status of moveTargets(track.status)) menu.addItem((entry) => entry.setTitle(STATUS_INFO[status].label).onClick(() => host.move(project.path, track, status)));
			menu.showAtMouseEvent(event);
		}, { describedBy: titleButton });
		if (track.status !== "done" && track.status !== "dropped") createIconButton(actions, SPRITES.actionAddTask, "Add task", () => host.addTask(project.path, track), { describedBy: titleButton });
		if (needsNextTask(track)) {
			const flag = card.createDiv({ cls: "vaultmate-track-nonext" });
			flag.createSpan({ cls: "vaultmate-track-flag", text: "No next task" });
			if (host.canSuggest()) createIconButton(flag, SPRITES.actionSuggest, "Suggest next steps", () => host.suggest(project.path, track), { describedBy: titleButton });
		}
		for (const task of part.tasks) renderTask(card, project.path, task, today);
		for (const item of part.entries) renderEntry(card, item, project.path, today);
	};

	const renderProjectPage = (parent: HTMLElement, view: ProjectView, focus: boolean): void => {
		const { project } = view;
		const today = startOfDay();
		const page = parent.createDiv({ cls: "vaultmate-project-page" });
		const counts: Record<TrackStatus, number> = { explore: 0, backlog: 0, progress: 0, done: 0, dropped: 0 };
		for (const track of project.model.tracks) counts[track.status]++;
		const head = page.createDiv({ cls: "vaultmate-project-head" });
		const name = head.createEl("button", { cls: "vaultmate-project-name", text: project.name, attr: { type: "button", "aria-label": `Open ${project.name}` } });
		name.addEventListener("click", () => host.open(project.path, 0));
		if (focus) focusFromInput(name);
		const progress = projectProgress(host.progressProperty(project.path), counts);
		if (progress) createMeter(head, projectMeter(progress), "vaultmate-project-head-progress");
		const newTrack = (parentEl: HTMLElement, cls = ""): void => {
			const button = createSpriteButton(parentEl, { sprite: SPRITES.actionNewTrack, text: "New track" });
			if (cls) button.addClass(cls);
			button.addEventListener("click", () => host.newTrack(project));
		};
		newTrack(head, "vaultmate-project-head-new");
		const chips = sectionChips(counts, project.model.ideas.length, view.outside.length);
		if (chips.length === 0) {
			newTrack(createInfoPanel(page, { sprite: SPRITES.mascotSleep, title: "No tracks yet", compact: true }));
			return;
		}
		const sections = new Map<SectionId, HTMLElement>();
		// What the search keeps: every track when it is blank, else a track whose title matches (whole) or whose tasks or entries match (those only).
		const searching = search.query.trim() !== "";
		const parts = new Map<number, TrackPart>();
		project.model.tracks.forEach((track, index) => {
			const entries = view.byTrack[index] ?? [];
			if (!searching || matches(track.title)) {
				parts.set(index, { tasks: openTasks(track), entries });
				return;
			}
			const part = { tasks: openTasks(track).filter((task) => matches(task.text)), entries: entries.filter((item) => matches(item.entry.statement)) };
			if (part.tasks.length + part.entries.length > 0) parts.set(index, part);
		});
		const ideas = project.model.ideas.filter((idea) => !searching || matches(idea.text));
		const outside = view.outside.filter((item) => !searching || matches(item.entry.statement));
		const kept: Record<TrackStatus, number> = { explore: 0, backlog: 0, progress: 0, done: 0, dropped: 0 };
		for (const index of parts.keys()) kept[project.model.tracks[index]?.status ?? "explore"]++;
		const shownChips = sectionChips(kept, ideas.length, outside.length);
		if (searching && shownChips.length === 0) {
			createNoMatch(page, search.query);
			return;
		}
		let closed: { setOpen(open: boolean): void } | null = null;
		createSectionNav(
			page,
			shownChips.map((chip) => {
				const label = chip.id === "ideas" ? "Ideas" : chip.id === "reviews" ? "Reviews" : chip.id === "closed" ? "Closed tracks" : STATUS_INFO[chip.id].label;
				const open = chip.id === "closed" ? () => {
					showClosed = true;
					closed?.setOpen(true);
				} : undefined;
				return { id: chip.id, sprite: CHIP_SPRITES[chip.id], label, count: chip.count, target: () => sections.get(chip.id) ?? null, open };
			}),
		);

		if (ideas.length > 0) sections.set("ideas", renderIdeas(page, project, ideas));
		for (const status of OPEN_STATUSES) {
			const indexes = project.model.tracks.flatMap((track, index) => (track.status === status && parts.has(index) ? [index] : []));
			if (indexes.length === 0) continue;
			const section = sectionTitle(page, status, SEALS[status], `${STATUS_INFO[status].label} · ${indexes.length}`);
			for (const index of indexes) renderTrack(section, view, index, today, parts.get(index) ?? { tasks: [], entries: [] });
			sections.set(status, section);
		}
		if (outside.length > 0) {
			const section = sectionTitle(page, "reviews", SPRITES.actionReview, `Reviews · ${outside.length}`);
			for (const item of outside) renderEntry(section, item, project.path, today);
			sections.set("reviews", section);
		}
		if (kept.done + kept.dropped > 0) {
			const section = page.createDiv({ cls: "vaultmate-project-section", attr: { "data-section": "closed" } });
			const disclosure = createDisclosure(section, { label: `Closed tracks · ${kept.done + kept.dropped}`, open: showClosed, onToggle: (open) => (showClosed = open) });
			for (const status of ["done", "dropped"] as const) {
				project.model.tracks.forEach((track, index) => {
					const part = parts.get(index);
					if (track.status === status && part) renderTrack(disclosure.body, view, index, today, part);
				});
			}
			sections.set("closed", section);
			closed = disclosure;
		}
	};

	// ---- Page ---------------------------------------------------------------------------------------

	const view = async (path: string, items: JournalItem[], markdownPaths: string[]): Promise<ProjectView | null> => {
		const project = await host.read(path);
		if (!project) return null;
		const split = splitEntries(project, items, scopePaths("tree", path, markdownPaths));
		return { project, ...split };
	};

	const render = async (body: HTMLElement, ctx: HubPageContext): Promise<void> => {
		const notes = host.notes();
		if (notes.length === 0) {
			const empty = createInfoPanel(body, { sprite: SPRITES.mascotSleep, title: "No projects yet", text: `A project is a note with ${host.projectTag()} in its tags property. Run Make this note a project on a note, or start a new one.` });
			createSpriteButton(empty, { sprite: SPRITES.actionNewProject, text: "New project", cta: true }).addEventListener("click", () => host.newProject());
			return;
		}
		const controls = body.createDiv({ cls: "vaultmate-switcher" });
		let allowed = addScopeControls(controls, ctx, host.activeNote(), host.markdownPaths(), (next) => {
			allowed = next;
			void draw(false);
		});
		addPageSearch(body, search, "Search projects", () => void draw(false));
		const content = body.createDiv();
		let token = 0;

		const openProject = (path: string | null): void => {
			const left = ctx.state.project;
			ctx.state.project = path;
			ctx.save();
			void draw(true, path ?? left ?? undefined);
		};

		const draw = async (focus: boolean, focusTile?: string): Promise<void> => {
			const mine = ++token;
			const markdownPaths = host.markdownPaths();
			const items = host.entries();
			const active = host.activeNote();
			// Scope "This note" on a project note: that project's page, with nothing to go back to.
			const scoped = ctx.state.scope === "note" && active !== null && notes.some((note) => note.path === active) ? active : null;
			const wanted = scoped ?? ctx.state.project;
			const shown = wanted !== null && notes.some((note) => note.path === wanted) ? await view(wanted, items, markdownPaths) : null;
			if (mine !== token) return;
			content.empty();
			if (!shown && ctx.state.project !== null) {
				ctx.state.project = null; // the project is gone or no longer a project
				ctx.save();
			}
			controls.toggle(scoped !== null || !shown);
			// The hub's back arrow climbs one level: from a project page to this dashboard.
			ctx.setUp(shown && scoped === null ? () => openProject(null) : null);
			if (shown) {
				renderProjectPage(content, shown, focus);
				return;
			}
			const inScope = notes.filter((note) => allowed === null || allowed.has(note.path));
			const projects = (await Promise.all(inScope.map((note) => view(note.path, items, markdownPaths)))).filter((entry): entry is ProjectView => entry !== null);
			if (mine !== token) return;
			if (projects.length === 0) {
				createInfoPanel(content, { sprite: SPRITES.mascotSleep, title: "No project in this scope", compact: true });
				return;
			}
			const today = startOfDay();
			const searching = search.query.trim() !== "";
			const found = searching ? projects.filter((entry) => matches([entry.project.name, ...entry.project.model.tracks.flatMap((track) => [track.title, ...openTasks(track).map((task) => task.text)])].join(" "))) : projects;
			if (found.length === 0) {
				createNoMatch(content, search.query);
				return;
			}
			renderDashboard(content, found.map((entry) => summarizeProject(entry.project, entry, today, host.progressProperty(entry.project.path))), (path) => openProject(path));
			createSpriteButton(content.createDiv({ cls: "vaultmate-hub-section" }), { sprite: SPRITES.actionNewProject, text: "New project" }).addEventListener("click", () => host.newProject());
			if (focusTile) content.querySelector<HTMLElement>(`[data-path="${CSS.escape(focusTile)}"]`)?.focus();
		};
		await draw(false);
	};

	return {
		id: PROJECTS_PAGE_ID,
		order: 18,
		title: "Projects",
		sprite: SPRITES.moduleProjects,
		enabled: () => host.enabled(),
		summary: () => tileSummary(host.notes()),
		upLabel: "Back to all projects",
		render,
	};
}
