// A small end-of-line badge on decision and prediction lines (Live Preview and source mode). It is the
// only VaultMate mark inside notes: nothing else in the note is restyled. Only the visible lines are read.
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";

import { startOfDay } from "../../core/dates";
import { badgeFor, classifyLine, kindName, type BadgeInfo, type JournalTags } from "./journal-line";

export interface BadgeHost {
	enabled(): boolean;
	tags(): JournalTags;
	/** A badge was clicked on 0-based line `line`. */
	activate(view: EditorView, line: number, action: "review" | "track"): void;
}

class BadgeWidget extends WidgetType {
	public constructor(
		private readonly info: BadgeInfo,
		private readonly host: BadgeHost,
	) {
		super();
	}

	public eq(other: BadgeWidget): boolean {
		return other.info.text === this.info.text && other.info.action === this.info.action;
	}

	public toDOM(view: EditorView): HTMLElement {
		const { info } = this;
		if (info.action === "none") return createSpan({ cls: "vaultmate-badge", text: info.text });
		const label = info.action === "review" ? `Review this ${kindName(info.kind)}` : `Track this line as a ${kindName(info.kind)}`;
		const button = createEl("button", { cls: "vaultmate-badge is-action", text: info.text, attr: { type: "button", "aria-label": `${label}. ${info.text}` } });
		const action = info.action;
		button.addEventListener("click", (event) => {
			event.preventDefault();
			const line = view.state.doc.lineAt(view.posAtDOM(button)).number - 1;
			this.host.activate(view, line, action);
		});
		return button;
	}
}

function build(view: EditorView, host: BadgeHost): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	if (!host.enabled()) return builder.finish();
	const tags = host.tags();
	const today = startOfDay();
	const { doc } = view.state;
	let last = 0;
	for (const range of view.visibleRanges) {
		for (let pos = range.from; pos <= range.to; ) {
			const line = doc.lineAt(pos);
			pos = line.to + 1;
			if (line.number <= last) continue;
			last = line.number;
			// Cheap exit: a journal line has a tag or a "Decision:" style colon.
			if (!line.text.includes("#") && !/[:：]/.test(line.text)) continue;
			const cls = classifyLine(line.text, tags);
			if (cls) builder.add(line.to, line.to, Decoration.widget({ widget: new BadgeWidget(badgeFor(cls, today), host), side: 1 }));
		}
	}
	return builder.finish();
}

export function createBadgeExtension(host: BadgeHost): Extension {
	return ViewPlugin.fromClass(
		class {
			public decorations: DecorationSet;

			public constructor(view: EditorView) {
				this.decorations = build(view, host);
			}

			public update(update: ViewUpdate): void {
				if (update.docChanged || update.viewportChanged || update.transactions.some((tr) => tr.reconfigured)) this.decorations = build(update.view, host);
			}
		},
		{ decorations: (plugin) => plugin.decorations },
	);
}
