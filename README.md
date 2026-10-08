# VaultMate for Obsidian

VaultMate is a personal companion plugin for Obsidian, and the in-Obsidian half of the VaultMate Android app. It shares the app's pixel-art, Japanese-inspired look.

> **Status:** early development (0.1.0). The plugin currently adds the VaultMate side panel only. The features below are planned.

## Planned features

- **Decision and prediction journal:** write a decision or a prediction anywhere as a task-style line, such as `- [ ] Move to Lyon #decision [confidence:: 70%] ➕ 2026-10-08 📅 2027-01-08`. The due date is the review date. Review it with a short guided form, and follow your track record and calibration.
- **Challenge questions:** on request, an AI provider you configure reads the current note and returns a few open questions that challenge it. VaultMate shows questions only, never generated prose.
- **Location:** add `latitude`, `longitude` and a place label to a note's properties by searching OpenStreetMap. On Android, the optional VaultMate app can supply the current position, because Obsidian has no access to device location.
- **Collection recommendations:** on request, an AI provider suggests titles from a taste profile built from your own ratings.
- **Context finder:** see which notes are worth reading next to the active note, and why each one was picked. Computed locally.

AI features run only when you ask for them, with the provider, model and prompts you choose.

## Working with the VaultMate Android app

The plugin and the app share data only through Markdown notes and properties in your vault. Review reminders are [Tasks](https://publish.obsidian.md/tasks/)-style lines with a due date, so the app's task widgets show them on the right day.

## Privacy

The plugin collects no telemetry and makes no network requests. See [PRIVACY.md](PRIVACY.md).

## Support

If VaultMate is useful to you, you can support its development through [Buy Me a Coffee](https://buymeacoffee.com/gibbonolive9442).

## Development

```bash
npm install
npm run dev
```

The repository is meant to live in a development vault's `.obsidian/plugins/vaultmate` folder; with the [Hot Reload](https://github.com/pjeby/hot-reload) plugin, Obsidian reloads VaultMate after each rebuild.

Checks, in CI order: `npm run check`, `npm run lint` (Obsidian's review rules), `npm test`, `npm run build`.

Sprites are drawn in the VaultMate Android project (`tools/sprites`). Copy a new sprite once into `assets/sprites/`, then refresh all of them with `npm run sync-sprites -- <path to the Android project>`.

## Releases

The release workflow runs when you push a Git tag. Before tagging, update `manifest.json` and `versions.json`, commit the version change, and verify the checks above. The tag must exactly match `manifest.json` (for example, `0.1.0`, not `v0.1.0`). The workflow creates a GitHub release with `main.js`, `manifest.json`, and `styles.css` attached.
