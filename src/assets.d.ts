// esbuild inlines imported PNG sprites as data URLs (see esbuild.config.mjs).
declare module "*.png" {
	const dataUrl: string;
	export default dataUrl;
}

// vitest.config.ts serves styles.css as text to the contrast test.
declare module "virtual:vaultmate-styles" {
	const text: string;
	export default text;
}
