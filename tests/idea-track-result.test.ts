import { describe, expect, it } from "vitest";

import { buildIdeaItem, classifyIdeaLine, closeIdea, IDEA_RESULTS, resultItemText, resultLinkTarget, type IdeaItem } from "../src/features/ideas/idea-line";
import { ideaBadge, itemResult, monthSummary, PROCESSED_FILTERS, processedRows, resultLabel } from "../src/features/ideas/ideas-model";
import { closeParts } from "../src/features/ideas/idea-note";

const TODAY = new Date(2026, 9, 15);

const CLOSED = "- [x] Brief du soir dans l'app #idea [result: track] ➕ 2026-10-14 ✅ 2026-10-15";
const NOTE = [CLOSED, "    - detail kept", "    - Track in [[VaultMateApp]]: Brief du soir"];

function item(lines: readonly string[]): IdeaItem {
	const found = buildIdeaItem("Inbox.md", "Inbox", "2026-10-01", 0, lines, "idea");
	if (!found) throw new Error("not an idea");
	return found;
}

describe("the track result", () => {
	it("is a known result", () => {
		expect(IDEA_RESULTS).toContain("track");
		expect(resultLabel("track")).toBe("Track");
	});

	it("writes the sub-item with the project link and the short name", () => {
		expect(resultItemText("track", "VaultMateApp", "Brief du soir")).toBe("Track in [[VaultMateApp]]: Brief du soir");
		expect(resultItemText("track", "Notes/App", "  Brief \n du soir ")).toBe("Track in [[Notes/App]]: Brief du soir");
		expect(resultItemText("track", "VaultMateApp", "")).toBe("Track in [[VaultMateApp]]");
		expect(resultItemText("track", null, "Brief du soir")).toBeNull();
	});

	it("closes the line as in the contract", () => {
		const { line, subItem } = closeParts(item(["- [ ] Brief du soir dans l'app #idea ➕ 2026-10-14"]), "idea", "track", "2026-10-15", "VaultMateApp", "Brief du soir");
		expect(line).toBe(CLOSED);
		expect(subItem).toBe("Track in [[VaultMateApp]]: Brief du soir");
		expect(closeIdea("Brief du soir dans l'app #idea", "idea", "track", "2026-10-15", "2026-10-14")).toBe(CLOSED);
	});

	it("is read back with its target, like Added to and New note", () => {
		expect(resultLinkTarget(["Track in [[VaultMateApp]]: Brief du soir"])).toBe("VaultMateApp");
		expect(resultLinkTarget(["track in [[Notes/App|the app]]: x"])).toBe("Notes/App");
		expect(resultLinkTarget(["detail", "Track in [[App#Tracks]]"])).toBe("App");
		expect(resultLinkTarget(["Track in nothing"])).toBeNull();
		const read = item(NOTE);
		expect(read.resultTarget).toBe("VaultMateApp");
		expect(read.idea).toMatchObject({ type: "task", entry: { status: "done", result: "track" } });
	});

	it("keeps the Track in link out of citations: it is a result target, which the context finder discounts", () => {
		// IdeasFeature.traceLinks counts every item's resultTarget; the finder subtracts those links.
		expect(item(NOTE).resultTarget).not.toBeNull();
		expect(item([CLOSED, "    - Track in [[A]]: x", "    - see [[B]]"]).resultTarget).toBe("A");
	});

	it("shows a badge that opens the project", () => {
		const idea = classifyIdeaLine(CLOSED, "idea");
		if (idea?.type !== "task") throw new Error("not a task");
		expect(ideaBadge(idea, TODAY, "VaultMateApp")).toEqual({ text: "Track · VaultMateApp", action: "note", label: "Open VaultMateApp. Track · VaultMateApp" });
		expect(ideaBadge(idea, TODAY, null)).toMatchObject({ text: "Track", action: "none" });
	});

	it("has a Processed filter and a place in the monthly summary", () => {
		expect(PROCESSED_FILTERS.map((filter) => filter.value)).toContain("track");
		const items = [item(NOTE), item(["- [x] Other #idea [result: dropped] ✅ 2026-10-15"])];
		expect(itemResult(item(NOTE))).toBe("track");
		expect(processedRows(items, "track")).toHaveLength(1);
		expect(monthSummary(items, TODAY)).toBe("This month: 2 planted · 1 track · 1 dropped");
		expect(monthSummary([item(NOTE), item([CLOSED])], TODAY)).toContain("2 tracks");
	});
});
