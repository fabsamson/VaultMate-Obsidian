// The hub's "Projects" page: for each project note, its ideas (the inbox) and its tracks on a board with
// one column per status.
import { Menu } from "obsidian";

import { createDisclosure, createPanel } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
import { createSprite } from "../../ui/pixel";
import { SPRITES } from "../../ui/sprites";
import { addScopeControls } from "../journal/scope-control";
import type { ProjectContent, ProjectNote } from "./project-index";
import { STATUS_INFO, trackCounts, type ProjectIdea, type ProjectTrack, type TrackStatus } from "./project-note";
import { boardStatuses, headerCounts, moveTargets, needsNextTask, primaryAction, splitByProgress, taskSummary, tileSummary } from "./projects-model";

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
	/** Opens the note at a 0-based line. */
	open(path: string, line: number): void;
	/** Opens the Promote form for an idea of the project. */
	promote(project: ProjectContent, idea: ProjectIdea): void;
	drop(path: string, idea: ProjectIdea): void;
	/** Moves the track; Start (to In progress) asks for a first task first. */
	move(path: string, track: ProjectTrack, status: TrackStatus): void;
	addTask(path: string, track: ProjectTrack): void;
}

const SEALS: Record<TrackStatus, (typeof SPRITES)[keyof typeof SPRITES]> = {
	explore: SPRITES.sealTrackExplore,
	backlog: SPRITES.sealTrackBacklog,
	progress: SPRITES.sealTrackProgress,
	done: SPRITES.sealTrackDone,
	dropped: SPRITES.sealTrackDropped,
};

export function createProjectsPage(host: ProjectsPageHost): HubPage {
	let showClosed = false;
	let showOther = false;

	const statusMenu = (event: MouseEvent, statuses: readonly TrackStatus[], onPick: (status: TrackStatus) => void): void => {
		const menu = new Menu();
		for (const status of statuses) menu.addItem((item) => item.setTitle(`${STATUS_INFO[status].marker} ${STATUS_INFO[status].label}`).onClick(() => onPick(status)));
		menu.showAtMouseEvent(event);
	};

	const button = (parent: HTMLElement, text: string, label: string, cta = false): HTMLButtonElement =>
		parent.createEl("button", { cls: cta ? "vaultmate-button mod-cta" : "vaultmate-button", text, attr: { type: "button", "aria-label": label } });

	const renderIdeas = (parent: HTMLElement, project: ProjectContent): void => {
		const { ideas } = project.model;
		if (ideas.length === 0) return;
		const box = createPanel(parent, "vaultmate-project-ideas");
		box.createDiv({ cls: "vaultmate-review-group-title", text: `Ideas · ${ideas.length}`, attr: { role: "heading", "aria-level": "3" } });
		const list = box.createEl("ul", { cls: "vaultmate-related-list" });
		for (const idea of ideas) {
			const row = list.createEl("li", { cls: "vaultmate-project-idea" });
			const text = idea.text || "(no text yet)";
			row.createEl("button", { cls: "vaultmate-idea-statement", text, attr: { type: "button", "aria-label": `Open the note at this idea: ${text}` } }).addEventListener("click", () => host.open(project.path, idea.line));
			const actions = row.createDiv({ cls: "vaultmate-related-actions" });
			button(actions, "Promote", `Promote idea to a track: ${text}`).addEventListener("click", () => host.promote(project, idea));
			button(actions, "Drop", `Drop idea: ${text}`).addEventListener("click", () => host.drop(project.path, idea));
		}
	};

	const renderCard = (column: HTMLElement, project: ProjectContent, track: ProjectTrack): void => {
		const card = createPanel(column, "vaultmate-track-card");
		card.createEl("button", { cls: "vaultmate-idea-statement", text: track.title || "(untitled)", attr: { type: "button", "aria-label": `Open the note at this track: ${track.title}` } }).addEventListener("click", () => host.open(project.path, track.line));
		card.createEl("p", { cls: "vaultmate-muted vaultmate-track-meta", text: taskSummary(track) });
		if (needsNextTask(track)) card.createSpan({ cls: "vaultmate-track-flag", text: "No next task" });
		const actions = card.createDiv({ cls: "vaultmate-related-actions" });
		const main = primaryAction(track.status);
		button(actions, main.label, `${main.label}: ${track.title}`, true).addEventListener("click", () => host.move(project.path, track, main.target));
		button(actions, "Move to…", `Move to another status: ${track.title}`).addEventListener("click", (event) => statusMenu(event, moveTargets(track.status), (status) => host.move(project.path, track, status)));
		if (track.status === "progress") button(actions, "Add task", `Add a task to ${track.title}`).addEventListener("click", () => host.addTask(project.path, track));
	};

	const renderProject = (parent: HTMLElement, project: ProjectContent): void => {
		const section = parent.createDiv({ cls: "vaultmate-hub-section vaultmate-project" });
		const head = section.createDiv({ cls: "vaultmate-project-head" });
		head.createEl("button", { cls: "vaultmate-project-name", text: project.name, attr: { type: "button", "aria-label": `Open ${project.name}` } }).addEventListener("click", () => host.open(project.path, 0));
		const counts = headerCounts(trackCounts(project.model.tracks), showClosed);
		head.createSpan({ cls: "vaultmate-muted", text: counts || "No tracks yet" });
		renderIdeas(section, project);
		if (project.model.tracks.length === 0) return;
		const board = section.createDiv({ cls: "vaultmate-board" });
		for (const status of boardStatuses(showClosed)) {
			const tracks = project.model.tracks.filter((track) => track.status === status);
			const column = board.createDiv({ cls: "vaultmate-column" });
			const title = column.createDiv({ cls: "vaultmate-column-title", attr: { role: "heading", "aria-level": "3" } });
			createSprite(title, SEALS[status], 32);
			title.createSpan({ text: `${STATUS_INFO[status].label} · ${tracks.length}` });
			if (tracks.length === 0) column.createEl("p", { cls: "vaultmate-muted", text: "Nothing here." });
			for (const track of tracks) renderCard(column, project, track);
		}
	};

	return {
		id: PROJECTS_PAGE_ID,
		order: 18,
		title: "Projects",
		sprite: SPRITES.moduleProjects,
		enabled: () => host.enabled(),
		summary: () => tileSummary(host.notes()),
		render: async (body, ctx) => {
			const notes = host.notes();
			if (notes.length === 0) {
				const panel = createPanel(body, "vaultmate-empty");
				createSprite(panel, SPRITES.mascotSleep, 96);
				panel.createEl("p", { cls: "vaultmate-empty-title", text: "No projects yet" });
				panel.createEl("p", { cls: "vaultmate-muted", text: `A project is a note with ${host.projectTag()} in its tags property. Run Make this note a project on a note, or Convert this note to tracks on an older project note.` });
				return;
			}
			const controls = body.createDiv({ cls: "vaultmate-switcher" });
			let allowed = addScopeControls(controls, ctx, host.activeNote(), host.markdownPaths(), (next) => {
				allowed = next;
				void renderContent();
			});
			const toggle = controls.createEl("label", { cls: "vaultmate-toggle" });
			const checkbox = toggle.createEl("input", { attr: { type: "checkbox" } });
			checkbox.checked = showClosed;
			const toggleText = toggle.createSpan();
			const content = body.createDiv();
			let token = 0;
			const renderContent = async (): Promise<void> => {
				const mine = ++token;
				const scoped = notes.filter((note) => allowed === null || allowed.has(note.path));
				const closed = scoped.reduce((sum, note) => sum + note.tracks.done + note.tracks.dropped, 0);
				toggleText.setText(`Show done and dropped (${closed})`);
				const projects = (await Promise.all(scoped.map((note) => host.read(note.path)))).filter((project): project is ProjectContent => project !== null);
				if (mine !== token) return;
				content.empty();
				if (projects.length === 0) {
					content.createEl("p", { cls: "vaultmate-muted", text: "No project in this scope." });
					return;
				}
				const { active, other } = splitByProgress(projects);
				for (const project of active) renderProject(content, project);
				if (other.length === 0) return;
				const group = content.createDiv({ cls: "vaultmate-hub-section" });
				const disclosure = createDisclosure(group, { label: `Other projects · ${other.length}`, open: showOther, onToggle: (open) => (showOther = open) });
				for (const project of other) renderProject(disclosure.body, project);
			};
			checkbox.addEventListener("change", () => {
				showClosed = checkbox.checked;
				void renderContent();
			});
			await renderContent();
		},
	};
}
