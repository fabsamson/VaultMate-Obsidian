// The link contract with the VaultMate Android app (see README, "VaultMate Android app"). Pure.
//
// Out:  vaultmate://location?nonce=<nonce>
// Back: obsidian://vaultmate-location?nonce=&lat=&lng=&accuracy=&label=&error=
// Test: vaultmate://echo?nonce=&lat=&lng=&label=  ->  obsidian://vaultmate-echo?nonce=&lat=&lng=&label=
import type { Place } from "./location-properties";

/** A request lives two minutes; the nonce works once. */
export const REQUEST_TTL_MS = 120_000;
const MAX_PENDING = 5;
const MAX_LABEL_LENGTH = 120;
const MAX_ERROR_LENGTH = 200;

export type RequestKind = "location" | "echo";

/** A request waiting for the app's answer (kept per device, since Obsidian may be suspended meanwhile). */
export interface PendingRequest {
	nonce: string;
	kind: RequestKind;
	/** Note the position is for; empty for the echo test. */
	path: string;
	createdAt: number;
}

/** What the echo test sends. The label has a space, an accent, `&` and `/`: everything a link may alter. */
export const ECHO_SAMPLE = { lat: "45.76404", lng: "4.83566", label: "Café & Co / Lyon" } as const;

/** 128 random bits as 32 hex characters (the caller supplies the random bytes). */
export function nonceFromBytes(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function locationRequestUrl(nonce: string): string {
	return `vaultmate://location?nonce=${encodeURIComponent(nonce)}`;
}

export function echoRequestUrl(nonce: string): string {
	return `vaultmate://echo?nonce=${encodeURIComponent(nonce)}&lat=${ECHO_SAMPLE.lat}&lng=${ECHO_SAMPLE.lng}&label=${encodeURIComponent(ECHO_SAMPLE.label)}`;
}

// ---- Pending requests ----------------------------------------------------------------------------

function alive(request: PendingRequest, now: number): boolean {
	const age = now - request.createdAt;
	return age >= 0 && age <= REQUEST_TTL_MS;
}

/** Reads the stored list, dropping anything malformed. */
export function parsePending(raw: unknown): PendingRequest[] {
	if (!Array.isArray(raw)) return [];
	const list: PendingRequest[] = [];
	for (const item of raw) {
		if (typeof item !== "object" || item === null) continue;
		const { nonce, kind, path, createdAt } = item as Record<string, unknown>;
		if (typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce)) continue;
		if ((kind !== "location" && kind !== "echo") || typeof path !== "string" || typeof createdAt !== "number" || !Number.isFinite(createdAt)) continue;
		list.push({ nonce, kind, path, createdAt });
	}
	return list;
}

/** The list with the new request, expired ones removed and only the newest few kept. */
export function addPending(list: readonly PendingRequest[], request: PendingRequest, now: number): PendingRequest[] {
	return [...list.filter((item) => alive(item, now)), request].slice(-MAX_PENDING);
}

type Taken = { request: PendingRequest; rest: PendingRequest[]; problem?: undefined } | { request: null; rest: PendingRequest[]; problem: string };

/** Finds the request of a nonce and removes it from the list, whatever happens next (single use). */
export function takePending(list: readonly PendingRequest[], nonce: string | undefined, kind: RequestKind, now: number): Taken {
	const found = list.find((item) => item.nonce === nonce && item.kind === kind);
	const rest = list.filter((item) => item !== found && alive(item, now));
	if (!found) return { request: null, rest, problem: "This link was not requested from this device, or was already used." };
	if (!alive(found, now)) return { request: null, rest, problem: "This link expired after 2 minutes. Ask for the position again." };
	return { request: found, rest };
}

// ---- Location callback ---------------------------------------------------------------------------

const DECIMAL = /^-?\d{1,3}(\.\d{1,10})?$/;
const UNSIGNED = /^\d{1,7}(\.\d{1,3})?$/;

/** A plain decimal number in range, or null. A comma, a unit or extra text is refused, never repaired. */
export function parseCoordinate(value: string | undefined, limit: number): number | null {
	if (value === undefined || !DECIMAL.test(value)) return null;
	const number = Number(value);
	return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

/** Text from the app as one short line: control characters become spaces. */
function plainText(text: string, maxLength: number): string {
	return Array.from(text, (char) => (char.charCodeAt(0) < 32 ? " " : char)).join("").trim().slice(0, maxLength);
}

export type LocationCallback =
	| { ok: true; request: PendingRequest; place: Place; accuracy?: number; rest: PendingRequest[] }
	| { ok: false; message: string; rest: PendingRequest[] };

/** Checks the app's answer. `rest` is the list to store, whether the answer was accepted or not. */
export function parseLocationCallback(params: Readonly<Record<string, string | undefined>>, list: readonly PendingRequest[], now: number): LocationCallback {
	const taken = takePending(list, params.nonce, "location", now);
	if (!taken.request) return { ok: false, message: taken.problem, rest: taken.rest };
	const { rest } = taken;
	if (params.error !== undefined) {
		const detail = plainText(params.error, MAX_ERROR_LENGTH);
		return { ok: false, message: `The VaultMate app could not get the position${detail ? `: ${detail}` : "."}`, rest };
	}
	const latitude = parseCoordinate(params.lat, 90);
	const longitude = parseCoordinate(params.lng, 180);
	if (latitude === null || longitude === null) return { ok: false, message: "The VaultMate app sent a position that is not valid. Nothing was written.", rest };
	let accuracy: number | undefined;
	if (params.accuracy !== undefined && params.accuracy !== "") {
		if (!UNSIGNED.test(params.accuracy)) return { ok: false, message: "The VaultMate app sent an accuracy that is not valid. Nothing was written.", rest };
		accuracy = Number(params.accuracy);
	}
	const label = plainText(params.label ?? "", MAX_LABEL_LENGTH);
	return { ok: true, request: taken.request, place: { latitude, longitude, label }, accuracy, rest };
}

// ---- Echo test -----------------------------------------------------------------------------------

export type EchoResult = { ok: true; rest: PendingRequest[] } | { ok: false; message: string; rest: PendingRequest[] };

/** Compares what came back with what was sent, character by character. */
export function checkEcho(params: Readonly<Record<string, string | undefined>>, list: readonly PendingRequest[], now: number): EchoResult {
	const taken = takePending(list, params.nonce, "echo", now);
	if (!taken.request) return { ok: false, message: taken.problem, rest: taken.rest };
	const changed = (Object.keys(ECHO_SAMPLE) as (keyof typeof ECHO_SAMPLE)[]).filter((name) => params[name] !== ECHO_SAMPLE[name]);
	if (changed.length === 0) return { ok: true, rest: taken.rest };
	const details = changed.map((name) => `${name} (sent "${ECHO_SAMPLE[name]}", got ${params[name] === undefined ? "nothing" : `"${params[name]}"`})`);
	return { ok: false, message: `Link test failed: ${details.join("; ")}.`, rest: taken.rest };
}
