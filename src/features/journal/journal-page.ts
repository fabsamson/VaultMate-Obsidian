// The hub's "Decisions and predictions" page: reviews and track record of one kind, in one scope.
import { groupByDue, type JournalKind } from "./journal-line";
import { startOfDay } from "../../core/dates";
import { createSectionHeader, createSegmentedControl } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
import { SPRITES } from "../../ui/sprites";
import type { JournalItem } from "./journal-index";
import { createClosedBlock, type ClosedHost } from "./closed-section";
import { createReviewsBlock, type ReviewsHost } from "./reviews-section";
import { addScopeControls } from "./scope-control";
import { createTrackRecordBlock, type TrackRecordHost } from "./track-record-section";

export interface JournalPageHost extends ReviewsHost, TrackRecordHost, ClosedHost {
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

export function createJournalPage(host: JournalPageHost): HubPage {
	const renderReviews = createReviewsBlock(host);
	const renderClosed = createClosedBlock(host);
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
			let allowed = addScopeControls(controls, ctx, notePath, markdownPaths, (next) => {
				allowed = next;
				renderContent();
			});

			const content = body.createDiv();
			const renderContent = (): void => {
				content.empty();
				const items = host.entries().filter((item) => item.entry.kind === ctx.state.kind && (allowed === null || allowed.has(item.path)));
				createSectionHeader(content, "Reviews");
				renderReviews(content.createDiv({ cls: "vaultmate-hub-section" }), items);
				const closed = renderClosed(content.createDiv({ cls: "vaultmate-hub-section" }), items);
				createSectionHeader(content, "Track record");
				renderTrackRecord(content.createDiv({ cls: "vaultmate-hub-section" }), items, ctx.state.kind, closed ? () => closed.scrollIntoView({ block: "start" }) : null);
			};
			renderContent();
		},
	};
}
