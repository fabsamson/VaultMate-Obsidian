// The runtime side of the app links: going back to the VaultMate Android app, and today's daily note on request.
import { moment, normalizePath, Notice, Platform } from "obsidian";

import type VaultMatePlugin from "../../main";
import { backUrl, dailyNotePath, wantsBack, type BackKind, type BackResult } from "./back-link";

/** Opens the app's `vaultmate://back` link. Mobile only: on desktop there is no app to return to. */
export function returnToApp(kind: BackKind, result: BackResult): void {
	if (Platform.isMobile) activeWindow.open(backUrl(kind, result));
}

/** The core Daily notes plugin is not in the public typings. */
interface CommandsApi {
	commands?: Record<string, unknown>;
	executeCommandById(id: string): boolean;
}
interface InternalPluginsApi {
	getPluginById(id: string): { instance?: { options?: { folder?: string; format?: string } } } | undefined;
}

const WAIT_MS = 10_000;
const STEP_MS = 250;

/** `obsidian://vaultmate-daily?back=app`: has Obsidian open or create today's daily note (its own command, so the user's template applies). It never writes by itself. */
export function registerDailyLink(plugin: VaultMatePlugin): void {
	plugin.registerObsidianProtocolHandler("vaultmate-daily", (params) => void onDailyLink(plugin, wantsBack(params)));
}

async function onDailyLink(plugin: VaultMatePlugin, back: boolean): Promise<void> {
	const { app } = plugin;
	const { commands } = app as unknown as { commands: CommandsApi };
	const id = Object.keys(commands.commands ?? {}).find((key) => key === "daily-notes" || key.startsWith("daily-notes:"));
	if (!id) {
		fail(back, "The Daily notes core plugin is turned off. Turn it on in Obsidian to create today's note.");
		return;
	}
	const options = (app as unknown as { internalPlugins?: InternalPluginsApi }).internalPlugins?.getPluginById("daily-notes")?.instance?.options;
	// The `moment` typings are not installed here: the call is typed by hand.
	const name = (moment as unknown as () => { format(pattern: string): string })().format(options?.format?.trim() || "YYYY-MM-DD");
	const path = normalizePath(dailyNotePath(options?.folder, name));
	commands.executeCommandById(id);
	for (let waited = 0; waited <= WAIT_MS; waited += STEP_MS) {
		if (app.vault.getFileByPath(path)) {
			if (back) returnToApp("daily", "done");
			return;
		}
		await new Promise((resolve) => window.setTimeout(resolve, STEP_MS));
	}
	fail(back, "Today's daily note was not created. Check the Daily notes settings.");
}

function fail(back: boolean, message: string): void {
	new Notice(message);
	if (back) returnToApp("daily", "error");
}
