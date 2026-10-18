import { describe, expect, it } from "vitest";

import { backUrl, dailyNotePath, wantsBack } from "../src/features/app-link/back-link";

describe("wantsBack", () => {
	it("is true only for back=app", () => {
		expect(wantsBack({ back: "app" })).toBe(true);
		expect(wantsBack({ back: "App" })).toBe(false);
		expect(wantsBack({ back: "" })).toBe(false);
		expect(wantsBack({ file: "a.md" })).toBe(false);
	});
});

describe("backUrl", () => {
	it("builds the app link", () => {
		expect(backUrl("idea", "done")).toBe("vaultmate://back?kind=idea&result=done");
		expect(backUrl("review", "cancel")).toBe("vaultmate://back?kind=review&result=cancel");
		expect(backUrl("daily", "error")).toBe("vaultmate://back?kind=daily&result=error");
	});
});

describe("dailyNotePath", () => {
	it("joins the folder and the name", () => {
		expect(dailyNotePath("Journal/Daily", "2026-10-18")).toBe("Journal/Daily/2026-10-18.md");
		expect(dailyNotePath("/Journal/", "2026-10-18")).toBe("Journal/2026-10-18.md");
	});
	it("has no folder prefix when the folder is empty or missing", () => {
		expect(dailyNotePath("", "2026-10-18")).toBe("2026-10-18.md");
		expect(dailyNotePath(undefined, "2026/10/18")).toBe("2026/10/18.md");
	});
});
