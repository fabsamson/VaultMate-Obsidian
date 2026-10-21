// What the idea portal offers and what each panel says, decided without the DOM. Pure: no Obsidian
// import, so Vitest tests it. The portal is action first: a row of actions, then only the panel of the
// action that was chosen (plan §13, F).
import { trackFormState } from "../projects/track-form";
import type { TrackStatus } from "../projects/project-note";
import { baseName } from "../context/note-meta";

export type PortalAction = "add" | "new-note" | "track" | "decision" | "prediction" | "seed" | "drop" | "skip";

export const ACTION_LABELS: Record<PortalAction, string> = {
	add: "Add to a note",
	"new-note": "New note",
	track: "New track",
	decision: "Decision",
	prediction: "Prediction",
	seed: "Project seed",
	drop: "Drop",
	skip: "Skip",
};

export interface PortalContext {
	/** Tend mode: Skip is offered. */
	tend: boolean;
	projectsEnabled: boolean;
	/** The project seed sub-tag; empty hides Project seed. */
	seedSubtag: string;
}

/** The actions of the portal, in one fixed order (no learned order): New track needs the Projects feature, Project seed its setting, Skip Tend mode. */
export function portalActions(context: PortalContext): PortalAction[] {
	const all: PortalAction[] = ["new-note", "track", "drop", "add", "decision", "prediction", "seed", "skip"];
	return all.filter((action) => (action !== "track" || context.projectsEnabled) && (action !== "seed" || context.seedSubtag !== "") && (action !== "skip" || context.tend));
}

/** Decision and Prediction open the journal form and Skip moves on: none shows a panel. */
export function hasPanel(action: PortalAction): boolean {
	return action !== "decision" && action !== "prediction" && action !== "skip";
}

/** The link that reveals the optional note, or null when the action has no note. */
export function noteLinkLabel(action: PortalAction): string | null {
	if (action === "add" || action === "new-note") return "Add a note";
	return action === "drop" ? "Add a reason" : null;
}

export interface ButtonState {
	label: string;
	disabled: boolean;
	hint: string;
}

/** Add to a note: `note` is the existing note the typed name points to (not the idea's own note, which is `own`), or null. */
export function addState(typed: string, note: { basename: string; own: boolean } | null): ButtonState {
	if (note?.own) return { label: "Add to a note", disabled: true, hint: "Pick another note: the idea is already in this one." };
	if (note) return { label: `Add to ${note.basename}`, disabled: false, hint: "" };
	return { label: "Add to a note", disabled: true, hint: typed.trim() === "" ? "" : "No note with this name: use New note" };
}

/** New note: `path` is where the note would be created (null for an empty name); `exists` when a note has that name. */
export function newNoteState(path: string | null, exists: boolean): ButtonState {
	if (path === null) return { label: "Create note", disabled: true, hint: "" };
	const folder = path.slice(0, Math.max(0, path.lastIndexOf("/")));
	const hint = exists ? "This note exists: the idea will be added to it" : `In ${folder === "" ? "the vault root" : folder}`;
	return { label: `Create "${baseName(path)}"`, disabled: false, hint };
}

export interface ProjectChoice {
	path: string;
	name: string;
}

/** The project note a typed name means: its path (with or without .md) or its name, ignoring case. */
export function findProject(projects: readonly ProjectChoice[], typed: string): ProjectChoice | null {
	const text = typed.trim().toLowerCase();
	if (text === "") return null;
	return projects.find((project) => project.path.toLowerCase() === text || project.path.toLowerCase() === `${text}.md`) ?? projects.find((project) => project.name.toLowerCase() === text) ?? null;
}

export interface TrackButtonState extends ButtonState {
	name: string;
	duplicate: boolean;
	showTask: boolean;
}

/** New track: needs a project and a short name; a name the project already has only warns. */
export function trackState(project: ProjectChoice | null, typedName: string, status: TrackStatus, existingTitles: readonly string[]): TrackButtonState {
	const form = trackFormState(typedName, status, existingTitles);
	return {
		label: project ? `Add track to ${project.name}` : "Add track",
		disabled: project === null || !form.valid,
		hint: project === null ? "Pick a project note" : "",
		name: form.name,
		duplicate: form.duplicate,
		showTask: form.showTask,
	};
}

/** The sentence of the Project seed panel. */
export function seedSentence(tag: string, subtag: string): string {
	return `Moves it to the launch pad as #${tag.replace(/^#/, "")}/${subtag}.`;
}

/** The notice at the end of Tend: everything sorted, or how many were sorted and how many stay fresh. */
export function tendSummary(sorted: number, total: number): string {
	const skipped = total - sorted;
	if (skipped <= 0) return "All fresh ideas tended.";
	if (sorted === 0) return `No idea sorted: ${skipped} skipped, they stay fresh.`;
	return `${sorted} ${sorted === 1 ? "idea" : "ideas"} sorted, ${skipped} skipped: they stay fresh.`;
}
