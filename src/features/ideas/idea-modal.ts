// The idea portal: what to do with one idea, action first. It opens on the idea and one row of actions
// (no field); choosing an action shows only its panel. Tend mode is the same form over a queue of ideas.
// What each panel says is decided in `portal-actions` (pure).
import { AbstractInputSuggest, normalizePath, Notice, type App, type TFile } from "obsidian";

import { startOfDay } from "../../core/dates";
import { baseName } from "../context/note-meta";
import { createIconButton, createSectionHeader } from "../../ui/components";
import { SPRITES } from "../../ui/sprites";
import type { Sprite } from "../../ui/pixel";
import type { JournalKind } from "../journal/journal-line";
import { JournalModal, NewEntryModal, textField } from "../journal/journal-modals";
import type { LessonHint } from "../journal/track-record";
import { addTrackFields } from "../projects/project-modals";
import { prefillName } from "../projects/track-form";
import { ideaAge, titleFromIdea, type IdeaItem } from "./idea-line";
import { defaultIdeaHeading, newNotePath, orderedHeadings } from "./idea-note";
import { addIdeaToNote, createNoteFromIdea, dropIdea, locateIdea, makeProjectSeed, newTrackFromIdea, trackIdeaAs, type IdeaWriteHost, type NewTrackChoice } from "./idea-write";
import { itemStatement, plantedText } from "./ideas-model";
import { ACTION_LABELS, addState, findProject, hasPanel, newNoteState, noteLinkLabel, portalActions, seedSentence, trackState, type PortalAction, type ProjectChoice } from "./portal-actions";

/** The icon of each portal action; its name (`ACTION_LABELS`) is the button's label and tooltip. */
const ACTION_SPRITES: Record<PortalAction, Sprite> = {
	"new-note": SPRITES.actionNewNote,
	track: SPRITES.actionNewTrack,
	drop: SPRITES.actionDrop,
	add: SPRITES.actionAddToNote,
	decision: SPRITES.stateDecision,
	prediction: SPRITES.statePrediction,
	seed: SPRITES.actionSeed,
	skip: SPRITES.actionSkip,
};

export interface IdeaPortalHost extends IdeaWriteHost {
	/** Opens the note at a 0-based line. */
	openAtLine(path: string, line: number): void;
	/** Whether the Projects feature is on (New track needs it). */
	projectsEnabled(): boolean;
	/** Shows the stamp moment: an idea was sorted. */
	stampDone(): void;
	/** The project notes (notes with the project tag); empty when the feature is off. */
	projectNotes(): ProjectChoice[];
	/** Opens New project, prefilled with `name`; `done` gets the note it created. */
	newProject(name: string, done: (file: TFile) => void): void;
	/** The titles of the tracks of a project note, to warn about a repeated name. */
	trackTitles(path: string): Promise<string[]>;
	/** The latest lessons of the journal for `kind`, for the New decision and New prediction forms. */
	lessons(kind: JournalKind): LessonHint[];
}

/** A notice with one button, for a few seconds (Undo after a drop, Open after a note was created). */
export function noticeWithButton(message: string, label: string, onClick: () => void, duration = 8000): void {
	const notice = new Notice("", duration);
	notice.messageEl.addClass("vaultmate");
	notice.messageEl.createSpan({ text: `${message} ` });
	const button = notice.messageEl.createEl("button", { cls: "vaultmate-button", text: label, attr: { type: "button" } });
	button.addEventListener("click", () => {
		notice.hide();
		onClick();
	});
}

/** The files of `pool` (default: the Markdown notes) whose name or path contains `query`, those starting with it first. */
class NoteSuggest extends AbstractInputSuggest<TFile> {
	public constructor(
		app: App,
		input: HTMLInputElement,
		private readonly exclude: string,
		private readonly pool?: () => TFile[],
	) {
		super(app, input);
		this.limit = 30;
	}

	protected getSuggestions(query: string): TFile[] {
		const text = query.trim().toLowerCase();
		const rank = (file: TFile): number => (file.basename.toLowerCase().startsWith(text) ? 0 : file.basename.toLowerCase().includes(text) ? 1 : 2);
		return (this.pool?.() ?? this.app.vault.getMarkdownFiles())
			.filter((file) => file.path !== this.exclude && file.path.toLowerCase().includes(text))
			.sort((a, b) => rank(a) - rank(b) || a.basename.localeCompare(b.basename));
	}

	public renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createDiv({ text: file.basename });
		const folder = file.parent?.path ?? "";
		if (folder !== "" && folder !== "/") el.createDiv({ cls: "vaultmate-muted", text: folder });
	}
}

/** The note a typed name means: the one picked from the list, else a link name or a path. */
function findNote(app: App, typed: string, from: string, picked: TFile | null): TFile | null {
	const text = typed.trim();
	if (text === "") return null;
	if (picked && picked.basename === text) return picked;
	const found = app.metadataCache.getFirstLinkpathDest(text, from) ?? app.vault.getFileByPath(normalizePath(text)) ?? app.vault.getFileByPath(normalizePath(`${text}.md`));
	return found?.extension === "md" ? found : null;
}

export class IdeaModal extends JournalModal {
	private index = 0;
	private busy = false;
	private suggest: NoteSuggest | null = null;

	/** `items` is one idea, or the queue of Tend mode (`tend`). */
	public constructor(
		app: App,
		private readonly host: IdeaPortalHost,
		private readonly items: readonly IdeaItem[],
		private readonly tend = false,
	) {
		super(app);
	}

	public onOpen(): void {
		this.show();
	}

	public onClose(): void {
		this.suggest?.close();
		super.onClose();
	}

	/** Moves to the next idea, or ends the session. */
	private advance(): void {
		this.index++;
		if (this.index < this.items.length) {
			this.show();
			return;
		}
		if (this.tend) new Notice("All fresh ideas tended.");
		this.close();
	}

	/** Runs a write on the current idea; the next idea shows when it wrote. Every button waits meanwhile. */
	private async run(write: (item: IdeaItem) => Promise<boolean>, restore: () => void): Promise<void> {
		const item = this.items[this.index];
		if (!item || this.busy) return;
		this.busy = true;
		const buttons = Array.from(this.contentEl.querySelectorAll("button"));
		buttons.forEach((button) => (button.disabled = true));
		let written = false;
		try {
			const located = await locateIdea(this.host, item);
			written = located !== null && (await write(located));
		} finally {
			this.busy = false;
		}
		if (written) {
			this.written = true;
			this.host.stampDone();
			this.advance();
		} else {
			buttons.forEach((button) => (button.disabled = false));
			restore();
		}
	}

	private show(): void {
		const item = this.items[this.index];
		if (!item) return;
		const { contentEl, host } = this;
		this.suggest?.close();
		this.suggest = null;
		contentEl.empty();
		const statement = itemStatement(item);

		createSectionHeader(contentEl, this.tend ? `Idea ${this.index + 1} of ${this.items.length}` : "Idea");
		contentEl.createEl("p", { cls: "vaultmate-statement", text: statement || "(no text yet)" });
		if (item.children.length > 0) {
			const list = contentEl.createEl("ul", { cls: "vaultmate-context" });
			for (const child of item.children) list.createEl("li", { text: child });
		}
		const planted = contentEl.createEl("p", { cls: "vaultmate-muted" });
		planted.appendText(`${plantedText(ideaAge(item.date, startOfDay()))} in `);
		const source = planted.createEl("button", { cls: "vaultmate-inline-link", text: baseName(item.path), attr: { type: "button", "aria-label": `Open ${baseName(item.path)} at this idea` } });
		source.addEventListener("click", () => {
			host.openAtLine(item.path, item.line);
			this.onClosed = undefined; // the user chose to stay in Obsidian
			this.close();
		});

		// ---- The actions, then the panel of the chosen one ----
		const row = contentEl.createDiv({ cls: "vaultmate-portal-actions", attr: { role: "group", "aria-label": "What to do with this idea" } });
		const panel = contentEl.createDiv({ cls: "vaultmate-portal-panel" });
		const buttons = new Map<PortalAction, HTMLButtonElement>();
		const choose = (action: PortalAction): void => {
			if (action === "decision" || action === "prediction") {
				this.openJournal(action, statement);
				return;
			}
			if (action === "skip") {
				this.advance();
				return;
			}
			buttons.forEach((button, key) => {
				button.setAttribute("aria-pressed", String(key === action));
				button.toggleClass("is-selected", key === action);
			});
			this.suggest?.close();
			this.suggest = null;
			panel.empty();
			if (hasPanel(action)) {
				panel.createEl("p", { cls: "vaultmate-portal-panel-title", text: ACTION_LABELS[action] });
				this.renderPanel(panel, action, item, statement);
			}
		};
		const context = { tend: this.tend, projectsEnabled: host.projectsEnabled(), seedSubtag: host.settings.ideas.seedSubtag };
		for (const action of portalActions(context)) {
			const button = createIconButton(row, ACTION_SPRITES[action], ACTION_LABELS[action], () => choose(action));
			button.setAttribute("aria-pressed", "false");
			buttons.set(action, button);
		}
		// Opening the modal focuses its first control (the note link) after this runs: focus the first action next.
		row.win.setTimeout(() => row.querySelector("button")?.focus(), 0);
	}

	/** Decision and Prediction open the journal form over the portal, prefilled with the idea. */
	private openJournal(kind: JournalKind, statement: string): void {
		new NewEntryModal(this.app, kind, (result) => void this.run((located) => trackIdeaAs(this.host, located, kind, result), () => undefined), statement, this.host.lessons(kind)).open();
	}

	private renderPanel(panel: HTMLElement, action: PortalAction, item: IdeaItem, statement: string): void {
		switch (action) {
			case "add":
				this.addPanel(panel, item);
				break;
			case "new-note":
				this.newNotePanel(panel, item, statement);
				break;
			case "track":
				this.trackPanel(panel, item, statement);
				break;
			case "seed":
				this.seedPanel(panel);
				break;
			case "drop":
				this.dropPanel(panel);
				break;
			default:
				break;
		}
	}

	private confirmButton(panel: HTMLElement, text: string): HTMLButtonElement {
		return this.button(panel.createDiv({ cls: "vaultmate-actions vaultmate-idea-actions" }), text, true, () => undefined);
	}

	/** The optional note, behind a link that reveals the field; `confirm` runs on Enter in it. */
	private optionalNote(panel: HTMLElement, action: PortalAction, confirm: () => void): () => string {
		const label = noteLinkLabel(action);
		if (label === null) return () => "";
		const link = panel.createEl("button", { cls: "vaultmate-button vaultmate-note-link", text: label, attr: { type: "button", "aria-expanded": "false" } });
		let input: HTMLInputElement | null = null;
		link.addEventListener("click", () => {
			if (input) return;
			link.hide();
			input = textField(panel, action === "drop" ? "Reason" : "Note", { placeholder: action === "drop" ? "Why not" : "Why, or what you decided" }) as HTMLInputElement;
			this.submitOnEnter(input, confirm);
			input.focus();
		});
		return () => input?.value ?? "";
	}

	// ---- Add to a note ----
	private addPanel(panel: HTMLElement, item: IdeaItem): void {
		const { host } = this;
		const target = textField(panel, "Note", { placeholder: "Search or name a note" }) as HTMLInputElement;
		const headingField = panel.createEl("label", { cls: "vaultmate-field" });
		headingField.createSpan({ cls: "vaultmate-field-label", text: "Under heading" });
		const headingSelect = headingField.createEl("select", { cls: "dropdown vaultmate-select" });
		const hint = panel.createEl("p", { cls: "vaultmate-muted" });
		const note = this.optionalNote(panel, "add", () => confirm.click());
		const confirm = this.confirmButton(panel, "Add to a note");

		let picked: TFile | null = null;
		let request = 0;
		const existing = (): TFile | null => findNote(this.app, target.value, item.path, picked);
		// The tracks of the note first, then its other headings; the one for ideas preselected, else the end of the note.
		const loadHeadings = async (file: TFile, id: number): Promise<void> => {
			const headings = orderedHeadings((await this.app.vault.cachedRead(file)).split(/\r?\n/));
			if (id !== request) return;
			headingSelect.empty();
			headingSelect.createEl("option", { value: "", text: "End of note" });
			for (const heading of headings) headingSelect.createEl("option", { value: heading.text, text: `${"#".repeat(heading.level)} ${heading.text}` });
			// The default is read in note order: a track whose title says "idea" must not win over the Ideas section.
			headingSelect.value = defaultIdeaHeading([...headings].sort((a, b) => a.line - b.line)) ?? "";
		};
		const refresh = (): void => {
			const file = existing();
			const id = ++request;
			const state = addState(target.value, file ? { basename: file.basename, own: file.path === item.path } : null);
			headingField.toggle(file !== null && file.path !== item.path);
			confirm.setText(state.label);
			confirm.disabled = state.disabled || this.busy;
			hint.setText(state.hint);
			if (file && file.path !== item.path) void loadHeadings(file, id);
		};
		const send = async (): Promise<void> => {
			const file = existing();
			if (!file || file.path === item.path) return;
			const heading = headingSelect.value === "" ? null : headingSelect.value;
			await this.run((located) => addIdeaToNote(host, located, file, heading, note()), refresh);
		};
		confirm.addEventListener("click", () => void send());
		this.bindNoteField(target, item.path, (file) => (picked = file), refresh, () => !confirm.disabled && confirm.click());
		this.focusLater(target);
		refresh();
	}

	// ---- New note ----
	private newNotePanel(panel: HTMLElement, item: IdeaItem, statement: string): void {
		const { host } = this;
		const name = textField(panel, "Short name", { placeholder: "Title of the new note" }) as HTMLInputElement;
		name.value = titleFromIdea(statement);
		const hint = panel.createEl("p", { cls: "vaultmate-muted" });
		const note = this.optionalNote(panel, "new-note", () => confirm.click());
		const confirm = this.confirmButton(panel, "Create note");

		const existing = (): TFile | null => findNote(this.app, name.value, item.path, null);
		const path = (): string | null => newNotePath(name.value, host.settings.ideas.newNoteFolder, this.app.fileManager.getNewFileParent(item.path).path);
		const refresh = (): void => {
			const where = path();
			const state = newNoteState(where, existing() !== null || (where !== null && this.app.vault.getFileByPath(normalizePath(where)) !== null));
			confirm.setText(state.label);
			confirm.disabled = state.disabled || this.busy;
			hint.setText(state.hint);
		};
		confirm.addEventListener("click", () => {
			void this.run(async (located) => {
				// A note with this name already exists: the idea is added to it.
				const file = existing();
				if (file && file.path !== item.path) return addIdeaToNote(host, located, file, null, note());
				const result = await createNoteFromIdea(host, located, name.value, note());
				if (result.status === "failed") return false;
				if (result.status === "exists") return addIdeaToNote(host, located, result.file, null, note());
				const created = result.file;
				if (this.tend) noticeWithButton(`Created ${created.basename}.`, "Open", () => void this.app.workspace.getLeaf(false).openFile(created));
				else void this.app.workspace.getLeaf(false).openFile(created);
				return true;
			}, refresh);
		});
		name.addEventListener("input", refresh);
		this.submitOnEnter(name, () => !confirm.disabled && confirm.click());
		this.focusLater(name);
		refresh();
	}

	// ---- New track ----
	private trackPanel(panel: HTMLElement, item: IdeaItem, statement: string): void {
		const { host } = this;
		const projects = host.projectNotes();
		const projectField = textField(panel, "Project", { placeholder: "Search a project note" }) as HTMLInputElement;
		projectField.value = projects.find((project) => project.path === item.path)?.name ?? "";
		let titles: string[] = [];
		let loading = 0;
		let picked: ProjectChoice | null = null;
		const chosen = (): ProjectChoice | null => (picked && picked.name === projectField.value.trim() ? picked : findProject(projects, projectField.value));
		const create = panel.createEl("button", { cls: "vaultmate-button vaultmate-note-link", text: "New project…", attr: { type: "button" } });
		const fields = addTrackFields(panel, { prefill: prefillName(statement), onChange: () => refresh(), onEnter: () => !confirm.disabled && confirm.click() });
		const hint = panel.createEl("p", { cls: "vaultmate-muted" });
		const confirm = this.confirmButton(panel, "Add track");

		const refresh = (): void => {
			const state = trackState(chosen(), fields.typedName(), fields.status(), titles);
			confirm.setText(state.label);
			confirm.disabled = state.disabled || !fields.dueValid() || this.busy;
			hint.setText(state.hint);
			fields.warnDuplicate(state.duplicate);
		};
		const loadTitles = async (): Promise<void> => {
			const project = chosen();
			const id = ++loading;
			const next = project ? await host.trackTitles(project.path) : [];
			if (id !== loading) return;
			titles = next;
			refresh();
		};
		confirm.addEventListener("click", () => {
			const project = chosen();
			const file = project ? this.app.vault.getFileByPath(project.path) : null;
			if (!project || !file) return;
			const firstTask = fields.firstTask();
			const choice: NewTrackChoice = { status: fields.status(), shortName: trackState(project, fields.typedName(), fields.status(), []).name, ...(firstTask ? { firstTask } : {}) };
			void this.run((located) => newTrackFromIdea(host, located, file, choice), refresh);
		});

		// The new project joins the list and is picked, ready for the track.
		create.addEventListener("click", () =>
			host.newProject(chosen() ? "" : projectField.value.trim(), (file) => {
				picked = { path: file.path, name: file.basename };
				projects.push(picked);
				projectField.value = file.basename;
				void loadTitles();
				fields.focusName();
			}),
		);

		const files = (): TFile[] => projects.flatMap((project) => this.app.vault.getFileByPath(project.path) ?? []);
		const suggest = new NoteSuggest(this.app, projectField, "", files);
		this.suggest = suggest;
		suggest.onSelect((file) => {
			picked = projects.find((project) => project.path === file.path) ?? null;
			suggest.setValue(file.basename);
			suggest.close();
			void loadTitles();
			fields.focusName();
		});
		projectField.addEventListener("input", () => {
			picked = null;
			void loadTitles();
		});
		this.submitOnEnter(projectField, () => fields.focusName());
		refresh();
		void loadTitles();
		projectField.win.setTimeout(() => fields.focusName(), 0);
	}

	// ---- Project seed ----
	private seedPanel(panel: HTMLElement): void {
		const { ideas } = this.host.settings;
		panel.createEl("p", { cls: "vaultmate-muted", text: seedSentence(ideas.tag, ideas.seedSubtag) });
		const confirm = this.confirmButton(panel, "Make it a project seed");
		confirm.addEventListener("click", () => void this.run((located) => makeProjectSeed(this.host, located), () => undefined));
		this.focusLater(confirm);
	}

	// ---- Drop ----
	private dropPanel(panel: HTMLElement): void {
		const note = this.optionalNote(panel, "drop", () => confirm.click());
		const confirm = this.confirmButton(panel, "Drop idea");
		confirm.addEventListener("click", () => void this.run(async (located) => (await dropIdea(this.host, located, note())) !== null, () => undefined));
		this.focusLater(confirm);
	}

	private focusLater(element: HTMLElement): void {
		element.win.setTimeout(() => {
			element.focus();
			if (element.instanceOf(HTMLInputElement)) element.select();
		}, 0);
	}

	/** A note field with the note autocomplete. Enter picks a highlighted suggestion first; only when it did not, it confirms. */
	private bindNoteField(input: HTMLInputElement, exclude: string, onPick: (file: TFile | null) => void, refresh: () => void, confirm: () => void): void {
		const suggest = new NoteSuggest(this.app, input, exclude);
		this.suggest = suggest;
		let selectedByKey = false;
		suggest.onSelect((file) => {
			selectedByKey = true;
			onPick(file);
			suggest.setValue(file.basename);
			suggest.close();
			refresh();
		});
		input.addEventListener("input", () => {
			onPick(null);
			refresh();
		});
		input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" || event.isComposing) return;
			event.preventDefault();
			selectedByKey = false;
			input.win.setTimeout(() => {
				if (!selectedByKey) confirm();
			}, 0);
		});
	}
}
