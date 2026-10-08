// The Obsidian community review runs these rules; keep the build free of their findings.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.*"],
				},
			},
		},
		rules: {
			// "VaultMate" is the product name shared with the Android app.
			"obsidianmd/ui/sentence-case": ["warn", { ignoreWords: ["VaultMate"] }],
		},
	},
]);
