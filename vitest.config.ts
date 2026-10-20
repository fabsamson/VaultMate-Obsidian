import { readFileSync } from "node:fs";

import { defineConfig } from "vitest/config";

const VIRTUAL = "virtual:vaultmate-styles";

// Vitest stubs every .css import, even with ?raw. The contrast test needs styles.css as text, so this
// plugin serves it as a virtual module.
export default defineConfig({
	plugins: [
		{
			name: "vaultmate-styles-text",
			resolveId: (id) => (id === VIRTUAL ? `\0${VIRTUAL}` : null),
			load: (id) => (id === `\0${VIRTUAL}` ? `export default ${JSON.stringify(readFileSync("styles.css", "utf8"))};` : null),
		},
	],
});
