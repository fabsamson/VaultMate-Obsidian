// Chapters 3 and 4 of the book: the Projects dashboard (`projects`) and a project's page (`project`). The story is a
// first novel, a note called Book. Chapter 3 shows the dashboard from Week 3 on; chapter 4 follows one track, Storm
// opening, from an idea to Done. Each picture is the same Book at that moment, drawn with the real components and classes.
import { createDisclosure, createHankoStamp, createIconButton, createMark, createSpriteButton } from "../../ui/components";
import { createSprite } from "../../ui/pixel";
import type { Guide } from "../../ui/guide/guide";
import { SPRITES } from "../../ui/sprites";
import { STATUS_INFO, type TrackStatus } from "./project-note";
import { createMeter, createProjectTile } from "./projects-page";
import type { ProjectSummary } from "./projects-model";
import { TRACK_SEALS } from "./track-seals";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#projects";
const noop = (): void => undefined;
const NONE = { explore: 0, backlog: 0, progress: 0, done: 0, dropped: 0 };

/** Book in Week 3: a project with nothing in it yet. */
const book: ProjectSummary = {
	path: "Book.md",
	name: "Book",
	counts: { ...NONE },
	ideas: 0,
	reviewsDue: 0,
	next: null,
	progress: { kind: "percent", percent: 0 },
};
const busy = { ...NONE, progress: 1, backlog: 1, explore: 1 };

/** The header of the project page: its name and its bar. */
function projectHead(parent: HTMLElement, percent: number, newTrack = false): void {
	const head = parent.createDiv({ cls: "vaultmate-project-head" });
	head.createSpan({ cls: "vaultmate-project-name", text: "Book" });
	createMeter(head, { label: "Progress", now: percent, max: 100, text: `${percent}%` }, "vaultmate-project-head-progress");
	if (newTrack) createSpriteButton(head, { sprite: SPRITES.actionNewTrack, text: "New track" });
}

interface TrackLineOptions {
	title: string;
	/** The status whose seal is the main button. */
	seal: TrackStatus;
	/** What that button does. */
	action: string;
	/** Done and total of the bar. */
	tasks?: [number, number];
}

/** One track as the project page draws it: its title (and bar), then its icons. */
function trackLine(parent: HTMLElement, options: TrackLineOptions): HTMLElement {
	const card = parent.createDiv({ cls: "vaultmate-track-row" });
	const line = card.createDiv({ cls: "vaultmate-track-line" });
	const main = line.createDiv({ cls: "vaultmate-track-main" });
	main.createSpan({ cls: "vaultmate-idea-statement", text: options.title });
	if (options.tasks) createMeter(main, { label: "Tasks done", now: options.tasks[0], max: options.tasks[1], text: `${options.tasks[0]}/${options.tasks[1]} tasks` }, "vaultmate-progress-compact");
	const actions = line.createDiv({ cls: "vaultmate-track-actions" });
	createIconButton(actions, TRACK_SEALS[options.seal], options.action, noop, { primary: true });
	createIconButton(actions, SPRITES.actionMove, "Move to…", noop);
	createIconButton(actions, SPRITES.actionAddTask, "Add task", noop);
	return card;
}

export const PROJECTS_GUIDE: Guide = {
	id: "projects",
	sprite: SPRITES.moduleProjects,
	purpose: "Every note tagged as a project gets a tile that shows where it stands.",
	steps: [
		{
			when: "Week 3",
			cat: SPRITES.mascotBox,
			text: "The novel is only a note called Book. Add project to its tags, or run **Make this note a project**, and a tile appears at 0%.",
			mock: (el) => {
				const row = el.createDiv({ cls: "vaultmate-guide-prop" });
				row.createSpan({ cls: "vaultmate-guide-prop-key", text: "tags" });
				row.createSpan({ cls: "vaultmate-guide-pill", text: "project" });
				createProjectTile(el, book);
			},
		},
		{
			when: "Month 1",
			cat: SPRITES.mascotWrite,
			text: "The tile fills with seals: Draft in progress, Cover in backlog, Launch plan to explore. Below come 2 ideas and **Next**: Finish chapter 3.",
			mock: (el) => void createProjectTile(el, { ...book, counts: busy, ideas: 2, progress: { kind: "percent", percent: 25 }, next: { text: "Finish chapter 3", track: "Draft", due: "in 3 days", overdue: false } }),
		},
		{
			when: "Month 2",
			cat: SPRITES.mascotSleep,
			text: "**Book** stays on top because it moves every week, while the quiet **Garden shed** sleeps under **Other projects**. A review due would put a project first.",
			mock: (el) => {
				createProjectTile(el, { ...book, counts: busy, ideas: 2, progress: { kind: "percent", percent: 50 } });
				createDisclosure(el, { label: "Other projects · 1" });
			},
		},
		{
			when: "Any day",
			cat: SPRITES.mascotPoint,
			text: "Click the tile and the book opens as a page. Its tracks, its ideas and **New track** are all there.",
			mock: (el) => {
				projectHead(el, 50, true);
				trackLine(el, { title: "Draft", seal: "progress", action: "Done" });
				trackLine(el, { title: "Cover", seal: "backlog", action: "Start" });
			},
		},
	],
	write: { caption: "Month 1, in the note's properties", lines: ["---", "tags: [project]", "progress: 25", "---"] },
	tips: [
		"The progress property (0 to 100) replaces the tracks-done bar.",
		"Pick This note in the scope list on a project note to open its page directly.",
		"Search finds project names, track titles and open tasks.",
	],
	readme: README,
};


/** The four steps of a track, in order: the ladder every card of the chapter shows. */
const LADDER: TrackStatus[] = ["explore", "backlog", "progress", "done"];

/**
 * The status ladder: the four seals in order. The current step is outlined and bold, the steps behind it read as passed and
 * the steps ahead are dashed and faded, so the position never rests on colour alone. `button` is the main button that
 * moves the track on from here.
 */
function ladder(parent: HTMLElement, current: TrackStatus, button: string): void {
	const box = parent.createDiv({ cls: "vaultmate-guide-ladder" });
	const steps = box.createEl("ol", { cls: "vaultmate-guide-ladder-steps", attr: { "aria-label": "Track status" } });
	const at = LADDER.indexOf(current);
	LADDER.forEach((status, index) => {
		const step = steps.createEl("li", { cls: `vaultmate-guide-rung ${index < at ? "is-passed" : index === at ? "is-current" : "is-ahead"}` });
		if (index === at) step.setAttribute("aria-current", "step");
		createSprite(step, TRACK_SEALS[status], 24);
		step.createSpan({ text: STATUS_INFO[status].label });
	});
	box.createDiv({ cls: "vaultmate-guide-ladder-hint", text: `Main button: ${button}` });
}

/** The track as the project page draws it, closed: a seal and its title. */
function closedTrack(parent: HTMLElement, title: string): void {
	const row = parent.createDiv({ cls: "vaultmate-track-row vaultmate-guide-done" });
	createMark(row, TRACK_SEALS.done);
	row.createSpan({ cls: "vaultmate-idea-statement", text: title });
}

const TRACK = "Storm opening";

export const PROJECT_GUIDE: Guide = {
	id: "project",
	sprite: SPRITES.moduleProjects,
	purpose: "One track from spark to done: each button moves it one step.",
	steps: [
		{
			when: "Month 2",
			cat: SPRITES.mascotIdea,
			text: `On the idea **${TRACK}**, press **Promote**. It becomes a track, born in **${STATUS_INFO.explore.label}**.`,
			mock: (el) => {
				ladder(el, "explore", "To backlog");
				const row = el.createEl("ul", { cls: "vaultmate-idea-lines" }).createEl("li", { cls: "vaultmate-idea-line" });
				row.createSpan({ cls: "vaultmate-idea-line-text", text: TRACK });
				const actions = row.createDiv({ cls: "vaultmate-icon-actions" });
				createIconButton(actions, SPRITES.actionPromote, "Promote to a track", noop, { primary: true });
				createIconButton(actions, SPRITES.actionDrop, "Drop", noop);
				trackLine(el, { title: TRACK, seal: "explore", action: "To backlog" });
			},
		},
		{
			when: "Month 3",
			cat: SPRITES.mascotThink,
			text: `You decide to write it, so you press **To backlog**. The track moves to **${STATUS_INFO.backlog.label}** and waits for its turn.`,
			mock: (el) => {
				ladder(el, "backlog", "Start");
				trackLine(el, { title: TRACK, seal: "backlog", action: "Start" });
			},
		},
		{
			when: "Month 4",
			cat: SPRITES.mascotWrite,
			text: `**Start** moves it to **${STATUS_INFO.progress.label}**. Tick tasks with **Done**; with none left, **No next task** offers **Add task** or **Suggest next steps**.`,
			mock: (el) => {
				ladder(el, "progress", "Done");
				const card = trackLine(el, { title: TRACK, seal: "progress", action: "Done", tasks: [2, 5] });
				const task = card.createDiv({ cls: "vaultmate-entry-line" });
				createMark(task, SPRITES.stateTask);
				task.createSpan({ cls: "vaultmate-entry-main", text: "Write the storm scene" });
				const taskActions = task.createDiv({ cls: "vaultmate-icon-actions" });
				createIconButton(taskActions, SPRITES.actionDone, "Done", noop);
				createIconButton(taskActions, SPRITES.actionDrop, "Drop", noop);
			},
		},
		{
			when: "Month 5",
			cat: SPRITES.mascotCheer,
			text: `The last task is ticked, so you press **Done** on the track. It is sealed ${STATUS_INFO.done.marker}, the stamp lands and the bar of **Book** climbs.`,
			mock: (el) => {
				ladder(el, "done", "Reopen");
				projectHead(el, 60);
				closedTrack(el, TRACK);
				createHankoStamp(el, { sprite: SPRITES.stampDone, label: "Done" });
			},
		},
	],
	write: {
		caption: "The same heading, before and after Start",
		lines: [`## ${STATUS_INFO.explore.marker} ${TRACK}`, `## ${STATUS_INFO.progress.marker} ${TRACK}`, "- [ ] Write the storm scene ➕ 2027-02-03 📅 2027-02-10"],
	},
	tips: [
		"Move to… reaches any status, not only the next one.",
		"Ctrl+Z undoes a change in the open note.",
		"Done and Dropped tracks fold into Closed tracks.",
	],
	readme: README,
};
