import { describe, expect, it } from "vitest";

import { folderNoteFolder, scopePaths } from "../src/features/journal/scope";

const vault = [
	"10-Projects/Lyon/Lyon.md",
	"10-Projects/Lyon/Flat.md",
	"10-Projects/Lyon/Papers/Lease.md",
	"10-Projects/Paris.md",
	"10-Projects/Paris/Budget.md",
	"10-Projects/Empty.md",
	"10-Projects/Other.md",
	"Root.md",
	"Root/Child.md",
	"Lyon.md",
];

describe("folderNoteFolder", () => {
	it("recognises a note inside the folder of the same name", () => {
		expect(folderNoteFolder("10-Projects/Lyon/Lyon.md", vault)).toBe("10-Projects/Lyon");
	});

	it("recognises a note next to a folder of the same name", () => {
		expect(folderNoteFolder("10-Projects/Paris.md", vault)).toBe("10-Projects/Paris");
		expect(folderNoteFolder("Root.md", vault)).toBe("Root");
	});

	it("rejects an ordinary note, a note without a matching folder and a note whose folder differs", () => {
		expect(folderNoteFolder("10-Projects/Lyon/Flat.md", vault)).toBeNull();
		expect(folderNoteFolder("10-Projects/Empty.md", vault)).toBeNull();
		expect(folderNoteFolder("Lyon.md", vault)).toBeNull();
	});

	it("is not fooled by a folder whose name only starts the same", () => {
		expect(folderNoteFolder("A.md", ["A.md", "AB/x.md"])).toBeNull();
	});
});

describe("scopePaths", () => {
	it("covers the whole vault as null", () => {
		expect(scopePaths("vault", "Root.md", vault)).toBeNull();
		expect(scopePaths("note", null, vault)).toBeNull();
	});

	it("covers one note", () => {
		expect(scopePaths("note", "10-Projects/Lyon/Flat.md", vault)).toEqual(new Set(["10-Projects/Lyon/Flat.md"]));
	});

	it("covers a folder note and every note below its folder, recursively", () => {
		expect(scopePaths("tree", "10-Projects/Lyon/Lyon.md", vault)).toEqual(
			new Set(["10-Projects/Lyon/Lyon.md", "10-Projects/Lyon/Flat.md", "10-Projects/Lyon/Papers/Lease.md"]),
		);
		expect(scopePaths("tree", "10-Projects/Paris.md", vault)).toEqual(new Set(["10-Projects/Paris.md", "10-Projects/Paris/Budget.md"]));
	});

	it("falls back to the whole vault when the note is not a folder note", () => {
		expect(scopePaths("tree", "10-Projects/Other.md", vault)).toBeNull();
	});
});
