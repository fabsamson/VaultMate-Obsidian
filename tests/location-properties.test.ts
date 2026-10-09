import { describe, expect, it } from "vitest";

import { describeLocation, planLocation, readCoordinates, roundCoordinate, type Place } from "../src/features/location/location-properties";

const names = { latitude: "latitude", longitude: "longitude", label: "location" };
const place: Place = { latitude: 45.764043, longitude: 4.835659, label: "Café, Lyon" };
const values = { latitude: 45.76404, longitude: 4.83566, location: "Café, Lyon" };

describe("roundCoordinate", () => {
	it("keeps 5 decimals", () => {
		expect(roundCoordinate(45.764043)).toBe(45.76404);
		expect(roundCoordinate(4.835659)).toBe(4.83566);
	});
});

describe("planLocation", () => {
	it("writes rounded numbers and the label when the note has none", () => {
		for (const fm of [undefined, {}, { latitude: null, longitude: "", location: "  " }]) {
			expect(planLocation(fm, names, place)).toEqual({ kind: "write", values });
		}
	});

	it("uses the configured property names", () => {
		const plan = planLocation({}, { latitude: "lat", longitude: "lon", label: "where" }, place);
		expect(plan).toEqual({ kind: "write", values: { lat: 45.76404, lon: 4.83566, where: "Café, Lyon" } });
	});

	it("does nothing when the note already has the same values", () => {
		expect(planLocation(values, names, place)).toEqual({ kind: "unchanged" });
		expect(planLocation({ ...values, location: " Café, Lyon " }, names, place)).toEqual({ kind: "unchanged" });
	});

	it("fills what is missing without asking when the rest is equal", () => {
		expect(planLocation({ latitude: 45.76404, longitude: 4.83566 }, names, place)).toEqual({ kind: "write", values });
	});

	it("asks, with old and new values, when a value differs", () => {
		const plan = planLocation({ latitude: 48.85, longitude: 2.35, location: "Paris" }, names, place);
		expect(plan).toEqual({ kind: "confirm", values, before: "Paris (48.85, 2.35)", after: "Café, Lyon (45.76404, 4.83566)" });
	});

	it("asks for a different label, a text coordinate, a string number or a list", () => {
		expect(planLocation({ ...values, location: "Elsewhere" }, names, place).kind).toBe("confirm");
		expect(planLocation({ ...values, latitude: "north" }, names, place).kind).toBe("confirm");
		expect(planLocation({ ...values, latitude: "45.76404" }, names, place).kind).toBe("confirm");
		expect(planLocation({ ...values, location: ["a", "b"] }, names, place)).toMatchObject({ kind: "confirm", before: '["a","b"] (45.76404, 4.83566)' });
	});

	it("leaves the label alone when the new label is empty", () => {
		const plan = planLocation({ location: "Mine" }, names, { ...place, label: " " });
		expect(plan).toEqual({ kind: "write", values: { latitude: 45.76404, longitude: 4.83566 } });
	});
});

describe("describeLocation and readCoordinates", () => {
	it("describes what is there", () => {
		expect(describeLocation(undefined, undefined, undefined)).toBe("no coordinates");
		expect(describeLocation("Home", 1, undefined)).toBe("Home (1, none)");
	});

	it("reads coordinates only when both are numbers", () => {
		expect(readCoordinates(values, names)).toEqual({ latitude: 45.76404, longitude: 4.83566 });
		expect(readCoordinates({ latitude: "1", longitude: 2 }, names)).toBeNull();
		expect(readCoordinates(undefined, names)).toBeNull();
	});
});
