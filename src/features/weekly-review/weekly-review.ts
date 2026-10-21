// The weekly review: chains the existing windows (due reviews, Tend fresh ideas, a track without a next task).
// This file holds the run over a host and the summary; it imports nothing from Obsidian, so it is unit-tested.
// A step with nothing to do (or a module that is off) reports zero and is skipped silently.

export interface WeeklyResult {
	reviews: number;
	ideas: number;
	/** Tracks without a next task, over all the projects. */
	tracks: number;
	/** Projects with such a track besides the one the hub opened on. */
	otherProjects: number;
	stopped: boolean;
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** "Weekly review: 3 reviews done, 4 ideas sorted, 1 track needs a next task." */
export function weeklySummary(result: WeeklyResult): string {
	const parts: string[] = [];
	if (result.reviews > 0) parts.push(plural(result.reviews, "review", "reviews") + " done");
	if (result.ideas > 0) parts.push(plural(result.ideas, "idea", "ideas") + " sorted");
	if (result.tracks > 0) parts.push(`${result.tracks} ${result.tracks === 1 ? "track needs" : "tracks need"} a next task`);
	const head = result.stopped ? "Weekly review stopped" : "Weekly review";
	if (parts.length === 0) return result.stopped ? `${head}.` : `${head}: nothing to do this week.`;
	const more = result.otherProjects > 0 ? `. ${plural(result.otherProjects, "other project has", "other projects have")} one too.` : ".";
	return `${head}: ${parts.join(", ")}${more}`;
}

export interface WeeklyHost<R> {
	/** The reviews due now, oldest first; empty when the module is off. */
	dueReviews(): R[];
	/** The item as it is now in its note (its line may have moved), or null when it is gone. */
	relocate(review: R): Promise<R | null>;
	/** Opens the review window; `closed` gets "done" when something was written, else "cancel". */
	review(review: R, closed: (result: "done" | "cancel") => void): void;
	/** The number of fresh ideas to tend; zero when the module is off. */
	freshIdeas(): number;
	/** Opens Tend mode over the fresh ideas; `closed` gets how many were sorted and whether the whole queue was gone through. */
	tend(closed: (sorted: number, completed: boolean) => void): void;
	/** The projects with an In progress track without an open task; empty when the module is off. */
	projectsToFix(): Promise<{ projects: number; tracks: number }>;
	/** Opens the hub on the first of those projects. */
	showFirstProject(): Promise<void>;
}

/** Runs the steps one after the other; closing a window without writing stops the whole session. */
export async function runWeeklyReview<R>(host: WeeklyHost<R>): Promise<WeeklyResult> {
	const result: WeeklyResult = { reviews: 0, ideas: 0, tracks: 0, otherProjects: 0, stopped: false };
	const due = host.dueReviews();
	for (const review of due) {
		const current = await host.relocate(review);
		if (!current) continue;
		const closed = await new Promise<"done" | "cancel">((resolve) => host.review(current, resolve));
		if (closed === "cancel") {
			result.stopped = true;
			return result;
		}
		result.reviews++;
	}
	if (host.freshIdeas() > 0) {
		const { sorted, completed } = await new Promise<{ sorted: number; completed: boolean }>((resolve) => host.tend((count, done) => resolve({ sorted: count, completed: done })));
		result.ideas = sorted;
		if (!completed) {
			result.stopped = true;
			return result;
		}
	}
	const fix = await host.projectsToFix();
	if (fix.projects > 0) {
		result.tracks = fix.tracks;
		result.otherProjects = fix.projects - 1;
		await host.showFirstProject();
	}
	return result;
}
