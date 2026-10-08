// Copies VaultMate sprites from the Android project, where every sprite is drawn and built
// (obsidian_widget/tools/sprites), into assets/sprites. Run after adding or redrawing a sprite.
//   npm run sync-sprites -- [path to obsidian_widget]
import fs from "node:fs";
import path from "node:path";

const androidProject = process.argv[2] ?? "../../../../obsidian_widget";
const source = path.join(androidProject, "app/src/main/res/drawable-nodpi");
const target = "assets/sprites";

if (!fs.existsSync(source)) {
	console.error(`Sprite folder not found: ${source}`);
	process.exit(1);
}

let copied = 0;
for (const file of fs.readdirSync(target)) {
	if (!file.endsWith(".png")) continue;
	const built = path.join(source, `px_${file}`);
	if (!fs.existsSync(built)) {
		console.error(`Missing in the Android project: px_${file}`);
		process.exitCode = 1;
		continue;
	}
	fs.copyFileSync(built, path.join(target, file));
	copied++;
}
console.log(`Synced ${copied} sprites from ${source}`);
