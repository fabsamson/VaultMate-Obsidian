import { describe, expect, it } from "vitest";

import { buildMessages, collectSources } from "../src/features/ai-actions/request";
import { parseAction } from "../src/features/ai-actions/definition";
import { SOURCE_CAPS } from "../src/features/ai-actions/sources";
import { GOAL_CAP, goalText, openTrackChoices, trackSource } from "../src/features/ai-actions/track-source";

const NOTE = [
	"---",
	"tags: [project]",
	"---",
	"# \u{1F3AF} Objectif",
	"Build a [[small greenhouse]] by spring.",
	"```",
	"secret code",
	"```",
	"",
	"# \u{1F9ED} Tracks",
	"## ★ Idea shelf",
	"Some prose.",
	"## \u{1F528} Frame",
	"Wood is bought.",
	"- [ ] cut the beams ➕ 2026-10-01",
	"    - [x] measure first",
	"",
	"## \u{1F4E5} Roof",
	"## ✅ Foundations",
	"- [x] dig",
	"## \u{1F5D1}️ Pond",
	"# Notes",
	"Elsewhere.",
];

function idOf(title: string): string {
	return String(NOTE.findIndex((line) => line.endsWith(title)));
}

describe("openTrackChoices", () => {
	it("lists the open tracks in note order, identified by their heading line", () => {
		expect(openTrackChoices(NOTE)).toEqual([
			{ id: idOf("Idea shelf"), label: "Idea shelf" },
			{ id: idOf("Frame"), label: "Frame" },
			{ id: idOf("Roof"), label: "Roof" },
		]);
	});

	it("is empty for a note without tracks", () => {
		expect(openTrackChoices(["# Notes", "text"])).toEqual([]);
	});
});

describe("goalText", () => {
	it("reads the Goal or Objectif section, links as text and without code", () => {
		expect(goalText(NOTE)).toBe("Build a small greenhouse by spring.");
		expect(goalText(["## Goals", "Ship it.", "## Other", "x"])).toBe("Ship it.");
		expect(goalText(["# Objectif", "Livrer.", "# Suite"])).toBe("Livrer.");
	});

	it("finds nothing when no heading is a goal", () => {
		expect(goalText(["# Goal Momentum", "text", "# Notes"])).toBe("");
		expect(goalText(["# Plan", "text"])).toBe("");
	});

	it("is capped", () => {
		expect(goalText(["# Goal", "g".repeat(GOAL_CAP + 500)]).length).toBe(GOAL_CAP);
	});
});

describe("trackSource", () => {
	it("sends the project, its goal, then the track with its status and block, nothing else", () => {
		const source = trackSource("Greenhouse", NOTE, idOf("Frame"));
		expect(source.text).toBe(
			[
				"Project: Greenhouse",
				"Goal:\nBuild a small greenhouse by spring.",
				"Track: Frame\nStatus: In progress",
				"Wood is bought.\n- [ ] cut the beams ➕ 2026-10-01\n    - [x] measure first",
			].join("\n\n"),
		);
		expect(source.problem).toBeUndefined();
		expect(source.text).not.toContain("Idea shelf");
		expect(source.text).not.toContain("secret code");
		expect(source.chars).toBe(source.text.length);
	});

	it("leaves the goal out when the note has none, and sends a track with an empty block", () => {
		const source = trackSource("Greenhouse", ["# Tracks", "## Roof", "# Notes"], "1");
		expect(source.text).toBe("Project: Greenhouse\n\nTrack: Roof\nStatus: Explore");
	});

	it("has a problem when no track is chosen or the line is not a track", () => {
		expect(trackSource("Greenhouse", NOTE, "").problem).toBe("Choose a track.");
		expect(trackSource("Greenhouse", NOTE, "0").problem).toBe("Choose a track.");
	});

	it("is capped", () => {
		const long = ["# Tracks", "## Roof", "x".repeat(SOURCE_CAPS.track + 1_000)];
		expect(trackSource("P", long, "1")).toMatchObject({ chars: SOURCE_CAPS.track, truncated: true });
	});
});

describe("the request of a track action", () => {
	const entry = parseAction(
		"A/Next steps.md",
		{ "vaultmate-action": 1, name: "Next steps", sources: ["track"], output: "items", count: 3, params: { track: { label: "Track", choices: "project-tracks" } } },
		"Give {{count}} steps for {{track}}.",
	);
	if (!entry.ok) throw new Error(entry.message);
	const input = { title: "Greenhouse", raw: NOTE.join("\r\n"), selection: "", frontmatter: undefined, collection: [], notInterested: {} };

	it("sends the chosen track only, labelled, with the items contract after the prompt", () => {
		const values = { track: idOf("Frame") };
		const sources = collectSources(entry.action, input, values);
		const messages = buildMessages(entry.action, sources, { track: "Frame" });
		expect(sources).toHaveLength(1);
		expect(messages.user).toBe(`### Track\n${trackSource("Greenhouse", NOTE, idOf("Frame")).text}`);
		expect(messages.system.startsWith("Give 3 steps for Frame.")).toBe(true);
		expect(messages.system).toContain('{"items":["..."]}');
	});

	it("has a problem until a track is chosen", () => {
		expect(collectSources(entry.action, input, {})[0]?.problem).toBe("Choose a track.");
	});
});
