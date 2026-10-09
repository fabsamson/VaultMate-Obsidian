import { describe, expect, it } from "vitest";

import { baseUrlHost, completionEndpoint, isLocalBaseUrl, validateBaseUrl } from "../src/core/ai/endpoint";
import { extractCompletionText, responseMessage } from "../src/core/ai/response";

describe("AI completion responses", () => {
	it("extracts a text completion", () => {
		expect(extractCompletionText({ choices: [{ message: { content: " Hello " } }] })).toBe("Hello");
	});

	it("extracts text content parts", () => {
		expect(extractCompletionText({ choices: [{ message: { content: [{ type: "text", text: "first " }, { type: "text", text: "second" }] } }] })).toBe("first second");
	});

	it("uses the provider error message when no completion is returned", () => {
		const response = { error: { message: "Invalid API key" } };
		expect(responseMessage(response)).toBe("Invalid API key");
		expect(() => extractCompletionText(response)).toThrow("Invalid API key");
	});

	it("rejects empty and invalid responses", () => {
		expect(() => extractCompletionText({ choices: [{ message: { content: "  " } }] })).toThrow("empty");
		expect(() => extractCompletionText(null)).toThrow("invalid");
		expect(() => extractCompletionText({ choices: [] })).toThrow("no completion");
	});
});

describe("completionEndpoint", () => {
	it("builds the endpoint from the base URL", () => {
		expect(completionEndpoint("https://api.openai.com/v1")).toBe("https://api.openai.com/v1/chat/completions");
		expect(completionEndpoint("http://localhost:1234/v1/")).toBe("http://localhost:1234/v1/chat/completions");
		expect(completionEndpoint("http://127.0.0.1:8080")).toBe("http://127.0.0.1:8080/chat/completions");
	});

	it("rejects an insecure remote URL, credentials, queries and garbage", () => {
		expect(() => completionEndpoint("http://example.com/v1")).toThrow("HTTPS");
		expect(() => completionEndpoint("https://user:pw@example.com/v1")).toThrow("credentials");
		expect(() => completionEndpoint("https://example.com/v1?key=1")).toThrow("query");
		expect(() => completionEndpoint("not a url")).toThrow("valid");
	});

	it("validates, detects local servers and names the host", () => {
		expect(validateBaseUrl("https://api.openai.com/v1")).toBeUndefined();
		expect(validateBaseUrl("http://example.com")).toBeTruthy();
		expect(isLocalBaseUrl("http://localhost:1234/v1")).toBe(true);
		expect(isLocalBaseUrl("https://api.openai.com/v1")).toBe(false);
		expect(baseUrlHost("http://localhost:1234/v1")).toBe("localhost:1234");
		expect(baseUrlHost("https://api.openai.com/v1")).toBe("api.openai.com");
	});
});
