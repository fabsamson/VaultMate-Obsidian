import esbuild from "esbuild";
import process from "node:process";
import { builtinModules } from "node:module";

const production = process.argv[2] === "production";
const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtinModules,
	],
	// Releases ship only main.js, manifest.json and styles.css, so the pixel sprites are inlined.
	loader: { ".png": "dataurl" },
	format: "cjs",
	target: "es2021",
	logLevel: "info",
	sourcemap: production ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	minify: production,
});

if (production) {
	await context.rebuild();
	await context.dispose();
} else {
	await context.watch();
}
