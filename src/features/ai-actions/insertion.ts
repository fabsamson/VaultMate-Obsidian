// Where and how the chosen questions are written into a note. Pure planning: the plan is a splice of
// the note's lines, applied through the Editor or Vault.process by the caller.

export interface InsertPlan {
	/** Index of the first line to replace, or of the line to insert before (may equal the line count). */
	at: number;
	/** Lines replaced starting at `at`; 0 for a pure insertion. */
	remove: number;
	lines: string[];
}

/** One line from the template; every `{{text}}` is replaced. */
export function renderLine(template: string, text: string): string {
	return template.replaceAll("{{text}}", text);
}

export function applyPlan(lines: string[], plan: InsertPlan): string[] {
	const next = [...lines];
	next.splice(plan.at, plan.remove, ...plan.lines);
	return next;
}

interface Heading {
	line: number;
	level: number;
	text: string;
}

/** Headings outside the frontmatter and outside fenced code. */
function findHeadings(lines: string[]): Heading[] {
	const headings: Heading[] = [];
	let i = 0;
	if (lines[0]?.trim() === "---") {
		const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
		if (end > 0) i = end + 1;
	}
	let fence: { char: string; length: number } | null = null;
	for (; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
		if (fence) {
			if (marker && marker.charAt(0) === fence.char && marker.length >= fence.length && /^\s*(`{3,}|~{3,})\s*$/.test(line)) fence = null;
			continue;
		}
		if (marker) {
			fence = { char: marker.charAt(0), length: marker.length };
			continue;
		}
		const heading = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
		if (heading) headings.push({ line: i, level: heading[1]?.length ?? 1, text: (heading[2] ?? "").trim() });
	}
	return headings;
}

function lastNonBlank(lines: string[], from: number, to: number): number {
	for (let i = to - 1; i >= from; i--) if ((lines[i] ?? "").trim() !== "") return i;
	return from - 1;
}

/** Rendered lines that are not already in `existing` (compared trimmed) and not repeated among themselves. */
function newLines(rendered: string[], existing: string[]): string[] {
	const seen = new Set(existing.map((line) => line.trim()));
	const fresh: string[] = [];
	for (const line of rendered) {
		if (seen.has(line.trim())) continue;
		seen.add(line.trim());
		fresh.push(line);
	}
	return fresh;
}

/**
 * Inserts at the end of the first section whose heading text matches (any level, case-insensitive), or
 * appends a new `## <heading>` section at the end of the note. Null when every line is already there.
 */
export function planHeadingInsert(lines: string[], heading: string, rendered: string[]): InsertPlan | null {
	const wanted = heading.trim().toLowerCase();
	const headings = findHeadings(lines);
	const index = headings.findIndex((candidate) => candidate.text.toLowerCase() === wanted);
	const found = headings[index];
	if (found) {
		const next = headings.slice(index + 1).find((candidate) => candidate.level <= found.level);
		const end = next ? next.line : lines.length;
		const fresh = newLines(rendered, lines.slice(found.line + 1, end));
		if (fresh.length === 0) return null;
		return { at: lastNonBlank(lines, found.line + 1, end) + 1, remove: 0, lines: fresh };
	}
	const fresh = newLines(rendered, []);
	if (fresh.length === 0) return null;
	const at = lastNonBlank(lines, 0, lines.length) + 1;
	return { at, remove: 0, lines: [...(at > 0 ? [""] : []), `## ${heading.trim()}`, ...fresh] };
}

/** Inserts after the cursor's line, or in its place when that line is empty. Null when every line is already in the note. */
export function planCursorInsert(lines: string[], cursorLine: number, rendered: string[]): InsertPlan | null {
	const fresh = newLines(rendered, lines);
	if (fresh.length === 0) return null;
	const line = Math.min(Math.max(cursorLine, 0), Math.max(lines.length - 1, 0));
	const empty = (lines[line] ?? "").trim() === "";
	return empty ? { at: line, remove: lines.length === 0 ? 0 : 1, lines: fresh } : { at: line + 1, remove: 0, lines: fresh };
}
