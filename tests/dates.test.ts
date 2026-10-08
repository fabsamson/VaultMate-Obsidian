import { describe, expect, it } from "vitest";

import { addInterval, daysBetween, dueLabel, formatDate, INTERVAL_LABELS, parseDate, REVIEW_INTERVALS, startOfDay, type ReviewInterval } from "../src/core/dates";

function date(text: string): Date {
	const parsed = parseDate(text);
	if (!parsed) throw new Error(`bad fixture ${text}`);
	return parsed;
}

function add(text: string, interval: ReviewInterval): string {
	return formatDate(addInterval(date(text), interval));
}

describe("formatDate and parseDate", () => {
	it("formats in local time, not UTC", () => {
		expect(formatDate(new Date(2026, 9, 9, 0, 30))).toBe("2026-10-09");
		expect(formatDate(new Date(2026, 9, 9, 23, 59))).toBe("2026-10-09");
	});

	it("round-trips real dates", () => {
		for (const text of ["2026-10-09", "2024-02-29", "2000-01-01", "2026-12-31"]) {
			expect(formatDate(date(text))).toBe(text);
		}
	});

	it("rejects text that is not a real calendar date", () => {
		for (const text of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-10-00", "2026-1-9", "26-10-09", "2026-10-09 ", "", "tomorrow"]) {
			expect(parseDate(text)).toBeNull();
		}
	});

	it("accepts February 29 only in leap years", () => {
		expect(parseDate("2024-02-29")).not.toBeNull();
		expect(parseDate("2100-02-29")).toBeNull();
	});
});

describe("startOfDay", () => {
	it("drops the time of day", () => {
		expect(formatDate(startOfDay(new Date(2026, 9, 9, 18, 45)))).toBe("2026-10-09");
		expect(startOfDay(new Date(2026, 9, 9, 18, 45)).getHours()).toBe(0);
	});
});

describe("addInterval", () => {
	it("adds one week across month and year ends", () => {
		expect(add("2026-10-09", "1w")).toBe("2026-10-16");
		expect(add("2026-10-28", "1w")).toBe("2026-11-04");
		expect(add("2026-12-29", "1w")).toBe("2027-01-05");
	});

	it("adds months", () => {
		expect(add("2026-10-09", "1m")).toBe("2026-11-09");
		expect(add("2026-10-09", "3m")).toBe("2027-01-09");
		expect(add("2026-10-09", "6m")).toBe("2027-04-09");
	});

	it("clamps to the end of the target month", () => {
		expect(add("2026-01-31", "1m")).toBe("2026-02-28");
		expect(add("2028-01-31", "1m")).toBe("2028-02-29");
		expect(add("2026-08-31", "3m")).toBe("2026-11-30");
		expect(add("2026-08-31", "6m")).toBe("2027-02-28");
	});

	it("adds one year, clamping February 29", () => {
		expect(add("2026-10-09", "1y")).toBe("2027-10-09");
		expect(add("2024-02-29", "1y")).toBe("2025-02-28");
	});

	it("does not mutate its input", () => {
		const start = date("2026-01-31");
		addInterval(start, "1m");
		expect(formatDate(start)).toBe("2026-01-31");
	});
});

describe("daysBetween", () => {
	it("counts calendar days in both directions", () => {
		expect(daysBetween(date("2026-10-09"), date("2026-10-09"))).toBe(0);
		expect(daysBetween(date("2026-10-09"), date("2026-10-14"))).toBe(5);
		expect(daysBetween(date("2026-10-14"), date("2026-10-09"))).toBe(-5);
		expect(daysBetween(date("2026-01-01"), date("2027-01-01"))).toBe(365);
	});

	it("ignores the time of day", () => {
		expect(daysBetween(new Date(2026, 9, 9, 23, 59), new Date(2026, 9, 10, 0, 1))).toBe(1);
	});

	it("is not shifted by daylight saving changes", () => {
		// Whatever the machine's time zone, spans over the spring and autumn changes stay whole days.
		expect(daysBetween(date("2026-03-01"), date("2026-04-01"))).toBe(31);
		expect(daysBetween(date("2026-10-01"), date("2026-11-15"))).toBe(45);
	});
});

describe("labels", () => {
	it("labels every interval", () => {
		expect(REVIEW_INTERVALS.map((interval) => INTERVAL_LABELS[interval])).toEqual(["1 week", "1 month", "3 months", "6 months", "1 year"]);
	});

	const today = date("2026-10-09");
	const label = (text: string): string => dueLabel(date(text), today);

	it("names today and tomorrow", () => {
		expect(label("2026-10-09")).toBe("today");
		expect(label("2026-10-10")).toBe("tomorrow");
	});

	it("counts days up to two months", () => {
		expect(label("2026-10-14")).toBe("in 5 days");
		expect(label("2026-11-08")).toBe("in 30 days");
	});

	it("switches to months and years for far dates", () => {
		expect(label("2027-01-09")).toBe("in 3 months");
		expect(label("2027-04-09")).toBe("in 6 months");
		expect(label("2027-10-09")).toBe("in 1 year");
		expect(label("2029-10-09")).toBe("in 3 years");
	});

	it("labels what is overdue", () => {
		expect(label("2026-10-08")).toBe("1 day overdue");
		expect(label("2026-10-06")).toBe("3 days overdue");
		expect(label("2026-06-09")).toBe("4 months overdue");
	});

	it("gives each interval a stable label from today", () => {
		const expected: Record<ReviewInterval, string> = { "1w": "in 7 days", "1m": "in 31 days", "3m": "in 3 months", "6m": "in 6 months", "1y": "in 1 year" };
		for (const interval of REVIEW_INTERVALS) {
			expect(dueLabel(addInterval(today, interval), today)).toBe(expected[interval]);
		}
	});
});
