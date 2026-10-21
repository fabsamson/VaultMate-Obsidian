// The sections of the "Decisions and predictions" page, for its navigation row.
import { groupByDue, tidyUp } from "./journal-line";
import type { JournalItem } from "./journal-index";
import { computeTrackRecord } from "./track-record";

export type JournalSectionId = "untracked" | "overdue" | "week" | "upcoming" | "tidy" | "record";

/**
 * The page's sections in page order with their sizes: the review groups, Tidy up (entries closed without a review)
 * and Track record (the reviews done). `items` are the entries of one kind after the search; while `searching`,
 * the page hides the track record, so it has no size.
 */
export function journalSections(items: readonly JournalItem[], today: Date, searching: boolean): Array<{ id: JournalSectionId; count: number }> {
	const groups = groupByDue(items, today);
	return [
		{ id: "untracked", count: groups.undated.length },
		{ id: "overdue", count: groups.overdue.length },
		{ id: "week", count: groups.week.length },
		{ id: "upcoming", count: groups.upcoming.length },
		{ id: "tidy", count: tidyUp(items).total },
		{ id: "record", count: searching ? 0 : computeTrackRecord(items).reviewsDone },
	];
}
