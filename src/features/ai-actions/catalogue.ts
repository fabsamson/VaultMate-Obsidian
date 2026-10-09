// The list of actions found in the actions folder, kept up to date as files change. Reading it only
// lists and parses the action files; nothing is sent anywhere.
import { debounce, normalizePath, parseYaml, TFile, TFolder, type App } from "obsidian";

import type VaultMatePlugin from "../../main";
import { parseAction, splitFrontmatter, type ActionDefinition, type ActionEntry } from "./definition";

/** Stable command id for an action file, so a rename is a new command and an edit is not. */
export function commandId(path: string): string {
	let hash = 5381;
	for (const char of path) hash = (Math.imul(hash, 33) + char.codePointAt(0)!) | 0;
	return `ai-action-${(hash >>> 0).toString(16)}`;
}

async function loadEntry(app: App, file: TFile): Promise<ActionEntry> {
	const { yaml, body } = splitFrontmatter(await app.vault.read(file));
	let frontmatter: unknown = null;
	if (yaml !== null) {
		try {
			frontmatter = parseYaml(yaml);
		} catch {
			return { ok: false, path: file.path, name: file.basename, message: "The properties are not valid YAML." };
		}
	}
	return parseAction(file.path, frontmatter, body);
}

function collectFiles(folder: TFolder): TFile[] {
	return folder.children.flatMap((child) => {
		if (child instanceof TFolder) return collectFiles(child);
		return child instanceof TFile && child.extension === "md" ? [child] : [];
	});
}

export class ActionCatalogue {
	private list: ActionEntry[] = [];
	private commandIds: string[] = [];
	private generation = 0;
	private readonly listeners: Array<() => void> = [];

	public constructor(
		private readonly plugin: VaultMatePlugin,
		private readonly runCommand: (action: ActionDefinition) => void,
	) {}

	public entries(): ActionEntry[] {
		return this.list;
	}

	public find(path: string): ActionDefinition | null {
		const entry = this.list.find((candidate) => candidate.ok && candidate.action.path === path);
		return entry?.ok ? entry.action : null;
	}

	public onChange(listener: () => void): void {
		this.listeners.push(listener);
	}

	public folder(): string {
		return normalizePath(this.plugin.settings.ai.actionsFolder);
	}

	/** Call once the layout is ready: reload when a file of the actions folder changes. */
	public registerEvents(): void {
		const { plugin } = this;
		const reload = debounce(() => void this.reload(), 300, true);
		const touches = (path: string): boolean => {
			const folder = this.folder();
			return path === folder || path.startsWith(`${folder}/`);
		};
		const changed = (path: string, oldPath?: string): void => {
			if (touches(path) || (oldPath !== undefined && touches(oldPath))) reload();
		};
		plugin.registerEvent(plugin.app.vault.on("create", (file) => changed(file.path)));
		plugin.registerEvent(plugin.app.vault.on("modify", (file) => changed(file.path)));
		plugin.registerEvent(plugin.app.vault.on("delete", (file) => changed(file.path)));
		plugin.registerEvent(plugin.app.vault.on("rename", (file, oldPath) => changed(file.path, oldPath)));
	}

	/** Lists and parses the action files again, then refreshes the commands. */
	public async reload(): Promise<void> {
		const generation = ++this.generation;
		const { app, settings } = this.plugin;
		const folder = settings.ai.enabled ? app.vault.getFolderByPath(this.folder()) : null;
		const files = folder ? collectFiles(folder).sort((a, b) => a.path.localeCompare(b.path)) : [];
		const entries = await Promise.all(files.map((file) => loadEntry(app, file)));
		if (generation !== this.generation) return;
		this.list = entries;
		this.syncCommands();
		for (const listener of this.listeners) listener();
	}

	/** One command `AI: <name>` per valid action with `command: true`; removed again when the file goes away. */
	private syncCommands(): void {
		for (const id of this.commandIds) this.plugin.removeCommand(id);
		this.commandIds = [];
		for (const entry of this.list) {
			if (!entry.ok || !entry.action.command) continue;
			const { path, name, icon } = entry.action;
			const id = commandId(path);
			this.commandIds.push(id);
			this.plugin.addCommand({
				id,
				name: `AI: ${name}`,
				icon,
				callback: () => {
					const current = this.find(path);
					if (current) this.runCommand(current);
				},
			});
		}
	}
}
