// The `obsidian://vaultmate-idea` link sent by the VaultMate Android app (see README, "Idea link"). Pure.
//
//   obsidian://vaultmate-idea?vault=<name>&file=<vault-relative path, .md optional>&line=<0-based line index>
import { classifyIdeaLine } from "./idea-line";
import { isOpenIdea } from "./ideas-model";

/** How far from the given line the nearest open idea is looked for when the note changed. */
export const LINE_TOLERANCE = 3;

export interface IdeaLinkTarget {
	/** Vault-relative path with forward slashes, no leading or trailing slash; `.md` as given. */
	file: string;
	/** 0-based line index. */
	line: number;
}

/** Checks the link parameters. Null when the file is missing, escapes the vault, or the line is not a non-negative integer. */
export function parseIdeaLink(params: Readonly<Record<string, string | undefined>>): IdeaLinkTarget | null {
	const rawFile = params.file;
	const rawLine = params.line;
	if (rawFile === undefined || rawLine === undefined || !/^\d{1,9}$/.test(rawLine)) return null;
	const parts = rawFile.replace(/\\/g, "/").split("/").map((part) => part.trim()).filter((part) => part !== "" && part !== ".");
	if (parts.length === 0 || parts.includes("..") || parts.some((part) => Array.from(part).some((char) => char.charCodeAt(0) < 32))) return null;
	const file = parts.join("/");
	if (file.toLowerCase() === ".md") return null;
	return { file, line: Number(rawLine) };
}

/** The vault paths to try for a link's file: as given, then with `.md` appended when it lacks it. */
export function noteCandidates(file: string): string[] {
	return /\.md$/i.test(file) ? [file] : [file, `${file}.md`];
}

export type IdeaLineResolution =
	| { kind: "open"; line: number }
	| { kind: "processed" }
	| { kind: "none" };

/**
 * Which idea the link means: the given line when it is an open idea, "processed" when it is a processed
 * one, else the nearest open idea within `LINE_TOLERANCE` lines (the note changed since the app read it;
 * on a tie the earlier line wins), else "none".
 */
export function resolveIdeaLine(lines: readonly string[], line: number, tag: string): IdeaLineResolution {
	const at = (index: number) => {
		const idea = index >= 0 && index < lines.length ? classifyIdeaLine(lines[index] ?? "", tag) : null;
		return idea?.type === "task" || idea?.type === "plain" ? idea : null;
	};
	const exact = at(line);
	if (exact) return isOpenIdea(exact) ? { kind: "open", line } : { kind: "processed" };
	for (let distance = 1; distance <= LINE_TOLERANCE; distance++) {
		for (const index of [line - distance, line + distance]) {
			const idea = at(index);
			if (idea && isOpenIdea(idea)) return { kind: "open", line: index };
		}
	}
	return { kind: "none" };
}
