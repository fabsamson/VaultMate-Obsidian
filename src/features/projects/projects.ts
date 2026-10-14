// The projects feature: tracks and ideas of the project notes. It wires the project-note index, the hub
// page, the writes (through the Editor for the active note, Vault.process otherwise) and the commands.
import { debounce, Notice, type Editor, type MarkdownFileInfo, type MarkdownView } from "obsidian";

import { formatDate, startOfDay } from "../../core/dates";
import type VaultMatePlugin from "../../main";
import { noticeWithButton } from "../ideas/idea-modal";
import { applyEditsToEditor, readNoteLines, writeProject } from "./project-apply";
import { convertProject, diffEdit } from "./project-convert";
import { ProjectIndex, type ProjectContent } from "./project-index";
import { StatusModal, TaskModal } from "./project-modals";
import { readProject, TRACK_STATUSES, type ProjectIdea, type ProjectTrack, type TrackStatus } from "./project-note";
import { addTrackTask, dropIdea, promoteIdea, setTrackStatus, undoDropIdea, type NewTask } from "./project-write";
import { createProjectsPage, PROJECTS_PAGE_ID } from "./projects-page";
import { lineIn, moveTargets } from "./projects-model";

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
		if (this.enabled() !== this.index.ready) void this.index.sync();
	}

	// ---- Hub page -----------------------------------------------------------------------------------

	private registerPage(): void {
		const { plugin } = this;
		this.index.onChange(debounce(() => plugin.refreshHubs(PROJECTS_PAGE_ID), 300, true));
		plugin.registerHubPage(
			createProjectsPage({
				enabled: () => this.enabled(),
				notes: () => this.index.notes(),
				read: (path) => this.read(path),
				activeNote: () => plugin.contextFile()?.path ?? null,
				markdownPaths: () => plugin.app.vault.getMarkdownFiles().map((file) => file.path),
				open: (path, line) => this.open(path, line),
				promote: (path, idea, status) => void this.promote(path, idea, status),
				drop: (path, idea) => void this.drop(path, idea),
				move: (path, track, status) => this.move(path, track, status),
				addTask: (path, track) => this.addTask(path, track),
			}),
		);
	}

	/** A project note read from the editor when it is open there, else from the file. */
	private async read(path: string): Promise<ProjectContent | null> {
		const lines = await readNoteLines(this.plugin.app, path);
		const file = this.plugin.app.vault.getFileByPath(path);
		return lines && file ? { path, name: file.basename, lines, model: readProject(lines) } : null;
	}

	private open(path: string, line: number): void {
		const file = this.plugin.app.vault.getFileByPath(path);
		if (file) void this.plugin.app.workspace.getLeaf(false).openFile(file, { eState: { line } });
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

	private async promote(path: string, idea: ProjectIdea, status: TrackStatus): Promise<void> {
		const tracksTitle = this.tracksTitle();
		await this.written(path, (lines) => promoteIdea(lines, idea, { status, tracksTitle }));
	}

	/** Drops the idea, then offers Undo for a few seconds. */
	private async drop(path: string, idea: ProjectIdea): Promise<void> {
		let after: string | undefined;
		const ok = await this.written(path, (lines) => {
			after = lines[idea.end];
			return dropIdea(lines, idea);
		});
		if (!ok) return;
		const lineAfter = after;
		noticeWithButton("Idea dropped.", "Undo", () => void this.written(path, (lines) => undoDropIdea(lines, idea, lineAfter)));
	}

	/** Changes the status; moving to In progress first asks for an optional first task, written in the same edit. */
	private move(path: string, track: ProjectTrack, status: TrackStatus): void {
		if (status !== "progress" || track.status === "progress") {
			void this.written(path, (lines) => setTrackStatus(lines, track, status));
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

	// ---- Commands -----------------------------------------------------------------------------------

	/** The note path and the model of the editor's current text, when the feature is on. */
	private context(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): { path: string; lines: string[]; model: ReturnType<typeof readProject>; line: number } | null {
		if (!ctx.file || !this.enabled()) return null;
		const lines = Array.from({ length: editor.lineCount() }, (_, index) => editor.getLine(index));
		return { path: ctx.file.path, lines, model: readProject(lines), line: editor.getCursor().line };
	}

	private addCommands(): void {
		const { plugin } = this;
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
				const idea = found?.model.ideas.find((candidate) => lineIn(found.line, candidate.line, candidate.end));
				if (!found || !idea) return false;
				if (!checking) new StatusModal(plugin.app, TRACK_STATUSES, "Promote this idea as…", (status) => void this.promote(found.path, idea, status)).open();
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
		plugin.addCommand({
			id: "convert-to-tracks",
			name: "Convert this note to tracks",
			icon: "compass",
			editorCheckCallback: (checking, editor, ctx) => {
				const found = this.context(editor, ctx);
				if (!found || found.model.level === null) return false;
				const converted = convertProject(found.lines, this.tracksTitle());
				if (converted.lines === found.lines) return false;
				if (!checking) {
					const edit = diffEdit(found.lines, converted.lines);
					if (edit) applyEditsToEditor(editor, [edit]);
					new Notice(`Converted: ${converted.tracksCreated} ${converted.tracksCreated === 1 ? "track" : "tracks"}, ${converted.sectionsRemoved} ${converted.sectionsRemoved === 1 ? "section" : "sections"} removed`);
					plugin.refreshHubs(PROJECTS_PAGE_ID);
				}
				return true;
			},
		});
	}
}
