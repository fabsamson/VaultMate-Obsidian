// The `obsidian://vaultmate-review` link sent by the VaultMate Android app (see README, "Review link"). Pure.
//
//   obsidian://vaultmate-review?vault=<name>&file=<vault-relative path, .md optional>&line=<0-based line index>
//
// The parameters are those of the idea link: see `parseIdeaLink` and `noteCandidates`.
import { LINE_TOLERANCE } from "../ideas/idea-link";
import { classifyLine, closedWithoutReview, type JournalEntry, type JournalTags } from "./journal-line";

export type ReviewLineResolution =
	/** An open entry: the review form. */
	| { kind: "open"; line: number }
	/** A done entry without its outcome: the "Add the outcome" form. */
	| { kind: "late"; line: number }
	/** The entry on the given line is reviewed or cancelled. */
	| { kind: "reviewed" }
	| { kind: "none" };

/**
 * Which entry the link means: the given line when it is an entry, else the nearest entry within
 * `LINE_TOLERANCE` lines that still needs a review or an outcome (the note changed since the app read it;
 * on a tie the earlier line wins), else "none".
 */
export function resolveReviewLine(lines: readonly string[], line: number, tags: JournalTags): ReviewLineResolution {
	const at = (index: number): JournalEntry | null => {
		const cls = index >= 0 && index < lines.length ? classifyLine(lines[index] ?? "", tags) : null;
		return cls?.type === "entry" ? cls.entry : null;
	};
	const actionable = (index: number): ReviewLineResolution | null => {
		const entry = at(index);
		if (!entry) return null;
		if (entry.status === "open") return { kind: "open", line: index };
		return closedWithoutReview(entry) ? { kind: "late", line: index } : null;
	};
	if (at(line)) return actionable(line) ?? { kind: "reviewed" };
	for (let distance = 1; distance <= LINE_TOLERANCE; distance++) {
		for (const index of [line - distance, line + distance]) {
			const found = actionable(index);
			if (found) return found;
		}
	}
	return { kind: "none" };
}
