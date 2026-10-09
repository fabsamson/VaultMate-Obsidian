// Reads a Chat Completions answer (adapted from Kotoba Insert). Pure.
export function extractCompletionText(value: unknown): string {
	if (!isRecord(value)) throw new Error("The AI provider returned an invalid response.");
	const choices = value.choices;
	if (!Array.isArray(choices) || choices.length === 0 || !isRecord(choices[0])) {
		throw new Error(responseMessage(value) ?? "The AI provider returned no completion.");
	}
	const message = choices[0].message;
	if (!isRecord(message)) throw new Error("The AI provider returned no completion.");
	const content = message.content;
	const text = typeof content === "string" ? content : contentFromParts(content);
	if (!text?.trim()) throw new Error("The AI provider returned an empty completion.");
	return text.trim();
}

function contentFromParts(value: unknown): string | null {
	if (!Array.isArray(value)) return null;
	const parts = value.flatMap((part) => {
		if (!isRecord(part) || typeof part.text !== "string") return [];
		return [part.text];
	});
	return parts.length > 0 ? parts.join("") : null;
}

export function responseMessage(value: unknown): string | null {
	if (!isRecord(value) || !isRecord(value.error) || typeof value.error.message !== "string") return null;
	return value.error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
