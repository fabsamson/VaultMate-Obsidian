// Copies the shared contract cases (tests/contract) to the Android project's unit-test resources, where its
// tests read them. The plugin owns the cases; run after changing them.
//   npm run sync-contract -- [path to obsidian_widget]
import fs from "node:fs";
import path from "node:path";

const androidProject = process.argv[2] ?? "../../../../obsidian_widget";
const source = "tests/contract";
const target = path.join(androidProject, "app/src/test/resources/contract");

if (!fs.existsSync(path.join(androidProject, "app/src/test"))) {
	console.error(`Android project not found: ${androidProject}`);
	process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
const copied = fs.readdirSync(source, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).length;
console.log(`Synced ${copied} contract files to ${target}`);
