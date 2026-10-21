// The "Weekly review" command: wires the weekly run to the journal, ideas and projects features.
import { Notice } from "obsidian";

import { startOfDay } from "../../core/dates";
import type VaultMatePlugin from "../../main";
import { dueItems } from "../journal/journal-line";
import type { JournalItem } from "../journal/journal-index";
import { needsNextTask } from "../projects/projects-model";
import { PROJECTS_PAGE_ID } from "../projects/projects-page";
import { runWeeklyReview, weeklySummary, type WeeklyHost } from "./weekly-review";

/** Call from `onload`. */
export function registerWeeklyReview(plugin: VaultMatePlugin): void {
	plugin.addCommand({
		id: "weekly-review",
		name: "Weekly review",
		icon: "calendar-check",
		checkCallback: (checking) => {
			if (!plugin.journal.enabled() && !plugin.ideas.enabled() && !plugin.projects.enabled()) return false;
			if (!checking) void weeklyReview(plugin);
			return true;
		},
	});
}

async function weeklyReview(plugin: VaultMatePlugin): Promise<void> {
	const { journal, ideas, projects } = plugin;
	/** Projects with an In progress track without an open task, in the index order. */
	const toFix = async (): Promise<{ path: string; tracks: number }[]> => {
		if (!projects.enabled()) return [];
		const found: { path: string; tracks: number }[] = [];
		for (const note of projects.index.notes()) {
			if (note.tracks.progress === 0) continue;
			const content = await projects.index.read(note.path);
			const tracks = content?.model.tracks.filter(needsNextTask).length ?? 0;
			if (tracks > 0) found.push({ path: note.path, tracks });
		}
		return found;
	};
	let fix: { path: string; tracks: number }[] = [];
	const host: WeeklyHost<JournalItem> = {
		dueReviews: () => (journal.enabled() ? dueItems(journal.index.entries(), startOfDay()) : []),
		// An earlier review adds a sub-item, which moves the lines below it: find the entry again by its text.
		relocate: async (item) => {
			const file = plugin.app.vault.getFileByPath(item.path);
			if (!file) return null;
			const lines = (await plugin.app.vault.read(file)).split(/\r?\n/);
			if (lines[item.line] === item.raw) return item;
			let best = -1;
			lines.forEach((line, index) => {
				if (line === item.raw && (best < 0 || Math.abs(index - item.line) < Math.abs(best - item.line))) best = index;
			});
			return best < 0 ? null : { ...item, line: best };
		},
		review: (item, closed) => journal.openReview(item, closed),
		freshIdeas: () => (ideas.enabled() ? ideas.freshIdeas().length : 0),
		tend: (closed) => ideas.tend(undefined, closed),
		projectsToFix: async () => {
			fix = await toFix();
			return { projects: fix.length, tracks: fix.reduce((sum, project) => sum + project.tracks, 0) };
		},
		showFirstProject: () => plugin.openHub(PROJECTS_PAGE_ID, fix[0]?.path, true),
	};
	new Notice(weeklySummary(await runWeeklyReview(host)), 8000);
}
