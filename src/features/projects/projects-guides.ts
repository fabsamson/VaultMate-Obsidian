// The two guides of the Projects page: the dashboard (`projects`) and a project's page (`project`), told with
// one story, a first book whose project note is "Book". The pictures use the real components and classes.
import { createDisclosure, createIconButton, createMark, createSpriteButton } from "../../ui/components";
import type { Guide } from "../../ui/guide/guide";
import { SPRITES } from "../../ui/sprites";
import { STATUS_INFO } from "./project-note";
import { createMeter, createProjectTile } from "./projects-page";
import type { ProjectSummary } from "./projects-model";
import { TRACK_SEALS } from "./track-seals";

const README = "https://github.com/fabsamson/VaultMate-Obsidian#projects";
const noop = (): void => undefined;
const NONE = { explore: 0, backlog: 0, progress: 0, done: 0, dropped: 0 };

const book: ProjectSummary = {
	path: "Book.md",
	name: "Book",
	counts: { ...NONE, progress: 1, backlog: 1, explore: 1 },
	ideas: 2,
	reviewsDue: 1,
	next: { text: "Finish chapter 3", track: "Draft", due: "in 3 days", overdue: false },
	progress: { kind: "tracks", done: 1, total: 4 },
};

/** A line of a note, as Obsidian shows a heading. */
function noteLine(parent: HTMLElement, text: string, level: 1 | 2): void {
	parent.createDiv({ cls: `vaultmate-guide-note-line is-h${level}`, text });
}

export const PROJECTS_GUIDE: Guide = {
	id: "projects",
	sprite: SPRITES.moduleProjects,
	title: "All your projects at a glance",
	purpose: "Every note tagged as a project gets a tile that shows where it stands.",
	steps: [
		{
			title: "Make Book a project",
			text: "Run Make this note a project, or add project to the note's tags. New project starts a fresh note.",
			mock: (el) => {
				const row = el.createDiv({ cls: "vaultmate-guide-prop" });
				row.createSpan({ cls: "vaultmate-guide-prop-key", text: "tags" });
				row.createSpan({ cls: "vaultmate-guide-pill", text: "project" });
				createSpriteButton(el, { sprite: SPRITES.actionNewProject, text: "New project" });
			},
		},
		{
			title: "Read its tile",
			text: "Seals count tracks in progress, in backlog and to explore. Then ideas, due reviews, a bar and the next task.",
			mock: (el) => void createProjectTile(el, book),
		},
		{
			title: "See what needs you",
			text: "Due reviews and work in progress come first. The rest sit under Other projects. Search finds track titles and tasks.",
			mock: (el) => {
				const search = el.createDiv({ cls: "vaultmate-page-search" }).createDiv({ cls: "search-input-container" });
				search.createEl("input", { attr: { type: "search", placeholder: "Search projects", tabindex: "-1" } });
				createProjectTile(el, { ...book, ideas: 0, next: null, progress: null, counts: { ...NONE, progress: 2 } });
				createDisclosure(el, { label: "Other projects · 2" });
			},
		},
		{
			title: "Open the project",
			text: "Click a tile to open its page, with its tracks, its ideas and a New track button.",
			mock: (el) => {
				const head = el.createDiv({ cls: "vaultmate-project-head" });
				head.createSpan({ cls: "vaultmate-project-name", text: "Book" });
				createMeter(head, { label: "Progress", now: 25, max: 100, text: "25%" }, "vaultmate-project-head-progress");
				createSpriteButton(head, { sprite: SPRITES.actionNewTrack, text: "New track" });
			},
		},
	],
	write: { caption: "In the note's properties", lines: ["---", "tags: [project]", "progress: 40", "---"] },
	tips: [
		"The progress property (0 to 100) replaces the tracks-done bar.",
		"Pick This note in the scope list on a project note to open its page directly.",
		"Search finds project names, track titles and open tasks.",
	],
	cat: { sprite: SPRITES.mascotPoint, bubble: "Start with one note." },
	readme: README,
};

export const PROJECT_GUIDE: Guide = {
	id: "project",
	sprite: SPRITES.moduleProjects,
	title: "Move a track from idea to done",
	purpose: "Your ideas and tracks in one place, from first spark to done.",
	steps: [
		{
			title: "Shape the note",
			text: `Each track is a heading under Tracks. Its first character is its status: ${STATUS_INFO.explore.marker} explore, ${STATUS_INFO.backlog.marker} backlog, ${STATUS_INFO.progress.marker} in progress, ${STATUS_INFO.done.marker} done.`,
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
			title: "Make an idea a track",
			text: "Promote an idea to give it a name and a status, or press New track to start from scratch.",
			mock: (el) => {
				const row = el.createEl("ul", { cls: "vaultmate-idea-lines" }).createEl("li", { cls: "vaultmate-idea-line" });
				row.createSpan({ cls: "vaultmate-idea-line-text", text: "Storm opening" });
				const actions = row.createDiv({ cls: "vaultmate-icon-actions" });
				createIconButton(actions, SPRITES.actionPromote, "Promote to a track", noop);
				createIconButton(actions, SPRITES.actionDrop, "Drop", noop);
				createIconButton(actions, SPRITES.actionOpenNote, "Open in the note", noop);
				createSpriteButton(el, { sprite: SPRITES.actionNewTrack, text: "New track" });
			},
		},
		{
			title: "Work the track",
			text: "Start the track, then work through its tasks with Done. The bar counts the finished ones.",
			mock: (el) => {
				const card = el.createDiv({ cls: "vaultmate-track-row" });
				const line = card.createDiv({ cls: "vaultmate-track-line" });
				const main = line.createDiv({ cls: "vaultmate-track-main" });
				main.createSpan({ cls: "vaultmate-idea-statement", text: "Cover" });
				createMeter(main, { label: "Tasks done", now: 2, max: 5, text: "2/5 tasks" }, "vaultmate-progress-compact");
				const actions = line.createDiv({ cls: "vaultmate-track-actions" });
				createIconButton(actions, TRACK_SEALS.progress, "Start", noop, { primary: true });
				createIconButton(actions, SPRITES.actionMove, "Move to…", noop);
				createIconButton(actions, SPRITES.actionAddTask, "Add task", noop);
				const task = card.createDiv({ cls: "vaultmate-entry-line" });
				createMark(task, SPRITES.stateTask);
				task.createSpan({ cls: "vaultmate-entry-main", text: "Brief the illustrator" });
				const taskActions = task.createDiv({ cls: "vaultmate-icon-actions" });
				createIconButton(taskActions, SPRITES.actionDone, "Done", noop);
				createIconButton(taskActions, SPRITES.actionDrop, "Drop", noop);
				createIconButton(taskActions, SPRITES.actionOpenNote, "Open in the note", noop);
			},
		},
		{
			title: "Keep it moving",
			text: `No next task? Add one, or Suggest next steps. Done adds the ${STATUS_INFO.done.marker} seal. A decision written in Launch plan, like Self-publish, shows Review there.`,
			mock: (el) => {
				const card = el.createDiv({ cls: "vaultmate-track-row" });
				card.createSpan({ cls: "vaultmate-idea-statement", text: "Draft" });
				const flag = card.createDiv({ cls: "vaultmate-track-nonext" });
				flag.createSpan({ cls: "vaultmate-track-flag", text: "No next task" });
				createIconButton(flag, SPRITES.actionSuggest, "Suggest next steps", noop);
				const done = el.createDiv({ cls: "vaultmate-track-row vaultmate-guide-done" });
				createMark(done, TRACK_SEALS.done);
				done.createSpan({ cls: "vaultmate-idea-statement", text: "Outline" });
			},
		},
	],
	write: { caption: "In the note", lines: [`## ${STATUS_INFO.progress.marker} Draft`, "- [ ] Finish chapter 3 ➕ 2026-10-21 📅 2026-10-24"] },
	tips: [
		"Ctrl+Z undoes a change in the open note.",
		"Move to… reaches any status, not only the next one.",
		"The chips at the top jump to a section. Done and Dropped tracks fold into Closed tracks.",
	],
	cat: { sprite: SPRITES.mascotWrite, bubble: "One small task at a time." },
	readme: README,
};
