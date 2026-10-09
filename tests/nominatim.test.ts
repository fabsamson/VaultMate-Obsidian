import { describe, expect, it } from "vitest";

import { buildSearchUrl, openStreetMapUrl, parseSearchResults, requestErrorMessage, simpleLanguage, userAgent, viewboxAround } from "../src/features/location/nominatim";

describe("buildSearchUrl", () => {
	it("sends the typed text only, with the documented parameters", () => {
		expect(buildSearchUrl("  Café & Co, Lyon ")).toBe("https://nominatim.openstreetmap.org/search?format=jsonv2&q=Caf%C3%A9%20%26%20Co%2C%20Lyon&limit=8&addressdetails=1");
	});

	it("adds the language and a viewbox that is not bounded", () => {
		const url = buildSearchUrl("museum", { language: "fr", near: { latitude: 45.76, longitude: 4.83 } });
		expect(url).toContain("&accept-language=fr");
		expect(url).toContain("&viewbox=4.33%2C46.26%2C5.33%2C45.26");
		expect(url).not.toContain("bounded");
	});
});

describe("helpers", () => {
	it("builds the User-Agent", () => {
		expect(userAgent("0.1.0")).toBe("VaultMate-Obsidian/0.1.0 (+https://github.com/fabsamson/VaultMate-Obsidian)");
	});

	it("accepts simple languages only", () => {
		expect(simpleLanguage("fr")).toBe("fr");
		expect(simpleLanguage("pt-BR")).toBe("pt-BR");
		expect(simpleLanguage("zh-Hans-CN")).toBeNull();
		expect(simpleLanguage("")).toBeNull();
	});

	it("keeps the viewbox within the globe", () => {
		expect(viewboxAround({ latitude: 89.8, longitude: -179.9 })).toBe("-180,90,-179.4,89.3");
	});

	it("explains failures plainly", () => {
		expect(requestErrorMessage(null)).toContain("Could not reach");
		expect(requestErrorMessage(429)).toContain("slow down");
		expect(requestErrorMessage(503)).toContain("HTTP 503");
	});

	it("links to openstreetmap.org", () => {
		expect(openStreetMapUrl({ latitude: 45.76404, longitude: 4.83566 })).toBe("https://www.openstreetmap.org/?mlat=45.76404&mlon=4.83566#map=17/45.76404/4.83566");
	});
});

describe("parseSearchResults", () => {
	const cafe = {
		lat: "45.7640400",
		lon: "4.8356600",
		category: "amenity",
		type: "cafe",
		name: "Café des Jacobins",
		display_name: "Café des Jacobins, 12, Rue Neuve, Lyon, France",
		address: { amenity: "Café des Jacobins", house_number: "12", road: "Rue Neuve", suburb: "Presqu'île", city: "Lyon", country: "France" },
	};

	it("reads name, type, short address and position", () => {
		expect(parseSearchResults([cafe])).toEqual([
			{ latitude: 45.76404, longitude: 4.83566, name: "Café des Jacobins", type: "cafe", address: "12 Rue Neuve, Presqu'île, Lyon, France" },
		]);
	});

	it("falls back to the first part of display_name, the category and the display address", () => {
		const [result] = parseSearchResults([{ lat: "1", lon: "2", category: "tourism", type: "yes", name: "", display_name: "Park, Somewhere, Region, Country" }]);
		expect(result).toEqual({ latitude: 1, longitude: 2, name: "Park", type: "tourism", address: "Somewhere, Region, Country" });
	});

	it("drops items without a valid position and ignores non-arrays", () => {
		expect(parseSearchResults([{ lat: "x", lon: "2" }, { lat: "91", lon: "2" }, { lat: "1", lon: "181" }, null, "text", { lon: "2" }])).toEqual([]);
		expect(parseSearchResults({ error: "boom" })).toEqual([]);
		expect(parseSearchResults(null)).toEqual([]);
	});
});
