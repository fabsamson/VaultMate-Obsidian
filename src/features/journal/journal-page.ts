// The hub's "Decisions and predictions" page: reviews and track record of one kind, in one scope.
import { groupByDue, type JournalKind } from "./journal-line";
import { startOfDay } from "../../core/dates";
import { createSectionHeader, createSegmentedControl } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
import { SPRITES } from "../../ui/sprites";
import type { JournalItem } from "./journal-index";
import { createReviewsBlock, type ReviewsHost } from "./reviews-section";
import { folderNoteFolder, scopePaths, type JournalScope } from "./scope";
import { createTrackRecordBlock, type TrackRecordHost } from "./track-record-section";

export interface JournalPageHost extends ReviewsHost, TrackRecordHost {
	enabled(): boolean;
	entries(): JournalItem[];
	/** Path of the active Markdown note, else the most recent one, or null. */
	activeNote(): string | null;
	/** Every Markdown note of the vault. */
	markdownPaths(): string[];
}

const KINDS = [
	{ value: "decision", label: "Decisions" },
	{ value: "prediction", label: "Predictions" },
] as const satisfies ReadonlyArray<{ value: JournalKind; label: string }>;

const SCOPE_LABEL: Record<JournalScope, string> = { vault: "Whole vault", note: "This note", tree: "This note and sub-notes" };

function noteName(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

export function createJournalPage(host: JournalPageHost): HubPage {
	const renderReviews = createReviewsBlock(host);
	const renderTrackRecord = createTrackRecordBlock(host);

	return {
		id: "journal",
		order: 10,
		title: "Decisions and predictions",
		sprite: SPRITES.moduleDecision,
		enabled: () => host.enabled(),
		summary: () => {
			const entries = host.entries();
			const groups = groupByDue(entries, startOfDay());
			const parts = [
				groups.overdue.length > 0 ? `${groups.overdue.length} overdue` : "",
				groups.week.length > 0 ? `${groups.week.length} this week` : "",
			].filter(Boolean);
			return parts.length > 0 ? parts.join(" · ") : "Nothing to review";
		},
		render: (body, ctx) => {
			const notePath = host.activeNote();
			const markdownPaths = host.markdownPaths();
			const isFolderNote = notePath !== null && folderNoteFolder(notePath, markdownPaths) !== null;
			const available: Record<JournalScope, boolean> = { vault: true, note: notePath !== null, tree: isFolderNote };
			// A scope that does not apply to the current note shows the whole vault, and comes back with a fitting note.
			let scope: JournalScope = available[ctx.state.scope] ? ctx.state.scope : "vault";
			let allowed = scopePaths(scope, notePath, markdownPaths);

			const controls = body.createDiv({ cls: "vaultmate-switcher" });
			createSegmentedControl(controls, {
				label: "Kind",
				choices: KINDS,
				value: ctx.state.kind,
				onChange: (kind) => {
					ctx.state.kind = kind;
					ctx.save();
					renderContent();
				},
			});
			const select = controls.createEl("select", { cls: "dropdown vaultmate-scope", attr: { "aria-label": "Scope" } });
			const reasons: Record<JournalScope, string> = { vault: "", note: " (no note open)", tree: notePath === null ? " (no note open)" : " (not a folder note)" };
			for (const value of ["vault", "note", "tree"] as const) {
				const option = select.createEl("option", { value, text: SCOPE_LABEL[value] + (available[value] ? "" : reasons[value]) });
				option.disabled = !available[value];
			}
			select.value = scope;
			select.addEventListener("change", () => {
				scope = select.value as JournalScope;
				ctx.state.scope = scope;
				ctx.save();
				allowed = scopePaths(scope, notePath, markdownPaths);
				renderHint();
				renderContent();
			});
			const hint = controls.createEl("p", { cls: "vaultmate-muted" });
			const renderHint = (): void => {
				hint.setText(scope !== "vault" && notePath ? `In ${noteName(notePath)}${scope === "tree" ? " and its sub-notes" : ""}` : ctx.state.scope !== "vault" ? "Showing the whole vault: this scope does not apply to the current note." : "");
				hint.toggle(hint.getText() !== "");
			};
			renderHint();

			const content = body.createDiv();
			const renderContent = (): void => {
				content.empty();
				const items = host.entries().filter((item) => item.entry.kind === ctx.state.kind && (allowed === null || allowed.has(item.path)));
				createSectionHeader(content, "Reviews");
				renderReviews(content.createDiv({ cls: "vaultmate-hub-section" }), items);
				createSectionHeader(content, "Track record");
				renderTrackRecord(content.createDiv({ cls: "vaultmate-hub-section" }), items, ctx.state.kind);
			};
			renderContent();
		},
	};
}
