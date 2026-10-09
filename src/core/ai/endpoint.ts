// OpenAI-compatible Chat Completions endpoint (adapted from Kotoba Insert). Pure.

function isLocalAddress(url: URL): boolean {
	return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

function parseBaseUrl(baseUrl: string): URL {
	let parsed: URL;
	try {
		parsed = new URL(baseUrl.trim());
	} catch {
		throw new Error("Enter a valid AI base URL in the VaultMate settings.");
	}
	if (parsed.username || parsed.password || parsed.search || parsed.hash) {
		throw new Error("The AI base URL cannot include credentials, a query, or a fragment.");
	}
	if (parsed.protocol !== "https:" && !isLocalAddress(parsed)) {
		throw new Error("AI base URLs must use HTTPS, except for a local server.");
	}
	return parsed;
}

/** `<base>/chat/completions`. Throws a user-readable error for an unusable base URL. */
export function completionEndpoint(baseUrl: string): string {
	const parsed = parseBaseUrl(baseUrl);
	parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/chat/completions`;
	return parsed.toString();
}

/** Error message for a base URL as typed, or undefined when it is usable. */
export function validateBaseUrl(baseUrl: string): string | undefined {
	try {
		parseBaseUrl(baseUrl);
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : "Enter a valid AI base URL.";
	}
}

/** A local server (localhost, 127.0.0.1) may be used without an API key. */
export function isLocalBaseUrl(baseUrl: string): boolean {
	try {
		return isLocalAddress(new URL(baseUrl.trim()));
	} catch {
		return false;
	}
}

/** Host shown in the send preview (`api.openai.com`, `localhost:1234`). */
export function baseUrlHost(baseUrl: string): string {
	try {
		return new URL(baseUrl.trim()).host;
	} catch {
		return baseUrl.trim();
	}
}
