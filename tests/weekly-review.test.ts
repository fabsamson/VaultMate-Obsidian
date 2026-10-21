import { describe, expect, it } from "vitest";

import { dueItems } from "../src/features/journal/journal-line";
import { parseJournalLine, type JournalTags } from "../src/features/journal/journal-line";
import { runWeeklyReview, weeklySummary, type WeeklyHost, type WeeklyResult } from "../src/features/weekly-review/weekly-review";

const TAGS: JournalTags = { decisionTag: "decision", predictionTag: "prediction" };
const TODAY = new Date(2026, 9, 21);

function item(due: string, status = " ") {
	const entry = parseJournalLine(`- [${status}] Pick it #decision 📅 ${due}`, TAGS);
	if (!entry) throw new Error("not an entry");
	return { entry, due };
}

describe("dueItems", () => {
	it("keeps open entries due today or earlier, oldest first", () => {
		const items = [item("2026-10-21"), item("2026-10-22"), item("2026-10-10"), item("2026-10-01", "x")];
		expect(dueItems(items, TODAY).map((i) => i.due)).toEqual(["2026-10-10", "2026-10-21"]);
	});
});

const result = (over: Partial<WeeklyResult>): WeeklyResult => ({ reviews: 0, ideas: 0, tracks: 0, otherProjects: 0, stopped: false, ...over });

describe("weeklySummary", () => {
	it("lists what was done", () => {
		expect(weeklySummary(result({ reviews: 3, ideas: 4, tracks: 1 }))).toBe("Weekly review: 3 reviews done, 4 ideas sorted, 1 track needs a next task.");
	});
	it("uses singular and plural forms and mentions the other projects", () => {
		expect(weeklySummary(result({ reviews: 1, tracks: 3, otherProjects: 2 }))).toBe("Weekly review: 1 review done, 3 tracks need a next task. 2 other projects have one too.");
		expect(weeklySummary(result({ ideas: 1, tracks: 1, otherProjects: 1 }))).toBe("Weekly review: 1 idea sorted, 1 track needs a next task. 1 other project has one too.");
	});
	it("says when there was nothing, and when the session was stopped", () => {
		expect(weeklySummary(result({}))).toBe("Weekly review: nothing to do this week.");
		expect(weeklySummary(result({ reviews: 2, stopped: true }))).toBe("Weekly review stopped: 2 reviews done.");
		expect(weeklySummary(result({ stopped: true }))).toBe("Weekly review stopped.");
	});
});

interface Fake {
	host: WeeklyHost<string>;
	log: string[];
}

function fake(opts: { reviews?: string[]; answers?: ("done" | "cancel")[]; ideas?: number; tend?: [number, boolean]; fix?: { projects: number; tracks: number }; gone?: string[] }): Fake {
	const log: string[] = [];
	const answers = [...(opts.answers ?? [])];
	const host: WeeklyHost<string> = {
		dueReviews: () => opts.reviews ?? [],
		relocate: (r) => Promise.resolve(opts.gone?.includes(r) ? null : r),
		review: (r, closed) => {
			log.push(`review ${r}`);
			closed(answers.shift() ?? "done");
		},
		freshIdeas: () => opts.ideas ?? 0,
		tend: (closed) => {
			log.push("tend");
			closed(...(opts.tend ?? [0, true]));
		},
		projectsToFix: () => Promise.resolve(opts.fix ?? { projects: 0, tracks: 0 }),
		showFirstProject: () => {
			log.push("project");
			return Promise.resolve();
		},
	};
	return { host, log };
}

describe("runWeeklyReview", () => {
	it("chains reviews, ideas and the project page", async () => {
		const { host, log } = fake({ reviews: ["a", "b"], ideas: 3, tend: [3, true], fix: { projects: 2, tracks: 3 } });
		expect(await runWeeklyReview(host)).toEqual({ reviews: 2, ideas: 3, tracks: 3, otherProjects: 1, stopped: false });
		expect(log).toEqual(["review a", "review b", "tend", "project"]);
	});

	it("skips empty steps silently", async () => {
		const { host, log } = fake({});
		expect(await runWeeklyReview(host)).toEqual(result({}));
		expect(log).toEqual([]);
	});

	it("stops everything when a review window is closed without writing", async () => {
		const { host, log } = fake({ reviews: ["a", "b", "c"], answers: ["done", "cancel"], ideas: 2, fix: { projects: 1, tracks: 1 } });
		expect(await runWeeklyReview(host)).toEqual(result({ reviews: 1, stopped: true }));
		expect(log).toEqual(["review a", "review b"]);
	});

	it("stops when Tend mode is left before its end, keeping the ideas sorted", async () => {
		const { host, log } = fake({ ideas: 5, tend: [2, false], fix: { projects: 1, tracks: 1 } });
		expect(await runWeeklyReview(host)).toEqual(result({ ideas: 2, stopped: true }));
		expect(log).toEqual(["tend"]);
	});

	it("skips an entry that is gone from its note", async () => {
		const { host, log } = fake({ reviews: ["a", "b"], gone: ["a"] });
		expect((await runWeeklyReview(host)).reviews).toBe(1);
		expect(log).toEqual(["review b"]);
	});
});
