import { describe, expect, it } from "vitest";

import {
	addPending,
	checkEcho,
	echoRequestUrl,
	locationRequestUrl,
	nonceFromBytes,
	parseCoordinate,
	parseLocationCallback,
	parsePending,
	REQUEST_TTL_MS,
	takePending,
	type PendingRequest,
} from "../src/features/location/android-link";

const NONCE = "0123456789abcdef0123456789abcdef";
const NOW = 1_000_000;
const pending = (over: Partial<PendingRequest> = {}): PendingRequest => ({ nonce: NONCE, kind: "location", path: "Cafe.md", createdAt: NOW - 1000, ...over });
const good = { nonce: NONCE, lat: "45.76404", lng: "4.83566" };

function queryOf(url: string): Record<string, string> {
	return Object.fromEntries(new URL(url).searchParams);
}

describe("requests", () => {
	it("builds a 32 character nonce and the location link", () => {
		expect(nonceFromBytes(new Uint8Array([0, 1, 171, 255]))).toBe("0001abff");
		expect(locationRequestUrl(NONCE)).toBe(`vaultmate://location?nonce=${NONCE}`);
	});

	it("builds the echo link with the exact encoded label", () => {
		expect(echoRequestUrl(NONCE)).toBe(`vaultmate://echo?nonce=${NONCE}&lat=45.76404&lng=4.83566&label=Caf%C3%A9%20%26%20Co%20%2F%20Lyon`);
	});
});

describe("pending requests", () => {
	it("keeps at most five, newest last, and drops expired ones", () => {
		let list: PendingRequest[] = [];
		for (let i = 0; i < 7; i++) list = addPending(list, pending({ nonce: String(i).repeat(32), createdAt: NOW + i }), NOW + i);
		expect(list.map((item) => item.nonce[0])).toEqual(["2", "3", "4", "5", "6"]);
		const later = NOW + REQUEST_TTL_MS + 3;
		expect(addPending(list, pending({ nonce: "a".repeat(32), createdAt: later }), later).map((item) => item.nonce[0])).toEqual(["3", "4", "5", "6", "a"]);
	});

	it("reads only well-formed stored items", () => {
		expect(parsePending([pending(), { nonce: "short", kind: "location", path: "", createdAt: 1 }, null, { ...pending(), kind: "x" }, "text"])).toEqual([pending()]);
		expect(parsePending("nope")).toEqual([]);
	});

	it("takes a request once", () => {
		const first = takePending([pending()], NONCE, "location", NOW);
		expect(first.request).toEqual(pending());
		expect(first.rest).toEqual([]);
		expect(takePending(first.rest, NONCE, "location", NOW).request).toBeNull();
	});

	it("refuses an unknown nonce, the wrong kind and an expired request, and removes the expired one", () => {
		expect(takePending([pending()], "f".repeat(32), "location", NOW).request).toBeNull();
		expect(takePending([pending()], undefined, "location", NOW).request).toBeNull();
		expect(takePending([pending()], NONCE, "echo", NOW).request).toBeNull();
		const late = takePending([pending()], NONCE, "location", NOW - 1000 + REQUEST_TTL_MS + 1);
		expect(late.request).toBeNull();
		expect(late.problem).toContain("expired");
		expect(late.rest).toEqual([]);
		expect(takePending([pending({ createdAt: NOW + 5 })], NONCE, "location", NOW).request).toBeNull();
	});
});

describe("parseCoordinate", () => {
	it("accepts plain decimals in range", () => {
		expect(parseCoordinate("45.76404", 90)).toBe(45.76404);
		expect(parseCoordinate("-179.5", 180)).toBe(-179.5);
		expect(parseCoordinate("0", 90)).toBe(0);
		expect(parseCoordinate("90", 90)).toBe(90);
	});

	it("refuses commas, extra text, exponents, spaces and out-of-range values", () => {
		for (const bad of ["45,76404", "45.7 km", "1e3", " 45", "45.", ".5", "", "NaN", "Infinity", "+45", "91", "-90.1", "45.76404,4.83566"]) {
			expect(parseCoordinate(bad, 90), bad).toBeNull();
		}
		expect(parseCoordinate(undefined, 90)).toBeNull();
		expect(parseCoordinate("181", 180)).toBeNull();
	});
});

describe("parseLocationCallback", () => {
	it("accepts a valid answer, with its label and accuracy, and uses the nonce up", () => {
		const result = parseLocationCallback({ ...good, accuracy: "12.5", label: "  Lyon 2e " }, [pending()], NOW);
		expect(result).toMatchObject({ ok: true, place: { latitude: 45.76404, longitude: 4.83566, label: "Lyon 2e" }, accuracy: 12.5, rest: [] });
		if (result.ok) expect(result.request.path).toBe("Cafe.md");
	});

	it("accepts a missing accuracy and label", () => {
		expect(parseLocationCallback(good, [pending()], NOW)).toMatchObject({ ok: true, place: { label: "" }, accuracy: undefined });
	});

	it("refuses an unknown, reused or expired nonce", () => {
		expect(parseLocationCallback({ ...good, nonce: "f".repeat(32) }, [pending()], NOW).ok).toBe(false);
		const used = parseLocationCallback(good, [pending()], NOW);
		expect(parseLocationCallback(good, used.rest, NOW).ok).toBe(false);
		expect(parseLocationCallback(good, [pending()], NOW + REQUEST_TTL_MS).ok).toBe(false);
	});

	it("refuses invalid coordinates or accuracy, still using the nonce up", () => {
		for (const params of [{ ...good, lat: "45,76404" }, { ...good, lng: "200" }, { ...good, lat: undefined }, { ...good, accuracy: "-3" }, { ...good, accuracy: "12 m" }]) {
			const result = parseLocationCallback(params, [pending()], NOW);
			expect(result.ok).toBe(false);
			expect(result.rest).toEqual([]);
		}
	});

	it("reports an error from the app, shortened and without control characters", () => {
		const result = parseLocationCallback({ nonce: NONCE, error: `Permission denied\n${"x".repeat(500)}` }, [pending()], NOW);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message.startsWith("The VaultMate app could not get the position: Permission denied x")).toBe(true);
			expect(result.message.length).toBeLessThan(260);
			expect(result.message).not.toContain("\n");
		}
		expect(parseLocationCallback({ nonce: "f".repeat(32), error: "x" }, [pending()], NOW).ok).toBe(false);
	});

	it("cuts a very long label", () => {
		const result = parseLocationCallback({ ...good, label: "a".repeat(400) }, [pending()], NOW);
		expect(result.ok && result.place.label.length).toBe(120);
	});
});

describe("checkEcho", () => {
	const echo = pending({ kind: "echo", path: "" });

	it("passes when the link comes back unchanged through the encoding", () => {
		const params = queryOf(echoRequestUrl(NONCE).replace("vaultmate://echo", "https://x/"));
		expect(params.label).toBe("Café & Co / Lyon");
		expect(checkEcho(params, [echo], NOW)).toEqual({ ok: true, rest: [] });
	});

	it("names each parameter that changed", () => {
		const params = queryOf(echoRequestUrl(NONCE).replace("vaultmate://echo", "https://x/"));
		const result = checkEcho({ ...params, lat: "45,76404", label: "Café  Co" }, [echo], NOW);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toContain('lat (sent "45.76404", got "45,76404")');
			expect(result.message).toContain("label");
			expect(result.message).not.toContain("lng");
		}
		const missing = checkEcho({ nonce: NONCE }, [echo], NOW);
		expect(!missing.ok && missing.message).toContain("got nothing");
	});

	it("needs a pending echo nonce", () => {
		expect(checkEcho({ nonce: NONCE }, [pending()], NOW).ok).toBe(false);
	});
});
