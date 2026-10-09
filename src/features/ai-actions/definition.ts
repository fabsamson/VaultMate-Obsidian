// The action file format (`vaultmate-action: 1`): a Markdown file whose frontmatter configures the action
// and whose body is the prompt. Public format of the plugin; changing it breaks users' files. Pure.

/** Sources an action can use today. */
export const SOURCES = ["note", "selection", "properties", "collection-profile"] as const;
export type SourceName = (typeof SOURCES)[number];

/** Known to the plan but not built yet: the action is listed as unavailable instead of failing. */
const LATER_SOURCES = ["linked-notes", "recent-notes", "tag", "decisions"];
const LATER_OUTPUTS = ["items"];

/** Where the choices of a launch parameter come from. */
export const CHOICE_SOURCES = ["collection-types"] as const;
export type ChoiceSource = (typeof CHOICE_SOURCES)[number];

/** A value the run window asks for before the preview. `{{name}}` in the prompt becomes the chosen label. */
export interface ParamDefinition {
	name: string;
	label: string;
	choices: ChoiceSource;
}

export type InsertTarget = { type: "heading"; heading: string; line: string } | { type: "cursor"; line: string };

export interface ActionDefinition {
	/** Vault path of the action file. */
	path: string;
	name: string;
	description: string;
	icon: string;
	command: boolean;
	sources: SourceName[];
	output: "questions" | "suggestions";
	count: number;
	params: ParamDefinition[];
	/** null = show the result only. */
	insert: InsertTarget | null;
	/** The prompt, with `{{count}}` replaced (the parameters are replaced when the action runs). */
	prompt: string;
}

export type ActionEntry = { ok: true; action: ActionDefinition } | { ok: false; path: string; name: string; message: string };

export const DEFAULT_LINE = "- {{text}}";
const DEFAULT_COUNT = 5;

/** Splits `---` frontmatter from the body. `yaml` is null when the file has no frontmatter. */
export function splitFrontmatter(text: string): { yaml: string | null; body: string } {
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
	const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
	if (!match) return { yaml: null, body: text };
	return { yaml: match[1] ?? "", body: text.slice(match[0].length) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fileName(path: string): string {
	return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function invalid(path: string, name: string, message: string): ActionEntry {
	return { ok: false, path, name, message };
}

function parseInsert(value: unknown): InsertTarget | string | null {
	if (value === undefined || value === null) return null;
	if (!isRecord(value)) return "insert must have a heading or at: cursor.";
	const line = value.line === undefined ? DEFAULT_LINE : value.line;
	if (typeof line !== "string" || !line.includes("{{text}}")) return "insert.line must be a text that contains {{text}}.";
	const heading = typeof value.heading === "string" ? value.heading.trim().replace(/^#+\s*/, "") : "";
	const atCursor = value.at === "cursor";
	if (heading && atCursor) return "insert takes a heading or at: cursor, not both.";
	if (heading) return { type: "heading", heading, line };
	if (atCursor) return { type: "cursor", line };
	return "insert must have a heading or at: cursor.";
}

function parseParams(value: unknown): ParamDefinition[] | string {
	if (value === undefined || value === null) return [];
	if (!isRecord(value)) return "params must list parameters, each with a label and choices.";
	const params: ParamDefinition[] = [];
	for (const [name, raw] of Object.entries(value)) {
		if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || name === "count") return `"${name}" cannot be the name of a parameter.`;
		if (!isRecord(raw)) return `Parameter ${name} needs a label and choices.`;
		const choices = typeof raw.choices === "string" ? raw.choices.trim() : "";
		if (!(CHOICE_SOURCES as readonly string[]).includes(choices)) {
			return `Unknown choices "${choices}" for parameter ${name}. Use ${CHOICE_SOURCES.join(", ")}.`;
		}
		const label = typeof raw.label === "string" ? raw.label.trim() : "";
		params.push({ name, label: label || name, choices: choices as ChoiceSource });
	}
	return params;
}

/**
 * Turns the parsed frontmatter and the body of an action file into an action, or into an invalid entry
 * that carries one clear message. `frontmatter` is whatever the YAML parser returned.
 */
export function parseAction(path: string, frontmatter: unknown, body: string): ActionEntry {
	const fallbackName = fileName(path);
	if (!isRecord(frontmatter) || frontmatter["vaultmate-action"] === undefined) {
		return invalid(path, fallbackName, "Add vaultmate-action: 1 to the properties.");
	}
	const version = frontmatter["vaultmate-action"];
	if (version !== 1) return invalid(path, fallbackName, `Unsupported action version ${JSON.stringify(version)}. Use vaultmate-action: 1.`);

	const name = typeof frontmatter.name === "string" ? frontmatter.name.trim() : "";
	if (!name) return invalid(path, fallbackName, "The action needs a name.");
	const fail = (message: string): ActionEntry => invalid(path, name, message);

	if (!Array.isArray(frontmatter.sources) || frontmatter.sources.length === 0) return fail("sources must list at least one source.");
	const sources: SourceName[] = [];
	for (const source of frontmatter.sources as unknown[]) {
		const id = typeof source === "string" ? source.trim() : String(source);
		if ((SOURCES as readonly string[]).includes(id)) {
			if (!sources.includes(id as SourceName)) sources.push(id as SourceName);
		} else if (LATER_SOURCES.includes(id)) return fail(`Source ${id} is not available yet.`);
		else return fail(`Unknown source "${id}". Use ${SOURCES.join(", ")}.`);
	}

	const output = typeof frontmatter.output === "string" ? frontmatter.output.trim() : "";
	if (LATER_OUTPUTS.includes(output)) return fail(`Output ${output} is not available yet.`);
	if (output !== "questions" && output !== "suggestions") {
		return fail(output ? `Unknown output "${output}". Use questions or suggestions.` : "The action needs output: questions or suggestions.");
	}

	const count = frontmatter.count === undefined ? DEFAULT_COUNT : frontmatter.count;
	if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 10) return fail("count must be a whole number from 1 to 10.");

	const insert = parseInsert(frontmatter.insert);
	if (typeof insert === "string") return fail(insert);

	const params = parseParams(frontmatter.params);
	if (typeof params === "string") return fail(params);

	if (sources.includes("collection-profile") && !params.some((param) => param.name === "type")) {
		return fail("Source collection-profile needs the type parameter: add params with type, label and choices: collection-types.");
	}

	if (output === "suggestions" && !sources.includes("collection-profile")) return fail("Output suggestions needs the collection-profile source.");
	if (output === "suggestions" && insert) return fail("Output suggestions cannot be inserted into a note. Remove insert.");

	const prompt = body.replaceAll("{{count}}", String(count)).trim();
	if (!prompt) return fail("The prompt is empty. Write it below the properties.");

	return {
		ok: true,
		action: {
			path,
			name,
			description: typeof frontmatter.description === "string" ? frontmatter.description.trim() : "",
			icon: typeof frontmatter.icon === "string" && frontmatter.icon.trim() ? frontmatter.icon.trim() : "sparkles",
			command: frontmatter.command === true,
			sources,
			output,
			count,
			params,
			insert,
			prompt,
		},
	};
}
