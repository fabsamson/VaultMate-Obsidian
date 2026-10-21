// The projects feature: tracks and ideas of the project notes. It wires the project-note index, the hub
// page, the writes (through the Editor for the active note, Vault.process otherwise) and the commands.
import { debounce, normalizePath, Notice, type Editor, type MarkdownFileInfo, type MarkdownView, type TFile } from "obsidian";

import { formatDate, startOfDay } from "../../core/dates";
import { readNoteLines } from "../../core/note-write";
import { openFileAtLine } from "../../core/open-note";
import type VaultMatePlugin from "../../main";
import { SPRITES } from "../../ui/sprites";
import { buildIdeaItem } from "../ideas/idea-line";
import { noticeWithButton } from "../ideas/idea-modal";
import { dropIdea as dropTaggedIdea, locateIdea, undoDrop } from "../ideas/idea-write";
import { writeProject } from "./project-apply";
import { createProjectNote } from "./project-create";
import { ProjectIndex, type ProjectContent } from "./project-index";
import { NewProjectModal, PromoteModal, StatusModal, TaskModal } from "./project-modals";
import { newProjectPath } from "./project-new";
import { readProject, type ProjectIdea, type ProjectTrack, type TrackStatus, type TrackTask } from "./project-note";
import { addTrackTask, dropIdea, newTrackInNote, promoteIdea, refusalMessage, setTaskState, setTrackStatus, taskStateLine, undoDropIdea, undoTaskState, type NewTask } from "./project-write";
import { createProjectsPage, PROJECTS_PAGE_ID } from "./projects-page";
import { hasProjectTag, withProjectTag } from "./project-tag";
import { lineIn, moveTargets, projectTags } from "./projects-model";

const OPEN_TRACK_STATUSES: readonly TrackStatus[] = ["explore", "backlog", "progress"];

export class ProjectsFeature {
	public readonly index: ProjectIndex;

	public constructor(private readonly plugin: VaultMatePlugin) {
		this.index = new ProjectIndex(plugin);
	}

	public enabled(): boolean {
		return this.plugin.settings.projects.enabled;
	}

	/** Title of the Tracks section created in a note that has none. */
	public tracksTitle(): string {
		return this.plugin.settings.projects.tracksTitle;
	}

	/** Call from `onload`: registers the index events, the page and the commands; the first pass waits for the layout. */
	public register(): void {
		this.index.registerEvents();
		this.registerPage();
		this.addCommands();
		this.plugin.app.workspace.onLayoutReady(() => void this.index.sync());
	}

	/** Call after a setting changed: the index follows the on/off switch. */
	public onSettingsChanged(): void {
		if (this.enabled() !== this.index.ready || this.index.stale) void this.index.sync();
	}

	// ---- Hub page -----------------------------------------------------------------------------------

	private registerPage(): void {
		const { plugin } = this;
		this.index.onChange(debounce(() => plugin.refreshHubs(PROJECTS_PAGE_ID), 300, true));
		plugin.registerHubPage(
			createProjectsPage({
				enabled: () => this.enabled(),
				projectTag: () => `#${this.plugin.settings.projects.tag}`,
				notes: () => this.index.notes(),
				read: (path) => this.read(path),
				activeNote: () => plugin.contextFile()?.path ?? null,
				markdownPaths: () => plugin.app.vault.getMarkdownFiles().map((file) => file.path),
				progressProperty: (path) => {
					const file = plugin.app.vault.getFileByPath(path);
					const frontmatter: Record<string, unknown> | undefined = file ? plugin.app.metadataCache.getFileCache(file)?.frontmatter : undefined;
					return frontmatter?.progress;
				},
				entries: () => (plugin.journal.enabled() ? plugin.journal.index.entries() : []),
				openReview: (item) => plugin.journal.openReview(item),
				track: (item) => plugin.journal.track(item),
				open: (path, line) => this.open(path, line),
				newProject: () => this.newProject(),
				promote: (project, idea) => this.promoteDialog(project.path, project.model.tracks.map((track) => track.title), idea),
				newTrack: (project) => this.newTrackDialog(project.path, project.model.tracks.map((track) => track.title)),
				drop: (path, idea) => void this.dropIdea(path, idea),
				move: (path, track, status) => this.move(path, track, status),
				addTask: (path, track) => this.addTask(path, track),
				setTaskState: (path, task, state) => void this.setTaskState(path, task, state),
				canSuggest: () => this.plugin.aiActions.nextStepsAction() !== null,
				suggest: (path, track) => this.plugin.aiActions.suggestNextSteps(path, track.line),
			}),
		);
	}

	/** A project note read from the editor when it is open there, else from the file. */
	private async read(path: string): Promise<ProjectContent | null> {
		const lines = await readNoteLines(this.plugin.app, path);
		const file = this.plugin.app.vault.getFileByPath(path);
		return lines && file ? { path, name: file.basename, lines, model: readProject(lines, projectTags(this.plugin.settings)) } : null;
	}

	private open(path: string, line: number): void {
		const file = this.plugin.app.vault.getFileByPath(path);
		if (file) void openFileAtLine(this.plugin.app.workspace.getLeaf(false), file, line);
	}

	/**
	 * Opens the New project form. A created note goes to `done` (default: it is opened); a name that already
	 * exists opens that note instead and `done` is not called.
	 */
	public newProject(name = "", done?: (file: TFile) => void): void {
		const { app, settings } = this.plugin;
		new NewProjectModal(app, {
			name,
			pathFor: (typed) => newProjectPath(typed, settings.projects.newProjectFolder),
			existing: (path) => app.vault.getFileByPath(normalizePath(path)),
			create: (path) => createProjectNote(app, settings, path),
			done: (file, created) => {
				if (created && done) done(file);
				else void app.workspace.getLeaf(false).openFile(file);
			},
		}).open();
	}

	// ---- Writes -------------------------------------------------------------------------------------

	private async written(path: string, plan: Parameters<typeof writeProject>[2]): Promise<boolean> {
		const ok = await writeProject(this.plugin.app, path, plan);
		this.plugin.refreshHubs(PROJECTS_PAGE_ID);
		return ok;
	}

	private newTask(text: string, due: string): NewTask {
		return { text, today: formatDate(startOfDay()), ...(due ? { due } : {}) };
	}

	/** The Promote form: status, short name and a first task; `titles` are the project's track titles. */
	public promoteDialog(path: string, titles: readonly string[], idea: ProjectIdea): void {
		new PromoteModal(this.plugin.app, idea.text, titles, ({ status, shortName, firstTask }) => void this.promoteIdea(path, idea, status, { shortName, ...(firstTask ? { firstTask } : {}) })).open();
	}

	/** The New track form of a project page: the Promote form with no idea. The track goes at the end of the Tracks section, created when missing. */
	public newTrackDialog(path: string, titles: readonly string[]): void {
		new PromoteModal(this.plugin.app, null, titles, ({ status, shortName, firstTask }) => {
			const track = { name: shortName, status, text: "", children: [], ...(firstTask ? { firstTask: this.newTask(firstTask.text, firstTask.due) } : {}) };
			void this.written(path, (lines) => newTrackInNote(lines, track, { tracksTitle: this.tracksTitle() }));
		}).open();
	}

	/**
	 * Promotes an idea of the Ideas box to a track: a bullet or a tagged idea of the note is moved to the end
	 * of the Tracks section. `shortName` is the cleaned heading (default: the whole text); `firstTask` is
	 * added when the status is In progress.
	 */
	public async promoteIdea(path: string, idea: ProjectIdea, status: TrackStatus, options: { shortName?: string; firstTask?: { text: string; due: string } } = {}): Promise<boolean> {
		const { shortName, firstTask } = options;
		return this.written(path, (lines) =>
			promoteIdea(lines, idea, {
				status,
				tracksTitle: this.tracksTitle(),
				tags: projectTags(this.plugin.settings),
				...(shortName !== undefined ? { shortName } : {}),
				...(firstTask ? { firstTask: this.newTask(firstTask.text, firstTask.due) } : {}),
			}),
		);
	}

	/**
	 * Drops an idea of the Ideas box, then offers Undo for a few seconds. A bullet is removed; a tagged idea
	 * is closed as dropped (the F6 drop), whatever section it is in.
	 */
	public async dropIdea(path: string, idea: ProjectIdea): Promise<void> {
		if (idea.kind === "tagged") {
			await this.dropTagged(path, idea);
			return;
		}
		let after: string | undefined;
		const ok = await this.written(path, (lines) => {
			after = lines[idea.end];
			return dropIdea(lines, idea);
		});
		if (!ok) return;
		const lineAfter = after;
		noticeWithButton("Idea dropped.", "Undo", () => void this.written(path, (lines) => undoDropIdea(lines, idea, lineAfter)));
	}

	private async dropTagged(path: string, idea: ProjectIdea): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(path);
		const lines = await readNoteLines(this.plugin.app, path);
		const item = file && lines ? buildIdeaItem(path, file.basename, formatDate(new Date(file.stat.ctime)), idea.line, lines, this.plugin.settings.ideas.tag) : null;
		if (!item || item.raw !== idea.raw) {
			new Notice(refusalMessage("changed"));
			return;
		}
		const closed = await dropTaggedIdea(this.plugin, item, "");
		this.plugin.refreshHubs(PROJECTS_PAGE_ID);
		if (closed === null) return;
		noticeWithButton("Idea dropped.", "Undo", () => {
			void locateIdea(this.plugin, { ...item, raw: closed }).then((at) => (at ? undoDrop(this.plugin, { ...item, line: at.line }, closed) : false));
		});
	}

	/** Changes the status; moving to In progress first asks for an optional first task, written in the same edit. */
	private move(path: string, track: ProjectTrack, status: TrackStatus): void {
		if (status !== "progress" || track.status === "progress") {
			void this.written(path, (lines) => setTrackStatus(lines, track, status)).then((ok) => {
				if (ok && status === "done") this.plugin.stampMoment(SPRITES.stampDone);
			});
			return;
		}
		new TaskModal(this.plugin.app, {
			title: "Start this track",
			submitLabel: "Start",
			textRequired: false,
			onSubmit: ({ text, due }) => void this.written(path, (lines) => setTrackStatus(lines, track, status, text ? this.newTask(text, due) : undefined)),
		}).open();
	}

	private addTask(path: string, track: ProjectTrack): void {
		new TaskModal(this.plugin.app, {
			title: "Add a task",
			submitLabel: "Add task",
			textRequired: true,
			onSubmit: ({ text, due }) => void this.written(path, (lines) => addTrackTask(lines, track, this.newTask(text, due))),
		}).open();
	}

	/** Marks an open task done or cancelled, then offers Undo for a few seconds: it puts the exact previous line back. */
	private async setTaskState(path: string, task: TrackTask, state: "done" | "cancelled"): Promise<void> {
		const today = formatDate(startOfDay());
		if (!(await this.written(path, (lines) => setTaskState(lines, task, state, today)))) return;
		const closed = taskStateLine(task.raw, state, today);
		if (closed === null) return;
		noticeWithButton(state === "done" ? "Task done." : "Task dropped.", "Undo", () => void this.written(path, (lines) => undoTaskState(lines, task, closed)));
	}

	// ---- Commands -----------------------------------------------------------------------------------

	/** The note path and the model of the editor's current text, when the feature is on. */
	private context(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): { path: string; lines: string[]; model: ReturnType<typeof readProject>; line: number } | null {
		if (!ctx.file || !this.enabled()) return null;
		const lines = Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
		return { path: ctx.file.path, lines, model: readProject(lines, projectTags(this.plugin.settings)), line: editor.getCursor().line };
	}

	private addCommands(): void {
		const { plugin } = this;
		plugin.addCommand({
			id: "make-project",
			name: "Make this note a project",
			icon: "compass",
			checkCallback: (checking) => {
				const file = plugin.app.workspace.getActiveFile();
				const { tag } = plugin.settings.projects;
				if (!file || file.extension !== "md" || !this.enabled() || hasProjectTag(plugin.app.metadataCache.getFileCache(file)?.frontmatter, tag)) return false;
				if (!checking) {
					void plugin.app.fileManager
						.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
							frontmatter.tags = withProjectTag(frontmatter, tag);
						})
						.then(
							() => new Notice(`Added #${tag} to this note's tags.`),
							() => new Notice("VaultMate could not change the tags of this note."),
						);
				}
				return true;
			},
		});
		plugin.addCommand({
			id: "new-project",
			name: "New project…",
			icon: "compass",
			checkCallback: (checking) => {
				if (!this.enabled()) return false;
				if (!checking) this.newProject();
				return true;
			},
		});
		plugin.addCommand({
			id: "move-track",
			name: "Move this track…",
			icon: "compass",
			editorCheckCallback: (checking, editor, ctx) => {
				const found = this.context(editor, ctx);
				const track = found?.model.tracks.find((candidate) => lineIn(found.line, candidate.line, candidate.end));
				if (!found || !track) return false;
				if (!checking) new StatusModal(plugin.app, moveTargets(track.status), "Move this track to…", (status) => this.move(found.path, track, status)).open();
				return true;
			},
		});
		plugin.addCommand({
			id: "promote-idea",
			name: "Promote this idea to a track",
			icon: "compass",
			editorCheckCallback: (checking, editor, ctx) => {
				const found = this.context(editor, ctx);
				// The innermost idea under the cursor: a tagged idea can sit inside another idea's lines.
				const idea = found?.model.ideas.filter((candidate) => lineIn(found.line, candidate.line, candidate.end)).pop();
				if (!found || !idea) return false;
				if (!checking) this.promoteDialog(found.path, found.model.tracks.map((track) => track.title), idea);
				return true;
			},
		});
		plugin.addCommand({
			id: "suggest-next-steps",
			name: "Suggest next steps for this track",
			icon: "list-checks",
			editorCheckCallback: (checking, editor, ctx) => {
				const found = this.context(editor, ctx);
				const track = found?.model.tracks.find((candidate) => lineIn(found.line, candidate.line, candidate.end));
				if (!found || !track || !OPEN_TRACK_STATUSES.includes(track.status) || !plugin.aiActions.nextStepsAction()) return false;
				if (!checking) plugin.aiActions.suggestNextSteps(found.path, track.line);
				return true;
			},
		});
		plugin.addCommand({
			id: "add-track-task",
			name: "Add a task to this track",
			icon: "compass",
			editorCheckCallback: (checking, editor, ctx) => {
				const found = this.context(editor, ctx);
				const track = found?.model.tracks.find((candidate) => lineIn(found.line, candidate.line, candidate.end));
				if (!found || !track) return false;
				if (!checking) this.addTask(found.path, track);
				return true;
			},
		});
	}
}
