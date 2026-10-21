// Chapters 5 and 7 of the book: the Projects dashboard (`projects`) and a project's page (`project`). The story is a
// first novel, a note called Book, told in moments (Week 1 to Launch day) with the cat acting each one. Each picture
// is the same Book at that moment, drawn with the real components and classes.
import { createDisclosure, createIconButton, createMark, createSpriteButton } from "../../ui/components";
import type { Guide } from "../../ui/guide/guide";
import { SPRITES } from "../../ui/sprites";
import { STATUS_INFO, type TrackStatus } from "./project-note";
import { createMeter, createProjectTile } from "./projects-page";
import type { ProjectSummary } from "./projects-model";
import { TRACK_SEALS } from "./track-seals";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#projects";
const noop = (): void => undefined;
const NONE = { explore: 0, backlog: 0, progress: 0, done: 0, dropped: 0 };

/** Book in Week 1: a project with nothing in it yet. */
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

/** A line of a note, as Obsidian shows a heading. */
function noteLine(parent: HTMLElement, text: string, level: 1 | 2): void {
	parent.createDiv({ cls: `vaultmate-guide-note-line is-h${level}`, text });
}

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
			when: "Week 1",
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
			text: "A review comes due, so Book jumps up with **1 review due**. Your other projects wait under **Other projects**, and search finds a track or task by name.",
			mock: (el) => {
				createProjectTile(el, { ...book, counts: busy, ideas: 2, reviewsDue: 1, progress: { kind: "percent", percent: 50 } });
				createDisclosure(el, { label: "Other projects · 2" });
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
	write: { caption: "Week 1, in the note's properties", lines: ["---", "tags: [project]", "progress: 25", "---"] },
	tips: [
		"The progress property (0 to 100) replaces the tracks-done bar.",
		"Pick This note in the scope list on a project note to open its page directly.",
		"Search finds project names, track titles and open tasks.",
	],
	readme: README,
};

export const PROJECT_GUIDE: Guide = {
	id: "project",
	sprite: SPRITES.moduleProjects,
	purpose: "Your ideas and tracks in one place, from first spark to done.",
	steps: [
		{
			when: "Week 1",
			cat: SPRITES.mascotWrite,
			text: `Outline is ${STATUS_INFO.done.marker} and Draft is ${STATUS_INFO.progress.marker}. Each track is a heading under Tracks, and the first character of the heading is its status.`,
			mock: (el) => {
				noteLine(el, "# Ideas", 1);
				noteLine(el, "# Tracks", 1);
				noteLine(el, `## ${STATUS_INFO.explore.marker} Launch plan`, 2);
				noteLine(el, `## ${STATUS_INFO.backlog.marker} Cover`, 2);
				noteLine(el, `## ${STATUS_INFO.progress.marker} Draft`, 2);
				noteLine(el, `## ${STATUS_INFO.done.marker} Outline`, 2);
			},
		},
		{
			when: "Month 2",
			cat: SPRITES.mascotIdea,
			text: "The storm idea becomes a track with **Promote**. As chapters land, you tick tasks with **Done** and the bar reads 2/5 tasks.",
			mock: (el) => {
				const row = el.createEl("ul", { cls: "vaultmate-idea-lines" }).createEl("li", { cls: "vaultmate-idea-line" });
				row.createSpan({ cls: "vaultmate-idea-line-text", text: "Storm opening" });
				const actions = row.createDiv({ cls: "vaultmate-icon-actions" });
				createIconButton(actions, SPRITES.actionPromote, "Promote to a track", noop);
				createIconButton(actions, SPRITES.actionDrop, "Drop", noop);
				createIconButton(actions, SPRITES.actionOpenNote, "Open in the note", noop);
				const card = trackLine(el, { title: "Draft", seal: "progress", action: "Done", tasks: [2, 5] });
				const task = card.createDiv({ cls: "vaultmate-entry-line" });
				createMark(task, SPRITES.stateTask);
				task.createSpan({ cls: "vaultmate-entry-main", text: "Finish chapter 3" });
				const taskActions = task.createDiv({ cls: "vaultmate-icon-actions" });
				createIconButton(taskActions, SPRITES.actionDone, "Done", noop);
				createIconButton(taskActions, SPRITES.actionDrop, "Drop", noop);
			},
		},
		{
			when: "Month 4",
			cat: SPRITES.mascotPaint,
			text: "The Cover track runs dry: **No next task**. Press **Add task**, or ask for **Suggest next steps** and pick two.",
			mock: (el) => {
				projectHead(el, 75);
				for (const title of ["Outline", "Draft"]) {
					const row = el.createDiv({ cls: "vaultmate-track-row vaultmate-guide-done" });
					createMark(row, TRACK_SEALS.done);
					row.createSpan({ cls: "vaultmate-idea-statement", text: title });
				}
				const card = trackLine(el, { title: "Cover", seal: "progress", action: "Done", tasks: [3, 3] });
				const flag = card.createDiv({ cls: "vaultmate-track-nonext" });
				flag.createSpan({ cls: "vaultmate-track-flag", text: "No next task" });
				createIconButton(flag, SPRITES.actionSuggest, "Suggest next steps", noop);
			},
		},
		{
			when: "Launch day",
			cat: SPRITES.mascotBook,
			text: `Every track is sealed ${STATUS_INFO.done.marker}, the stamp lands and Book reads 100%. The Self-publish decision in Launch plan shows **Review** there.`,
			mock: (el) => {
				projectHead(el, 100);
				for (const title of ["Outline", "Draft", "Cover", "Launch plan"]) {
					const row = el.createDiv({ cls: "vaultmate-track-row vaultmate-guide-done" });
					createMark(row, TRACK_SEALS.done);
					row.createSpan({ cls: "vaultmate-idea-statement", text: title });
				}
			},
		},
	],
	write: { caption: "Month 2, in the note", lines: [`## ${STATUS_INFO.progress.marker} Draft`, "- [ ] Finish chapter 3 ➕ 2026-10-21 📅 2026-10-24"] },
	tips: [
		"Ctrl+Z undoes a change in the open note.",
		"Move to… reaches any status, not only the next one.",
		"The chips at the top jump to a section. Done and Dropped tracks fold into Closed tracks.",
	],
	readme: README,
};
