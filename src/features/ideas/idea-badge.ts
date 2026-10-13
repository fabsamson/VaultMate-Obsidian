// A small end-of-line badge on idea lines (Live Preview and source mode), in the look of the decision and
// prediction badges. Only the visible lines are read; a line without a "#" is skipped at once.
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";

import { startOfDay } from "../../core/dates";
import { classifyIdeaLine, resultLinkTarget } from "./idea-line";
import { ideaBadge, type IdeaBadgeInfo } from "./ideas-model";
import { getChildren } from "../journal/journal-note";

export interface IdeaBadgeHost {
	enabled(): boolean;
	tag(): string;
	/** A badge was clicked on 0-based line `line`: open the portal, or the note the idea went to. */
	activate(view: EditorView, line: number, action: "portal" | "note"): void;
}

/** How many lines below a processed idea are read to find the note it went to. */
const CHILD_LINES = 12;

class IdeaBadgeWidget extends WidgetType {
	public constructor(
		private readonly info: IdeaBadgeInfo,
		private readonly host: IdeaBadgeHost,
	) {
		super();
	}

	public eq(other: IdeaBadgeWidget): boolean {
		return other.info.text === this.info.text && other.info.action === this.info.action;
	}

	public toDOM(view: EditorView): HTMLElement {
		const { info } = this;
		if (info.action === "none") return createSpan({ cls: "vaultmate-badge", text: info.text });
		const button = createEl("button", { cls: "vaultmate-badge is-action", text: info.text, attr: { type: "button", "aria-label": info.label } });
		const action = info.action;
		button.addEventListener("click", (event) => {
			event.preventDefault();
			const line = view.state.doc.lineAt(view.posAtDOM(button)).number - 1;
			this.host.activate(view, line, action);
		});
		return button;
	}
}

/** The link text of the note a processed idea on `lineNumber` (1-based) went to, from the lines below it. */
function targetBelow(view: EditorView, lineNumber: number): string | null {
	const { doc } = view.state;
	const lines: string[] = [];
	for (let n = lineNumber; n <= Math.min(doc.lines, lineNumber + CHILD_LINES); n++) lines.push(doc.line(n).text);
	return resultLinkTarget(getChildren(lines, 0).items);
}

function build(view: EditorView, host: IdeaBadgeHost): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	if (!host.enabled()) return builder.finish();
	const tag = host.tag();
	const today = startOfDay();
	const { doc } = view.state;
	let last = 0;
	for (const range of view.visibleRanges) {
		for (let pos = range.from; pos <= range.to; ) {
			const line = doc.lineAt(pos);
			pos = line.to + 1;
			if (line.number <= last) continue;
			last = line.number;
			if (!line.text.includes("#")) continue;
			const cls = classifyIdeaLine(line.text, tag);
			if (cls?.type !== "task" && cls?.type !== "plain") continue;
			const sent = cls.type === "task" && cls.entry.status !== "open" && (cls.entry.result === "added" || cls.entry.result === "new-note");
			const target = sent ? targetBelow(view, line.number) : null;
			builder.add(line.to, line.to, Decoration.widget({ widget: new IdeaBadgeWidget(ideaBadge(cls, today, target), host), side: 1 }));
		}
	}
	return builder.finish();
}

export function createIdeaBadgeExtension(host: IdeaBadgeHost): Extension {
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
