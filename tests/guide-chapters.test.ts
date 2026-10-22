import { describe, expect, it } from "vitest";

import { CHAPTERS, chapterNumber, neighbours } from "../src/ui/guide/chapters";

describe("chapters of the book", () => {
	it("are 8, in reading order, with unique ids", () => {
		expect(CHAPTERS.map((chapter) => chapter.id)).toEqual(["home", "ideas", "projects", "project", "journal", "connections", "ai-actions", "places"]);
		expect(new Set(CHAPTERS.map((chapter) => chapter.id)).size).toBe(8);
		expect(CHAPTERS.map((chapter) => chapter.title)).toEqual([
			"Prologue: a book begins",
			"Sparks",
			"The book becomes a project",
			"The storm, from spark to done",
			"Judging your bets",
			"Threads",
			"A second reader",
			"Epilogue: where the story lives",
		]);
	});

	it("numbers a chapter from 1, and 0 for an unknown id", () => {
		expect(chapterNumber("home")).toBe(1);
		expect(chapterNumber("project")).toBe(4);
		expect(chapterNumber("nothing")).toBe(0);
	});

	it("finds the chapters around one, null at either end", () => {
		expect(neighbours("projects")).toMatchObject({ previous: { id: "ideas" }, next: { id: "project" } });
		expect(neighbours("home").previous).toBeNull();
		expect(neighbours("places").next).toBeNull();
	});

	it("shares the Projects page between the dashboard and a project's page", () => {
		const pages = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, chapter.pageId]));
		expect(pages.projects).toBe("projects");
		expect(pages.project).toBe("projects");
		expect(pages.home).toBeNull();
	});
});
