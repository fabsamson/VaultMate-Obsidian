import { describe, expect, it } from "vitest";

import { applyEdits, applyEditsToEditor, editorLines, type NoteEdit, type NotePlan } from "../src/core/note-edit";
import { editorFor, readNoteLines, writeNote } from "../src/core/note-write";
import { planRewrite } from "../src/features/journal/journal-note";
import { asEditor, FakeApp } from "./helpers/fake-app";

const PATH = "Notes/Idea.md";
const OPEN = "- [ ] Buy a desk";

/** Replaces line `index` after checking it is still `expected`; refuses with "changed" otherwise. */
function replaceLine(index: number, expected: string, line: string): (lines: string[]) => NotePlan<"changed"> {
	return (lines) => (lines[index] === expected ? { ok: true, edits: [{ at: index, remove: 1, lines: [line] }] } : { ok: false, reason: "changed" });
}

function appOf(text: string): FakeApp {
	const app = new FakeApp();
	app.files.set(PATH, text);
	return app;
}

describe("writeNote", () => {
	it("writes through the editor of a note open in source mode, as one change", async () => {
		const app = appOf(`# T\n${OPEN}\nEnd`);
		const editor = app.open(PATH, "source");
		editor.text = `# T\n${OPEN}\nunsaved\nEnd`;
		const result = await writeNote(app.asApp(), PATH, replaceLine(1, OPEN, "- [x] Buy a desk"));
		expect(result).toEqual({ status: "written" });
		expect(editor.text).toBe("# T\n- [x] Buy a desk\nunsaved\nEnd");
		expect(editor.calls).toBe(1);
		expect(app.processed).toBe(0);
	});

	it("never touches the editor of a note shown in reading mode only", async () => {
		const app = appOf(`# T\n${OPEN}\nEnd`);
		const reading = app.open(PATH, "preview");
		const result = await writeNote(app.asApp(), PATH, replaceLine(1, OPEN, "DONE"));
		expect(result).toEqual({ status: "written" });
		expect(reading.calls).toBe(0);
		expect(app.files.get(PATH)).toBe("# T\nDONE\nEnd");
	});

	it("writes the file when the note is not open", async () => {
		const app = appOf(`${OPEN}\n`);
		await writeNote(app.asApp(), PATH, replaceLine(0, OPEN, "DONE"));
		expect(app.files.get(PATH)).toBe("DONE\n");
	});

	it("uses the source view when the same note is also open in reading mode, whichever is focused", async () => {
		const app = appOf(`${OPEN}\nEnd`);
		const reading = app.open(PATH, "preview");
		const source = app.open(PATH, "source");
		app.workspace.activeEditor = { editor: reading };
		await writeNote(app.asApp(), PATH, replaceLine(0, OPEN, "DONE"));
		expect(source.text).toBe("DONE\nEnd");
		expect(reading.calls).toBe(0);
		expect(app.processed).toBe(0);
	});

	it("prefers the focused editor when two views are in source mode", () => {
		const app = appOf("x");
		const first = app.open(PATH, "source");
		const second = app.open(PATH, "source");
		app.workspace.activeEditor = { editor: second };
		expect(editorFor(app.asApp(), PATH)).toBe(second);
		app.workspace.activeEditor = null;
		expect(editorFor(app.asApp(), PATH)).toBe(first);
	});

	it("ignores a source view of another note", async () => {
		const app = appOf(OPEN);
		const other = app.open("Other.md", "source");
		await writeNote(app.asApp(), PATH, replaceLine(0, OPEN, "DONE"));
		expect(other.calls).toBe(0);
		expect(app.files.get(PATH)).toBe("DONE");
	});

	it("refuses and writes nothing when the expected text changed, in the file and in the editor", async () => {
		const app = appOf(`${OPEN} edited\n`);
		expect(await writeNote(app.asApp(), PATH, replaceLine(0, OPEN, "DONE"))).toEqual({ status: "refused", reason: "changed" });
		expect(app.files.get(PATH)).toBe(`${OPEN} edited\n`);

		const editor = app.open(PATH, "source");
		expect(await writeNote(app.asApp(), PATH, replaceLine(0, OPEN, "DONE"))).toEqual({ status: "refused", reason: "changed" });
		expect(editor.calls).toBe(0);
	});

	it("checks the editor's own text, unsaved changes included", async () => {
		const app = appOf(`${OPEN}\n`);
		const editor = app.open(PATH, "source");
		editor.text = "typed since the last save\n";
		expect(await writeNote(app.asApp(), PATH, replaceLine(0, OPEN, "DONE"))).toEqual({ status: "refused", reason: "changed" });
	});

	it("says when the note is gone", async () => {
		expect(await writeNote(new FakeApp().asApp(), PATH, replaceLine(0, OPEN, "DONE"))).toEqual({ status: "missing" });
	});

	it("keeps CRLF line breaks and the final line break of the file", async () => {
		const app = appOf(`# T\r\n${OPEN}\r\nEnd\r\n`);
		await writeNote(app.asApp(), PATH, replaceLine(1, OPEN, "DONE"));
		expect(app.files.get(PATH)).toBe("# T\r\nDONE\r\nEnd\r\n");
	});

	it("keeps a file without a final line break that way, and inserts at its end", async () => {
		const app = appOf("# T\r\nEnd");
		await writeNote(app.asApp(), PATH, (lines) => ({ ok: true, edits: [{ at: lines.length, remove: 0, lines: ["- new"] }] }));
		expect(app.files.get(PATH)).toBe("# T\r\nEnd\r\n- new");
	});

	it("inserts after the last line of a file that ends with a line break", async () => {
		const app = appOf("# T\n");
		await writeNote(app.asApp(), PATH, () => ({ ok: true, edits: [{ at: 1, remove: 0, lines: ["- new"] }] }));
		expect(app.files.get(PATH)).toBe("# T\n- new\n");
	});

	it("applies several edits in order, in the file and in the editor", async () => {
		const edits: NoteEdit[] = [
			{ at: 2, remove: 1, lines: ["C"] },
			{ at: 0, remove: 1, lines: [] },
		];
		const app = appOf("a\nb\nc\nd");
		await writeNote(app.asApp(), PATH, () => ({ ok: true, edits }));
		expect(app.files.get(PATH)).toBe("b\nC\nd");

		const opened = appOf("a\nb\nc\nd");
		const editor = opened.open(PATH, "source");
		await writeNote(opened.asApp(), PATH, () => ({ ok: true, edits }));
		expect(editor.text).toBe("b\nC\nd");
	});

	it("rewrites an entry and its sub-items the same way in a CRLF file and in an editor", async () => {
		const text = `# Title\r\n${OPEN}\r\n    - Why: cheaper\r\n\r\nEnd`;
		const plan = (lines: string[]): NotePlan<null> => {
			const made = planRewrite(lines, 1, OPEN, "DONE", "review");
			return made.ok ? { ok: true, edits: [{ at: made.from, remove: made.to - made.from + 1, lines: made.replacement }] } : { ok: false, reason: null };
		};
		const app = appOf(text);
		await writeNote(app.asApp(), PATH, plan);
		expect(app.files.get(PATH)).toBe("# Title\r\nDONE\r\n    - Why: cheaper\r\n    - review\r\n\r\nEnd");

		const opened = appOf(text.replaceAll("\r\n", "\n"));
		const editor = opened.open(PATH, "source");
		await writeNote(opened.asApp(), PATH, plan);
		expect(editor.text).toBe("# Title\nDONE\n    - Why: cheaper\n    - review\n\nEnd");
		expect(editor.calls).toBe(1);
	});
});

describe("readNoteLines", () => {
	it("reads the editor's lines when the note is open in source mode, else the file's", async () => {
		const app = appOf("a\r\nb");
		expect(await readNoteLines(app.asApp(), PATH)).toEqual(["a", "b"]);
		app.open(PATH, "preview").text = "stale";
		expect(await readNoteLines(app.asApp(), PATH)).toEqual(["a", "b"]);
		app.open(PATH, "source").text = "x\ny\nz";
		expect(await readNoteLines(app.asApp(), PATH)).toEqual(["x", "y", "z"]);
		expect(await readNoteLines(app.asApp(), "Missing.md")).toBeNull();
	});
});

describe("editor edits", () => {
	it("give the same note as applying the edits to the lines, for every kind of edit", () => {
		const text = "a\nb\nc";
		const edits: NoteEdit[] = [
			{ at: 3, remove: 0, lines: ["end"] },
			{ at: 0, remove: 0, lines: ["start"] },
			{ at: 1, remove: 0, lines: ["x", "y"] },
			{ at: 1, remove: 1, lines: ["B", "B2"] },
			{ at: 1, remove: 1, lines: [] },
			{ at: 2, remove: 1, lines: [] },
			{ at: 0, remove: 2, lines: [] },
		];
		for (const edit of edits) {
			const editor = appOf(text).open(PATH, "source");
			editor.text = text;
			applyEditsToEditor(asEditor(editor), [edit]);
			expect(editor.text.split("\n"), JSON.stringify(edit)).toEqual(applyEdits(text.split("\n"), [edit]));
		}
	});

	it("read the lines of an editor, empty last line included", () => {
		expect(editorLines(asEditor(appOf("").open(PATH, "source")))).toEqual([""]);
		const editor = appOf("").open(PATH, "source");
		editor.text = "a\n";
		expect(editorLines(asEditor(editor))).toEqual(["a", ""]);
	});
});
