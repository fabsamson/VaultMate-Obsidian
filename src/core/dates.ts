// Local calendar dates. A date is a `Date` at local midnight; its text form is `YYYY-MM-DD` in local
// time (never `toISOString`, which is UTC and shifts the day in the evening or early morning).

export const REVIEW_INTERVALS = ["1w", "1m", "3m", "6m", "1y"] as const;
export type ReviewInterval = (typeof REVIEW_INTERVALS)[number];

export const INTERVAL_LABELS: Record<ReviewInterval, string> = {
	"1w": "1 week",
	"1m": "1 month",
	"3m": "3 months",
	"6m": "6 months",
	"1y": "1 year",
};

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` in local time. */
export function formatDate(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Local midnight of a real calendar date, or null when the text is not `YYYY-MM-DD` or the day does not exist. */
export function parseDate(text: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(year, month - 1, day);
	date.setFullYear(year); // the constructor maps years 0 to 99 to 1900 to 1999
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** Local midnight of the given moment (default: now). */
export function startOfDay(date: Date = new Date()): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Adds an interval; months and years are clamped to the end of the target month (Jan 31 + 1m = Feb 28 or 29). */
export function addInterval(date: Date, interval: ReviewInterval): Date {
	if (interval === "1w") return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
	const months = interval === "1y" ? 12 : Number(interval.slice(0, -1));
	const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
	const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
	return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier); a DST change never makes a day 23 or 25 hours long. */
export function daysBetween(from: Date, to: Date): number {
	const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
	const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
	return Math.round((end - start) / DAY_MS);
}

function plural(count: number, unit: string): string {
	return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** A positive number of days as "5 days", "3 weeks", "3 months" or "1 year". */
function spanLabel(days: number): string {
	if (days < 14) return plural(days, "day");
	if (days < 28) return plural(Math.floor(days / 7), "week");
	if (days < 365) return plural(Math.max(1, Math.round(days / 30.4375)), "month");
	return plural(Math.max(1, Math.floor(days / 365.25)), "year");
}

/** Compact relative label of a due date: "today", "tomorrow", "in 5 days", "in 2 weeks", "in 3 months", "3 days overdue". */
export function dueLabel(due: Date, today: Date): string {
	const days = daysBetween(today, due);
	if (days === 0) return "today";
	if (days === 1) return "tomorrow";
	return days > 0 ? `in ${spanLabel(days)}` : `${spanLabel(-days)} overdue`;
}
