import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings, validateDistinctProperties, validatePropertyName } from "../src/core/settings-model";

describe("location settings", () => {
	it("has generic defaults, with the Android app off", () => {
		expect(DEFAULT_SETTINGS.location).toEqual({ enabled: true, latitudeProperty: "latitude", longitudeProperty: "longitude", labelProperty: "location", androidApp: false });
	});

	it("validates property names and their distinctness", () => {
		expect(validatePropertyName("where")).toBeUndefined();
		expect(validatePropertyName("lieu_2")).toBeUndefined();
		expect(validatePropertyName(" ")).toBeTruthy();
		expect(validatePropertyName("a b")).toBeTruthy();
		expect(validatePropertyName("a:b")).toBeTruthy();
		expect(validateDistinctProperties(["a", "b", "c"])).toBeUndefined();
		expect(validateDistinctProperties(["a", "B", "b"])).toBeTruthy();
	});

	it("keeps valid loaded values and falls back to the defaults when names clash or are invalid", () => {
		expect(normalizeSettings({ location: { labelProperty: " where ", androidApp: true } }).location).toMatchObject({ labelProperty: "where", androidApp: true });
		expect(normalizeSettings({ location: { latitudeProperty: "x", longitudeProperty: "X" } }).location).toEqual(DEFAULT_SETTINGS.location);
		expect(normalizeSettings({ location: { latitudeProperty: "a b", enabled: "no", androidApp: 1 } }).location).toEqual(DEFAULT_SETTINGS.location);
	});
});
