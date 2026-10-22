// The guides are the chapters of one book: a novel about a lighthouse keeper, from a first note to the launch.
// Pure data, so the order and the navigation are tested without Obsidian.

export interface Chapter {
	/** The id of the guide (see `registry.ts`), stable. */
	id: string;
	title: string;
	/** The page of the panel the chapter explains, as a name. */
	page: string;
	/** The hub page the "Open this page" button goes to; null for the landing page. */
	pageId: string | null;
}

/** In reading order. */
export const CHAPTERS: readonly Chapter[] = [
	{ id: "home", title: "Prologue: a book begins", page: "Home", pageId: null },
	{ id: "ideas", title: "Sparks", page: "Ideas", pageId: "ideas" },
	{ id: "projects", title: "The book becomes a project", page: "Projects", pageId: "projects" },
	{ id: "project", title: "The storm, from spark to done", page: "A project's page", pageId: "projects" },
	{ id: "journal", title: "Judging your bets", page: "Decisions and predictions", pageId: "journal" },
	{ id: "connections", title: "Threads", page: "New connections", pageId: "connections" },
	{ id: "ai-actions", title: "A second reader", page: "AI actions", pageId: "ai-actions" },
	{ id: "places", title: "Epilogue: where the story lives", page: "Places", pageId: "places" },
];

/** The chapter number, from 1, or 0 for an id that is not a chapter. */
export function chapterNumber(id: string): number {
	return CHAPTERS.findIndex((chapter) => chapter.id === id) + 1;
}

/** The chapters before and after `id`, or null at either end. */
export function neighbours(id: string): { previous: Chapter | null; next: Chapter | null } {
	const index = CHAPTERS.findIndex((chapter) => chapter.id === id);
	return { previous: CHAPTERS[index - 1] ?? null, next: CHAPTERS[index + 1] ?? null };
}
