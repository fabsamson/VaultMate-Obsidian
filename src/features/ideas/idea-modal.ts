// The idea portal: what to do with one idea (send it to a note, create a note from it, track it as a
// decision or a prediction, drop it), and Tend mode, the same form over a queue of ideas.
import { AbstractInputSuggest, normalizePath, Notice, type App, type TFile } from "obsidian";

import { startOfDay } from "../../core/dates";
import { baseName } from "../context/note-meta";
import { createSectionHeader } from "../../ui/components";
import type { JournalKind } from "../journal/journal-line";
import { JournalModal, NewEntryModal, textField } from "../journal/journal-modals";
import { ideaAge, titleFromIdea, type IdeaItem } from "./idea-line";
import { defaultIdeaHeading, listHeadings, newNotePath } from "./idea-note";
import { addIdeaToNote, createNoteFromIdea, dropIdea, locateIdea, trackIdeaAs, type IdeaWriteHost } from "./idea-write";
import { itemStatement, plantedText } from "./ideas-model";

export interface IdeaPortalHost extends IdeaWriteHost {
	/** Opens the note at a 0-based line. */
	openAtLine(path: string, line: number): void;
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

/** The Markdown notes whose name or path contains `query`, those starting with it first. */
class NoteSuggest extends AbstractInputSuggest<TFile> {
	public constructor(
		app: App,
		input: HTMLInputElement,
		private readonly exclude: string,
	) {
		super(app, input);
		this.limit = 30;
	}

	protected getSuggestions(query: string): TFile[] {
		const text = query.trim().toLowerCase();
		const rank = (file: TFile): number => (file.basename.toLowerCase().startsWith(text) ? 0 : file.basename.toLowerCase().includes(text) ? 1 : 2);
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path !== this.exclude && file.path.toLowerCase().includes(text))
			.sort((a, b) => rank(a) - rank(b) || a.basename.localeCompare(b.basename));
	}

	public renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createDiv({ text: file.basename });
		const folder = file.parent?.path ?? "";
		if (folder !== "" && folder !== "/") el.createDiv({ cls: "vaultmate-muted", text: folder });
	}
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

	/** Runs a write on the current idea; the next idea shows when it wrote. */
	private async run(buttons: HTMLButtonElement[], write: (item: IdeaItem) => Promise<boolean>, restore: () => void): Promise<void> {
		const item = this.items[this.index];
		if (!item || this.busy) return;
		this.busy = true;
		buttons.forEach((button) => (button.disabled = true));
		let written = false;
		try {
			const located = await locateIdea(this.host, item);
			written = located !== null && (await write(located));
		} finally {
			this.busy = false;
		}
		if (written) this.advance();
		else {
			buttons.forEach((button) => (button.disabled = false));
			restore();
		}
	}

	private show(): void {
		const item = this.items[this.index];
		if (!item) return;
		const { contentEl, host } = this;
		this.suggest?.close();
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
			this.close();
		});

		// ---- Send to a note ----
		createSectionHeader(contentEl, "Send to a note");
		const target = textField(contentEl, "Note", { placeholder: "Search or name a note" }) as HTMLInputElement;
		target.value = titleFromIdea(statement);
		const headingField = contentEl.createEl("label", { cls: "vaultmate-field" });
		headingField.createSpan({ cls: "vaultmate-field-label", text: "Under heading" });
		const headingSelect = headingField.createEl("select", { cls: "dropdown vaultmate-select" });
		const hint = contentEl.createEl("p", { cls: "vaultmate-muted" });
		const note = textField(contentEl, "Note (optional)", { placeholder: "Why, or what you decided" });

		const actions = contentEl.createDiv({ cls: "vaultmate-actions vaultmate-idea-actions" });
		const primary = this.button(actions, "Add", true, () => void send());
		const more = contentEl.createDiv({ cls: "vaultmate-actions vaultmate-idea-actions" });
		const decision = this.button(more, "Track as a decision", false, () => track("decision"));
		const prediction = this.button(more, "Track as a prediction", false, () => track("prediction"));
		const drop = this.button(more, "Drop", false, () => void this.run(buttons, async (located) => (await dropIdea(host, located, note.value)) !== null, refresh));
		const buttons = [primary, decision, prediction, drop];
		if (this.tend) buttons.push(this.button(more, "Skip", false, () => this.advance()));

		const track = (kind: JournalKind): void => {
			new NewEntryModal(
				this.app,
				kind,
				(result) => void this.run(buttons, (located) => trackIdeaAs(host, located, kind, result), refresh),
				statement,
			).open();
		};

		let picked: TFile | null = null;
		let request = 0;
		const existing = (): TFile | null => {
			const text = target.value.trim();
			if (text === "") return null;
			if (picked && picked.basename === text) return picked;
			const found = this.app.metadataCache.getFirstLinkpathDest(text, item.path) ?? this.app.vault.getFileByPath(normalizePath(text)) ?? this.app.vault.getFileByPath(normalizePath(`${text}.md`));
			return found?.extension === "md" ? found : null;
		};
		const newPath = (): string | null => newNotePath(target.value, host.settings.ideas.newNoteFolder, this.app.fileManager.getNewFileParent(item.path).path);

		// The heading dropdown follows the note: its headings, the one for ideas preselected, then the end of the note.
		const loadHeadings = async (file: TFile, id: number): Promise<void> => {
			const headings = listHeadings((await this.app.vault.cachedRead(file)).split(/\r?\n/));
			if (id !== request) return;
			headingSelect.empty();
			headingSelect.createEl("option", { value: "", text: "End of note" });
			for (const heading of headings) headingSelect.createEl("option", { value: heading.text, text: `${"#".repeat(heading.level)} ${heading.text}` });
			headingSelect.value = defaultIdeaHeading(headings) ?? "";
		};

		const refresh = (): void => {
			const file = existing();
			const id = ++request;
			headingField.toggle(file !== null && file.path !== item.path);
			if (file) {
				primary.setText(`Add to ${file.basename}`);
				const own = file.path === item.path;
				primary.disabled = own || this.busy;
				hint.setText(own ? "Pick another note: the idea is already in this one." : "");
				if (!own) void loadHeadings(file, id);
				return;
			}
			const path = newPath();
			primary.setText(path === null ? "Create note" : `Create "${baseName(path)}"`);
			primary.disabled = path === null || this.busy;
			const folder = path === null ? "" : path.slice(0, Math.max(0, path.lastIndexOf("/")));
			hint.setText(path === null ? "" : `In ${folder === "" ? "the vault root" : folder}`);
		};

		const send = async (): Promise<void> => {
			const file = existing();
			if (file) {
				const heading = headingSelect.value === "" ? null : headingSelect.value;
				await this.run(buttons, (located) => addIdeaToNote(host, located, file, heading, note.value), refresh);
				return;
			}
			await this.run(buttons, async (located) => {
				const result = await createNoteFromIdea(host, located, target.value, note.value);
				if (result.status === "failed") return false;
				if (result.status === "exists") return addIdeaToNote(host, located, result.file, null, note.value);
				const created = result.file;
				if (this.tend) noticeWithButton(`Created ${created.basename}.`, "Open", () => void this.app.workspace.getLeaf(false).openFile(created));
				else void this.app.workspace.getLeaf(false).openFile(created);
				return true;
			}, refresh);
		};

		const suggest = new NoteSuggest(this.app, target, item.path);
		this.suggest = suggest;
		let selectedByKey = false;
		suggest.onSelect((file) => {
			selectedByKey = true;
			picked = file;
			suggest.setValue(file.basename);
			suggest.close();
			refresh();
		});
		target.addEventListener("input", () => {
			picked = null;
			refresh();
		});
		// Enter picks a highlighted suggestion first; only when it did not, it sends.
		const fields: HTMLElement[] = [target, note];
		for (const input of fields) {
			input.addEventListener("keydown", (event) => {
				if (event.key !== "Enter" || event.isComposing) return;
				event.preventDefault();
				selectedByKey = false;
				input.win.setTimeout(() => {
					if (!selectedByKey && !primary.disabled) primary.click();
				}, 0);
			});
		}
		refresh();
		target.focus();
		target.select();
	}
}
