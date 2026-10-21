// The hub's "Decisions and predictions" page: reviews and track record of one kind, in one scope.
import { groupByDue, tidyUp, type JournalKind } from "./journal-line";
import { startOfDay } from "../../core/dates";
import { matchesQuery } from "../../core/search";
import { createDisclosure, createSectionHeader, createSegmentedControl, type Choice } from "../../ui/components";
import type { HubPage } from "../../ui/hub-view";
import { addPageSearch, createNoMatch, type PageSearchState } from "../../ui/page-search";
import type { Sprite } from "../../ui/pixel";
import { createSectionNav } from "../../ui/section-nav";
import { SPRITES } from "../../ui/sprites";
import type { JournalItem } from "./journal-index";
import { baseName } from "../context/note-meta";
import { createClosedBlock, type ClosedHost } from "./closed-section";
import { createReviewsBlock, type ReviewsHost } from "./reviews-section";
import { journalSections, type JournalSectionId } from "./journal-sections";
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
	{ value: "decision", label: "Decisions", sprite: SPRITES.stateDecision },
	{ value: "prediction", label: "Predictions", sprite: SPRITES.statePrediction },
] as const satisfies ReadonlyArray<Choice<JournalKind>>;

/** The chip of each section: its mark and its name. */
const SECTION_LOOKS: Record<JournalSectionId, { sprite: Sprite; label: string }> = {
	untracked: { sprite: SPRITES.actionTrack, label: "Not tracked yet" },
	overdue: { sprite: SPRITES.stateOverdue, label: "Overdue" },
	week: { sprite: SPRITES.stateWeek, label: "This week" },
	upcoming: { sprite: SPRITES.stateUpcoming, label: "Upcoming" },
	tidy: { sprite: SPRITES.actionDone, label: "Tidy up" },
	record: { sprite: SPRITES.stampReview, label: "Track record" },
};

export function createJournalPage(host: JournalPageHost): HubPage {
	const renderReviews = createReviewsBlock(host);
	const renderClosed = createClosedBlock(host);
	const renderTrackRecord = createTrackRecordBlock(host);
	/** The search, kept while the panel lives; the kind and the scope keep it. */
	const search: PageSearchState = { query: "" };

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
				groups.overdue.length > 0 ? `${groups.overdue.length} ${groups.overdue.length === 1 ? "review" : "reviews"} overdue` : "",
				groups.week.length > 0 ? `${groups.week.length} due this week` : "",
			].filter(Boolean);
			return parts.length > 0 ? parts.join(" · ") : "Nothing to review";
		},
		render: (body, ctx) => {
			const notePath = host.activeNote();
			const markdownPaths = host.markdownPaths();
			const controls = body.createDiv({ cls: "vaultmate-switcher" });
			let field: { setPlaceholder(text: string): void } | null = null;
			createSegmentedControl(controls, {
				label: "Kind",
				choices: KINDS,
				value: ctx.state.kind,
				onChange: (kind) => {
					ctx.state.kind = kind;
					ctx.save();
					field?.setPlaceholder(placeholder());
					renderContent();
				},
			});
			let allowed = addScopeControls(controls, ctx, notePath, markdownPaths, (next) => {
				allowed = next;
				renderContent();
			});

			const placeholder = (): string => (ctx.state.kind === "decision" ? "Search decisions" : "Search predictions");
			field = addPageSearch(body, search, placeholder(), () => renderContent());

			const content = body.createDiv();
			const renderContent = (): void => {
				content.empty();
				const searching = search.query.trim() !== "";
				const items = host
					.entries()
					.filter((item) => item.entry.kind === ctx.state.kind && (allowed === null || allowed.has(item.path)))
					.filter((item) => !searching || matchesQuery(`${item.entry.statement} ${item.entry.answer ?? ""} ${baseName(item.path)}`, search.query));
				const tidy = tidyUp(items);
				let tidyDisclosure: { setOpen(open: boolean): void } | null = null;
				const openTidy = (): void => {
					tidyDisclosure?.setOpen(true);
					ctx.state.tidy = true;
					ctx.save();
				};
				// The row sits above the first section; the targets are found when a chip is clicked.
				createSectionNav(
					content,
					journalSections(items, startOfDay(), searching).map((section) => ({
						...SECTION_LOOKS[section.id],
						id: section.id,
						count: section.count,
						target: () => content.querySelector<HTMLElement>(`[data-section="${section.id}"]`),
						open: section.id === "tidy" ? openTidy : undefined,
					})),
				);
				if (searching) {
					const groups = groupByDue(items, startOfDay());
					const reviews = groups.undated.length + groups.overdue.length + groups.week.length + groups.upcoming.length;
					if (reviews + tidy.total === 0) {
						createNoMatch(content, search.query);
						return;
					}
					if (reviews > 0) createSectionHeader(content, "Reviews");
					if (reviews > 0) renderReviews(content.createDiv({ cls: "vaultmate-hub-section" }), items);
				} else {
					createSectionHeader(content, "Reviews");
					renderReviews(content.createDiv({ cls: "vaultmate-hub-section" }), items);
				}
				let showClosed: (() => void) | null = null;
				if (tidy.total > 0) {
					const section = content.createDiv({ cls: "vaultmate-hub-section", attr: { "data-section": "tidy" } });
					const disclosure = createDisclosure(section, {
						label: `Tidy up · ${tidy.total} ${tidy.total === 1 ? "item" : "items"}`,
						open: ctx.state.tidy,
						onToggle: (open) => {
							ctx.state.tidy = open;
							ctx.save();
						},
					});
					tidyDisclosure = disclosure;
					const closed = renderClosed(disclosure.body, items);
					if (closed) {
						showClosed = () => {
							openTidy();
							closed.scrollIntoView({ block: "start" });
						};
					}
				}
				if (searching) return; // statistics, not rows: hidden while searching
				createSectionHeader(content, "Track record").dataset.section = "record";
				renderTrackRecord(content.createDiv({ cls: "vaultmate-hub-section" }), items, ctx.state.kind, showClosed);
			};
			renderContent();
		},
	};
}
