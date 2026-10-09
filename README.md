# VaultMate for Obsidian

VaultMate is a personal companion plugin for Obsidian, and the in-Obsidian half of the VaultMate Android app. It shares the app's pixel-art, Japanese-inspired look.

> **Status:** early development (0.1.0). The decision and prediction journal and the AI actions are available. The other features below are planned.

## Decision journal

Write a decision or a prediction anywhere in a note as a task-style line, such as `- [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08`. The due date is the review date, so the Tasks plugin and the VaultMate app show it on the right day. The tag names can be changed in the settings; the journal can be turned off there.

- **Capture:** type `#decision` (or `#prediction`) and a space at the end of a line, or start a line with `Decision:` (also `Décision :`, `Prediction:`, `Prédiction :`), and pick a review date. The commands **New decision**, **New prediction**, **Track this line as a decision** and **Track this line as a prediction** open a short form. They work on mobile; add them to the mobile toolbar in the Obsidian settings.
- **Badge:** a small label at the end of each decision or prediction line shows its state (for example "Decision · review in 3 months" or "Decision · 3 days overdue"). Click it to review the entry, or to track a line. Live Preview and source mode only; reading view shows no badge.
- **Track record:** the hub's "Track record" section shows hanko stamps for hits, misses and reviews done, your Brier score and a calibration row per probability band (once five predictions are resolved), a decision quality by outcome table, and the latest lessons from your reviews.
- **Review:** the **Review this line** command, the badge or the panel opens a form that shows what you wrote and expected. Close the entry with its outcome, or review again later. The review is written as a `Review <date>: …` sub-item under the line.
- **Panel:** the Reviews section lists open entries as overdue, this week, upcoming, or without a review date. A notice tells you once a day when reviews are due.

## AI actions

An AI action is a Markdown file in your vault: a prompt, the data it may send, and the kind of answer you want. VaultMate runs it only when you click, shows exactly what will be sent first, and keeps only short questions from the answer. It never shows free-form AI text.

- **Default action:** **Create default actions** in the settings writes *Challenge this note* to the actions folder (`VaultMate/AI actions` by default). It sends the current note and returns about five open questions that challenge it. Insert the ones you want under a `## Questions` heading, or copy them. To make them tasks that the VaultMate app lists as open questions, change the action's `line` to `- [ ] {{text}} #question`.
- **Running an action:** run **Open AI actions** from the command palette, or use the **AI** section of the VaultMate panel, which runs on the most recent note. An action with `command: true` also gets its own command, `AI: <name>`, that you can add to the mobile toolbar.
- **Nothing is sent without your click.** The run window shows the provider and model, each source with its size (and whether it was truncated), the note concerned and the total. The first time an action runs, and whenever its list of sources changes, you must tick *Send this to <provider>*. Then you click **Send**. **Ask again** is another explicit click and another call.
- **Provider:** in the settings, under AI actions, set an OpenAI-compatible base URL (HTTPS, except `localhost` and `127.0.0.1`), a model, and an API key secret chosen from Obsidian's secret storage. The key is never saved in the plugin's settings. A local server needs no key.
- **Questions only:** the answer must be JSON; VaultMate keeps questions of one sentence ending with a question mark, at most 160 characters, without duplicates or questions already in the note, and drops everything else.

### Writing an action file

```markdown
---
vaultmate-action: 1
name: Devil's advocate
description: Questions that argue against the note.
icon: swords
command: true
sources:
  - note
  - properties
output: questions
count: 5
insert:
  heading: Questions
  line: "- {{text}}"
---
Argue against the note's main claim. Return only questions. Ask {{count}} of them, one sentence each.
```

- `vaultmate-action: 1` and `name` are required. `description` and `icon` (a Lucide icon name, default `sparkles`) are optional.
- `sources` lists what is sent: `note` (title and text, without properties, code blocks or link targets; 24,000 characters at most), `selection` (the selected text when you start the action; 8,000) and `properties` (the note's properties as `key: value` lines; 2,000).
- `output` is `questions`. `count` is 1 to 10 (default 5) and replaces `{{count}}` in the prompt.
- `insert` is optional. `heading: Questions` adds the lines at the end of that section, or creates `## Questions` at the end of the note; `at: cursor` adds them at the cursor. `line` must contain `{{text}}` (default `- {{text}}`). Without `insert`, the questions are only shown and can be copied.
- The text below the properties is the prompt. VaultMate adds the answer format after it, so a prompt cannot break the parsing.
- A file that is invalid, or that uses something not available yet, is listed in **Open AI actions** with the reason, and cannot be run.

## Planned features

- **Location:** add `latitude`, `longitude` and a place label to a note's properties by searching OpenStreetMap. On Android, the optional VaultMate app can supply the current position, because Obsidian has no access to device location.
- **Collection recommendations:** on request, an AI provider suggests titles from a taste profile built from your own ratings, as another AI action.
- **Context finder:** see which notes are worth reading next to the active note, and why each one was picked. Computed locally.

AI features run only when you ask for them, with the provider, model and prompts you choose.

## Working with the VaultMate Android app

The plugin and the app share data only through Markdown notes and properties in your vault. Review reminders are [Tasks](https://publish.obsidian.md/tasks/)-style lines with a due date, so the app's task widgets show them on the right day.

## Privacy

The plugin collects no telemetry. Its only network request is an AI action you run, sent to the AI provider you configured, with the content you previewed. See [PRIVACY.md](PRIVACY.md).

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
