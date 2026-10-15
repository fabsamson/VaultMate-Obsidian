// Test-only: a fake Obsidian app (vault, workspace, editors) just big enough for the write gateway.
import type { App, Editor, EditorPosition } from "obsidian";

/** An editor over a string; `calls` counts the changes made to it. */
export class FakeEditor {
	public calls = 0;
	public constructor(public text: string, public cursor = 0) {}

	public lineCount(): number {
		return this.text.split("\n").length;
	}

	public getLine(line: number): string {
		return this.text.split("\n")[line] ?? "";
	}

	public getCursor(): EditorPosition {
		return { line: this.cursor, ch: 0 };
	}

	private offset(position: EditorPosition): number {
		const lines = this.text.split("\n");
		return lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.ch;
	}

	public replaceRange(replacement: string, from: EditorPosition, to: EditorPosition = from): void {
		this.calls++;
		this.text = this.text.slice(0, this.offset(from)) + replacement + this.text.slice(this.offset(to));
	}
}

export interface FakeView {
	file: { path: string };
	editor: FakeEditor;
	getMode: () => "source" | "preview";
}

export class FakeApp {
	public readonly files = new Map<string, string>();
	public views: FakeView[] = [];
	public processed = 0;

	public readonly vault = {
		getFileByPath: (path: string) => (this.files.has(path) ? { path } : null),
		read: (file: { path: string }) => Promise.resolve(this.files.get(file.path) ?? ""),
		process: (file: { path: string }, change: (text: string) => string) => {
			this.processed++;
			const next = change(this.files.get(file.path) ?? "");
			this.files.set(file.path, next);
			return Promise.resolve(next);
		},
	};

	public readonly workspace = {
		getLeavesOfType: () => this.views.map((view) => ({ view })),
		/** The focused editor, as Obsidian's `activeEditor`. */
		activeEditor: null as { editor: FakeEditor } | null,
	};

	/** Opens `path` in a view; its editor starts with the file's text. */
	public open(path: string, mode: "source" | "preview"): FakeEditor {
		const editor = new FakeEditor(this.files.get(path) ?? "");
		this.views.push({ file: { path }, editor, getMode: () => mode });
		return editor;
	}

	public asApp(): App {
		return this as unknown as App;
	}
}

export function asEditor(editor: FakeEditor): Editor {
	return editor as unknown as Editor;
}
