// Test-only: turns Markdown files into the inputs of the context engine, without Obsidian. Links are
// resolved by file name (like Obsidian does for short links), tags come from the frontmatter and the
// text, and the frontmatter is read by a small parser that handles scalars, inline lists and block lists.
/// <reference types="vite/client" />
import { buildNoteMeta, isExcluded, type MetaOptions, type NoteMeta } from "../../src/features/context/note-meta";
import { makeDoc, TextIndex } from "../../src/features/context/text-index";
import { tokenize } from "../../src/features/context/tokenizer";

export const FIXTURE_OPTIONS: MetaOptions = { peopleProperties: ["author", "people", "place"], latitudeProperty: "latitude", longitudeProperty: "longitude" };

export interface TestVault {
	notes: Map<string, NoteMeta>;
	text: TextIndex;
	texts: Map<string, string>;
	readText: (path: string) => Promise<string>;
	/** Path of the note whose file name is `title`. */
	pathOf: (title: string) => string;
}

function scalar(raw: string): string {
	return raw.trim().replace(/^(["'])(.*)\1$/, "$2");
}

export function parseFrontmatter(markdown: string): Record<string, unknown> {
	const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
	const result: Record<string, unknown> = {};
	if (!match) return result;
	let list: string[] | null = null;
	for (const line of (match[1] ?? "").split(/\r?\n/)) {
		const item = /^\s+-\s+(.*)$/.exec(line);
		if (item && list) {
			list.push(scalar(item[1] ?? ""));
			continue;
		}
		const pair = /^([\w-]+):\s*(.*)$/.exec(line);
		list = null;
		if (!pair) continue;
		const [, key = "", value = ""] = pair;
		if (value === "") result[key] = list = [];
		else if (value.startsWith("[") && value.endsWith("]")) result[key] = value.slice(1, -1).split(",").map(scalar).filter((entry) => entry !== "");
		else result[key] = scalar(value);
	}
	return result;
}

function stripCode(markdown: string): string {
	return markdown.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
}

function linkTargets(markdown: string): string[] {
	return [...stripCode(markdown).matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((match) => (match[1] ?? "").trim());
}

function inlineTags(markdown: string): string[] {
	const body = stripCode(markdown.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, ""));
	return [...body.matchAll(/(?:^|\s)#([\p{L}][\p{L}\p{N}_/-]*)/gu)].map((match) => match[1] ?? "");
}

function frontmatterTags(frontmatter: Record<string, unknown>): string[] {
	const value = frontmatter.tags ?? frontmatter.tag;
	if (Array.isArray(value)) return value.map(String);
	return typeof value === "string" ? value.split(/[,\s]+/).filter((tag) => tag !== "") : [];
}

/** `files` maps a vault path (`Folder/Name.md`) to its Markdown. Excluded folders are left out, like the real index does. */
export function buildVault(files: ReadonlyMap<string, string>, options: { excludedFolders?: readonly string[]; meta?: MetaOptions } = {}): TestVault {
	const paths = [...files.keys()].filter((path) => !isExcluded(path, options.excludedFolders ?? [])).sort();
	const byName = new Map<string, string>();
	for (const path of paths) {
		const name = (path.split("/").pop() ?? path).replace(/\.md$/i, "").toLowerCase();
		if (!byName.has(name)) byName.set(name, path);
	}
	const resolve = (target: string): string | undefined => {
		if (!target.includes("/")) return byName.get(target.toLowerCase());
		const wanted = `${target.replace(/\.md$/i, "")}.md`.toLowerCase();
		return paths.find((path) => path.toLowerCase() === wanted || path.toLowerCase().endsWith(`/${wanted}`));
	};

	const notes = new Map<string, NoteMeta>();
	const texts = new Map<string, string>();
	const text = new TextIndex();
	for (const path of paths) {
		const markdown = files.get(path) ?? "";
		const frontmatter = parseFrontmatter(markdown);
		const links = linkTargets(markdown).flatMap((target) => resolve(target) ?? []);
		const tags = [...frontmatterTags(frontmatter), ...inlineTags(markdown)];
		const meta = buildNoteMeta({ path, links, tags, frontmatter }, options.meta ?? FIXTURE_OPTIONS);
		notes.set(path, meta);
		texts.set(path, markdown);
		text.put(path, makeDoc(markdown, 1), tokenize(meta.title));
	}
	return {
		notes,
		text,
		texts,
		readText: (path) => Promise.resolve(texts.get(path) ?? ""),
		pathOf: (title) => {
			const path = byName.get(title.toLowerCase());
			if (!path) throw new Error(`No note named ${title}`);
			return path;
		},
	};
}

const CORPUS_PREFIX = "../fixtures/connections/";
const CORPUS = import.meta.glob<string>("../fixtures/connections/**/*", { query: "?raw", import: "default", eager: true });

/** The synthetic evaluation corpus (`tests/fixtures/connections`): Markdown files by vault path, and the expectations. */
export function loadCorpus(): { files: Map<string, string>; expected: string } {
	const files = new Map<string, string>();
	for (const [key, content] of Object.entries(CORPUS)) if (key.endsWith(".md")) files.set(key.slice(CORPUS_PREFIX.length), content);
	return { files, expected: CORPUS[`${CORPUS_PREFIX}expected.json`] ?? "{}" };
}
