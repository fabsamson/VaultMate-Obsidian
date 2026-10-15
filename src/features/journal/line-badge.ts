// A small end-of-line badge on decision and prediction lines (Live Preview and source mode). It is the
// only VaultMate mark inside notes: nothing else in the note is restyled. Only the visible lines are read.
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";

import { startOfDay } from "../../core/dates";
import { badgeFor, classifyLine, kindName, otherKind, type BadgeInfo, type JournalKind, type JournalTags } from "./journal-line";

export interface BadgeHost {
	enabled(): boolean;
	tags(): JournalTags;
	/** A badge was clicked on 0-based line `line`; `kind` is the kind to review or to track the line as. */
	activate(view: EditorView, line: number, action: "review" | "track", kind: JournalKind): void;
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
		if (info.action === "review") return this.button(view, info.text, `Review this ${kindName(info.kind)}. ${info.text}`, "review", info.kind);
		// A line to track is offered as either kind, the kind of its tag first.
		const group = createSpan();
		const other = otherKind(info.kind);
		group.append(
			this.button(view, info.text, `Track this line as a ${kindName(info.kind)}. ${info.text}`, "track", info.kind),
			this.button(view, `${other === "decision" ? "⚖" : "◔"} Track as ${kindName(other)}`, `Track this line as a ${kindName(other)}`, "track", other),
		);
		return group;
	}

	private button(view: EditorView, text: string, label: string, action: "review" | "track", kind: JournalKind): HTMLElement {
		const button = createEl("button", { cls: "vaultmate-badge is-action", text, attr: { type: "button", "aria-label": label } });
		button.addEventListener("click", (event) => {
			event.preventDefault();
			const line = view.state.doc.lineAt(view.posAtDOM(button)).number - 1;
			this.host.activate(view, line, action, kind);
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
