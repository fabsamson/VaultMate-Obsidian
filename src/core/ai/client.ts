// The one network call of the AI actions: a single Chat Completions request through requestUrl.
import { requestUrl, type App, type RequestUrlResponse } from "obsidian";

import { completionEndpoint, isLocalBaseUrl } from "./endpoint";
import { extractCompletionText, responseMessage } from "./response";

export interface AiConfiguration {
	baseUrl: string;
	model: string;
	/** Name of the SecretStorage secret that holds the API key. */
	apiKeySecret: string;
}

export interface AiMessages {
	system: string;
	user: string;
}

const TIMEOUT_MS = 60_000;
const TIMEOUT_MESSAGE = "The AI provider did not answer within 60 seconds.";

/** What is missing before a call can be made, or null when the configuration is complete. */
export function configurationProblem(app: App, config: AiConfiguration): string | null {
	if (!config.model.trim()) return "Set an AI model in the VaultMate settings, under AI actions.";
	if (!config.apiKeySecret.trim()) {
		return isLocalBaseUrl(config.baseUrl) ? null : "Choose an API key secret in the VaultMate settings, under AI actions.";
	}
	if (!app.secretStorage.getSecret(config.apiKeySecret)) {
		return `The API key secret "${config.apiKeySecret}" is empty or missing. Check it in the VaultMate settings, under AI actions.`;
	}
	return null;
}

/** Sends the messages and returns the assistant's text. Rejects with a readable message. */
export async function complete(app: App, config: AiConfiguration, messages: AiMessages): Promise<string> {
	const problem = configurationProblem(app, config);
	if (problem) throw new Error(problem);
	const endpoint = completionEndpoint(config.baseUrl);
	const apiKey = config.apiKeySecret.trim() ? app.secretStorage.getSecret(config.apiKeySecret) : null;
	const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

	let timer: number | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = window.setTimeout(() => reject(new Error(TIMEOUT_MESSAGE)), TIMEOUT_MS);
	});
	let response: RequestUrlResponse;
	try {
		response = await Promise.race([
			requestUrl({
				url: endpoint,
				method: "POST",
				contentType: "application/json",
				headers,
				body: JSON.stringify({
					model: config.model.trim(),
					messages: [
						{ role: "system", content: messages.system },
						{ role: "user", content: messages.user },
					],
					stream: false,
				}),
				throw: false,
			}),
			timeout,
		]);
	} catch (error) {
		const text = error instanceof Error ? error.message : String(error);
		throw new Error(text === TIMEOUT_MESSAGE ? text : `Unable to contact the AI provider: ${text}`);
	} finally {
		window.clearTimeout(timer);
	}

	let body: unknown = null;
	try {
		body = response.json as unknown;
	} catch {
		// A body that is not JSON is reported through the status, or as an invalid response.
	}
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`HTTP ${response.status}: ${responseMessage(body) ?? "the AI provider refused the request."}`);
	}
	return extractCompletionText(body);
}
