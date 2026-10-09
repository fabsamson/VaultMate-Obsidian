// Dev-only benchmark of the context finder's pure engine on a synthetic corpus (nothing is shipped).
// Usage: node scripts/bench-context.mjs [notes=2000] [queries=30]
// It measures a cold index build (clean, tokenize, count, index) and queries (signals and ranking),
// without Obsidian: the graph is generated in memory, so the MetadataCache reads are not included.
import { build } from "esbuild";
import process from "node:process";

const notesCount = Number(process.argv[2] ?? 2000);
const queriesCount = Number(process.argv[3] ?? 30);

const bundle = await build({
	stdin: {
		contents: `export { findRelated } from "./src/features/context/engine";
export { buildNoteMeta } from "./src/features/context/note-meta";
export { makeDoc, TextIndex } from "./src/features/context/text-index";
export { tokenize } from "./src/features/context/tokenizer";`,
		resolveDir: process.cwd(),
		loader: "ts",
	},
	bundle: true,
	write: false,
	format: "esm",
	platform: "node",
	logLevel: "error",
});
const code = bundle.outputFiles[0]?.text ?? "";
const { findRelated, buildNoteMeta, makeDoc, TextIndex, tokenize } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

// Deterministic random numbers.
let seed = 12345;
const random = () => {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
	return seed / 2 ** 32;
};
const pick = (list) => list[Math.floor(random() * list.length)];
// Zipf-like: low indexes are much more likely.
const zipf = (size) => Math.min(size - 1, Math.floor(size ** random() - 1));

const syllables = ["ba", "ke", "lo", "mi", "nu", "ra", "so", "ti", "ve", "zu", "chan", "tre", "pli", "gro", "dé", "lu", "ma", "ron", "sa", "bel"];
const vocabulary = Array.from({ length: 6000 }, (_, i) => {
	let word = "";
	for (let n = i + 17, k = 0; k < 3 || n > 0; k++, n = Math.floor(n / syllables.length)) word += syllables[n % syllables.length];
	return word;
});
const tagPool = Array.from({ length: 150 }, (_, i) => `topic${i}`);
const people = Array.from({ length: 120 }, (_, i) => `Person ${vocabulary[i]}`);

const day = 86_400_000;
const titles = Array.from({ length: notesCount }, (_, i) => `${vocabulary[zipf(vocabulary.length)]} ${vocabulary[Math.floor(random() * vocabulary.length)]} ${i}`);
const corpus = titles.map((title) => {
	const words = Array.from({ length: 80 + Math.floor(random() * 420) }, () => vocabulary[zipf(vocabulary.length)]);
	// Links favour a few popular notes; some notes also name another note without linking it.
	const links = Array.from({ length: Math.floor(random() * 8) }, () => `${titles[zipf(notesCount)]}.md`);
	if (random() < 0.1) words.splice(Math.floor(random() * words.length), 0, ...titles[Math.floor(random() * notesCount)].split(" "));
	return { title, words, links };
});

const texts = new Map();
const metas = new Map();
for (const note of corpus) {
	const path = `${note.title}.md`;
	const tags = Array.from({ length: Math.floor(random() * 4) }, () => `#${tagPool[zipf(tagPool.length)]}`);
	const frontmatter = { date: new Date(Date.UTC(2024, 0, 1) + Math.floor(random() * 700) * day).toISOString().slice(0, 10) };
	if (random() < 0.3) frontmatter.author = pick(people);
	if (random() < 0.1) {
		frontmatter.latitude = 45.7 + random() * 0.3;
		frontmatter.longitude = 4.8 + random() * 0.3;
	}
	texts.set(path, `---\ntags: [x]\n---\n# ${note.title}\n\n${note.words.join(" ")}\n\n\`\`\`\ncode block ignored\n\`\`\`\n${note.links.map((link) => `[[${link.replace(/\.md$/, "")}]]`).join(" ")}\n`);
	metas.set(path, buildNoteMeta({ path, links: note.links.filter((link) => link !== path), tags, frontmatter }, { peopleProperties: ["author"], latitudeProperty: "latitude", longitudeProperty: "longitude" }));
}

const now = () => performance.now();
const bytes = [...texts.values()].reduce((sum, text) => sum + text.length, 0);

// Cold build, repeated for a stable figure.
const builds = [];
let text;
for (let run = 0; run < 3; run++) {
	const start = now();
	text = new TextIndex();
	for (const [path, markdown] of texts) text.put(path, makeDoc(markdown, 1), tokenize(path.replace(/\.md$/, "")));
	builds.push(now() - start);
}

const readText = (path) => Promise.resolve(texts.get(path) ?? "");
const paths = [...metas.keys()];
const times = [];
let results = 0;
for (let q = 0; q < queriesCount; q++) {
	const active = paths[Math.floor(random() * paths.length)];
	const start = now();
	const found = await findRelated({ active, notes: metas, text, readText, limit: 8 });
	times.push(now() - start);
	results += found.length;
}
times.sort((a, b) => a - b);
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

console.log(`corpus: ${notesCount} notes, ${(bytes / 1e6).toFixed(1)} MB of text, ${new Set([...metas.values()].flatMap((m) => m.links)).size} link targets`);
console.log(`cold build ms (3 runs): ${builds.map((ms) => ms.toFixed(0)).join(", ")}  (budget 2000)`);
console.log(`query ms over ${queriesCount} notes: mean ${mean(times).toFixed(1)}, median ${times[Math.floor(times.length / 2)].toFixed(1)}, max ${times[times.length - 1].toFixed(1)}  (budget 200)`);
console.log(`average results per query: ${(results / queriesCount).toFixed(1)}`);
