# VaultMate for Obsidian

VaultMate is a personal companion plugin for Obsidian, and the in-Obsidian half of the VaultMate Android app. It shares the app's pixel-art, Japanese-inspired look.

> **Status:** early development (0.8.0). The decision and prediction journal, ideas, project tracks, the AI actions (*Challenge this note* and *Recommend me*), the place search and new connections are available.

## Decision journal

Write a decision or a prediction anywhere in a note as a task-style line, such as `- [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08`. The due date is the review date, so the Tasks plugin and the VaultMate app show it on the right day. The tag names can be changed in the settings; the journal can be turned off there.

- **Capture:** type `#decision` (or `#prediction`) and a space at the end of a line, or start a line with `Decision:` (also `Décision :`, `Prediction:`, `Prédiction :`), and pick a review date. The commands **New decision**, **New prediction**, **Track this line as a decision** and **Track this line as a prediction** open a short form. They work on mobile; add them to the mobile toolbar in the Obsidian settings.
- **Answer:** when the statement is a question ("Should I move to Lyon?", "Who wins the league?"), the optional **Answer** field of the forms records your decision or your predicted answer on the line, before the confidence: `- [ ] Should I move to Lyon? #decision [answer: yes, in January] [confidence: 70%] ➕ 2026-10-15 📅 2027-01-15`. It is kept on one line (square brackets become parentheses) and is shown again as a reminder when you review the entry. It is set when you create or track an entry, not afterwards; **Track as…** shows the answer already on the line, and an empty field keeps it.
- **Badge:** a small label at the end of each decision or prediction line shows its state (for example "Decision · review in 3 months" or "Decision · 3 days overdue"). Click it to review the entry, or to track a line. Live Preview and source mode only; reading view shows no badge.
- **Track record:** the hub's "Track record" section shows hanko stamps for hits, misses and reviews done, your Brier score and a calibration row per probability band (once five predictions are resolved), a decision quality by outcome table, and the latest lessons from your reviews.
- **Review:** the **Review this line** command, the badge or the panel opens a form that shows what you wrote and expected. Close the entry with its outcome, or review again later. The review is written as a `Review <date>: …` sub-item under the line.
- **Panel:** the Reviews section lists open entries as overdue, this week or upcoming. A notice tells you once a day when reviews are due.
- **Not tracked yet:** lines that carry the tag but have no review date, such as a plain bullet `- Rent will go up next year #decision` or a task without 📅, are listed in their own group with **Track as decision** for a `#decision` line or **Track as prediction** for a `#prediction` line, like the badge. A tagged line is only tracked as the kind of its tag.
- **Closed without a review:** an entry ticked done without its review (a decision without `[outcome: …]` or `[quality: …]`, a prediction without `[result: …]`) is listed in its own group under the Reviews, and counted under the track record instead of being ignored. **Add the outcome** opens the review form with the fields already on the line filled in; it writes only the missing fields, keeps the box ticked and the existing ✅ date, and adds a `Review <date>: …` sub-item only if you typed a note. **Not reviewable** turns the box into `[-]` (cancelled) so the entry leaves the list and your statistics; **Undo** shows for a few seconds.

## Ideas

Write an idea anywhere in a note and sort it later. An idea is a task-style line with the idea tag, such as `- [ ] Prepare a sprint like a kitchen mise en place #idea ➕ 2026-10-13`; a line with the tag that is not a task yet counts too. Once you have dealt with it, the line is closed and says what became of it: `- [x] … #idea [result: added] ➕ 2026-10-13 ✅ 2026-10-15`, with a sub-item such as `Added to [[Cooking]]`, `New note: [[Mise en place]]`, `Track in [[Cooking app]]: Mise en place` or `Dropped: not now`. The result is `new-note`, `added`, `track`, `decision`, `prediction` or `dropped`. Everything stays plain Markdown, so Tasks queries and the VaultMate app read the same lines. The ideas feature and its tag can be changed or turned off in the settings, under Ideas.

- **Capture:** type `#idea` and a space at the end of a line, or start a line with `Idea:` (also `Idée :`), to plant it as a task with today's date. The command **Track this line as an idea** does the same for the line at the cursor.
- **Badge:** a small label at the end of each idea line: `Idea · 3 days` for an open idea, `Idea` for a tagged line that is not a task yet, and for a processed one `Added · <note>`, `New note · <note>`, `Track · <project>`, `Decision`, `Prediction`, `Dropped` or `Done`. Click an open idea's badge to process it, or a processed one's to open the note it went to. Live Preview and source mode only; reading view shows no badge.
- **Process an idea:** the badge, the **Process idea on this line** command or the Ideas page opens a form with the idea and where it was planted, then one row of actions and no field. Choose an action to see only its fields, with one button that Enter also presses; choosing another action replaces them. The optional note is hidden behind an **Add a note** link (**Add a reason** for Drop).
  - **Add to a note:** type or pick an existing note (not the idea's own), choose the heading and **Add to <note>**. The tracks of a project note are listed first, so the idea can join a track; the first heading with "idea" in it is preselected, else the end of the note. The idea goes in as a plain bullet with its sub-bullets, without the tag or the checkbox, and the idea line is closed with `Added to [[…]]`. If the chosen heading has gone in the meantime, nothing is written. A name that matches no note disables the button ("No note with this name: use New note").
  - **New note:** a **Short name** (prefilled from the idea) and **Create "<name>"** makes a new note in the folder set in the settings (or where Obsidian puts new notes), from the template you chose or from the idea and a link back to its note. Nothing is ever overwritten: if the name already exists, the idea is added to that note.
  - **New track:** pick a project note (the idea's own note when it is one), a status (Explore by default), a **Short name** and, for In progress, an optional first task. In the idea's own note the idea moves into the Tracks section, like a promoted bullet. In another project note the track is added first, then the idea is closed as `track` with `Track in [[Project]]: <short name>`, and its sub-bullets are copied. A name already used by a track of the project only warns.
  - **Decision** or **Prediction** opens the usual form with the idea as its statement and writes the journal line as a sub-task of the idea.
  - **Project seed** (only when the **Project seed sub-tag** setting is filled): the tag becomes `#idea/<sub-tag>` and the line stays open. A seed waits for a project: it leaves the lists to tend and the idea boxes of project notes.
  - **Drop** closes the idea; the optional reason is kept as `Dropped: …`.
- **Ideas page:** the panel's **Ideas** page (or the **Open ideas** command) shows a summary of the month, then the open ideas as fresh (0 to 2 days), waiting (3 to 14) and wilting (older), each with **Process** and **Drop** (**Undo** shows for a few seconds), and the processed ideas with a filter by result (including **Track**) and, when project seeds are on, a line such as "2 project seeds waiting". Pick the whole vault, this note or a folder note's tree with the scope list.
- **Tend fresh ideas:** the button on the page or the command goes through the fresh ideas one by one, oldest first ("Idea 2 of 5"), with the same form and a **Skip** action.
- **Local only:** ideas are read from your notes on your device. Nothing is sent anywhere.

## Projects

A note is a project when its `tags` property contains the **Project tag** (`project` by default; set it in the settings under Projects). The tag is compared exactly, ignoring case, in a list or in a text value (`projet, work`); a leading `#` is ignored. A subtag such as `project/finance`, a `#project` written in the text and the `tag` property do not count. No section is needed; the **Make this note a project** command adds the tag to the note you are editing (a missing `tags` property is created, a text value becomes a list). A project note can keep its raw ideas in an **Ideas** section and its work in a **Tracks** section. Each track is a heading one level below the Tracks section, and the first character of the heading is its status: `★` Explore, `📥` Backlog, `🔨` In progress, `✅` Done, `🗑️` Dropped. Changing the status changes that character; the track's block never moves.

```markdown
# 💡 Ideas
- a raw idea (sub-bullets are its details)
# 🧭 Tracks
## ★ Explore this
## 📥 Decided, not started
## 🔨 Being built · F1
- [ ] Write the parser ➕ 2026-10-14 📅 2026-10-18
## ✅ Finished
## 🗑️ Dropped
```

The title after the marker is never changed by VaultMate. A heading with no marker reads as Explore, `⭐` reads as `★`, and the space after the marker is optional when reading. A section is recognized by its title, ignoring case and accents: the Ideas section contains `idea` or `idée`, the Tracks section contains `🧭` or the word `track` or `piste`.

- **Projects page:** the panel's **Projects** page shows, for each project note, its ideas and a board with one column per status, each card with its open tasks and the next one. Done and dropped tracks are hidden until you turn on **Show done and dropped**. Pick the whole vault, this note or a folder note's tree with the scope list.
- **Ideas box:** it lists the bullets of the Ideas section and the open `#idea` lines of the note, wherever they are (a task or a plain tagged line, in the Ideas section, in a track or anywhere else); project seeds, closed ideas and code are left out. **Promote** opens a form with the status (Explore by default), a **Short name** and, for In progress, an optional first task. The track is added at the end of the Tracks section with the short name as its heading; when the short name differs from the idea's text, the full text is the first line of the block, and the sub-bullets follow. The idea moves (its line and sub-bullets leave their place). **Drop** removes a bullet and closes a tagged idea as dropped (**Undo** shows for a few seconds). If the note has no Tracks section yet, a promotion creates one after the Ideas section (at the end of the note when it has none), using the **Tracks section title** setting.
- **Buttons:** each card has a main button (Explore: **To backlog**, Backlog: **Start**, In progress: **Done**, Done: **Reopen**, Dropped: **Restore**) and a **Move to…** menu. **Start** and **Add task** ask for a task and an optional due date, written as `- [ ] <task> ➕ <today> 📅 <due>` at the end of the track. An In progress track with no open task shows **No next task**.
- **Commands:** **Move this track…**, **Promote this idea to a track** (also on a tagged idea line) and **Add a task to this track** work on the note you are editing, from the cursor, and can be undone with Ctrl+Z. **Convert this note to tracks** turns an older project note (sections of ideas, improvements, backlog and work in progress that hold sub-headings and bullets) into a Tracks section in one undoable change, then tells you how many tracks it made.
- **Tasks of a track:** all the task lines of the block, except those tagged with the idea, decision or prediction tag or `#question`: those are ideas, reviews and questions, not work.
- **Safe writes:** every change checks that the line it targets still reads as it did when it was shown; otherwise nothing is written. Other notes are changed through `Vault.process`, the note you are editing through the editor.
- **First-run check:** once per vault, if 20 or more lines carry the idea tag without being tasks, or 20 or more notes carry the Project tag, a dialog shows the counts and where to change the tags. It only informs; nothing is written.
- **Local only:** projects are read from your notes on your device. Nothing is sent anywhere. Turn the feature, change the Project tag or the title of new Tracks sections in the settings under Projects.

## AI actions

An AI action is a Markdown file in your vault: a prompt, the data it may send, and the kind of answer you want. VaultMate runs it only when you click, shows exactly what will be sent first, and keeps only short questions or suggestion cards from the answer. It never shows free-form AI text.

- **Default actions:** **Create default actions** in the settings writes *Challenge this note* and *Recommend me* to the actions folder (`VaultMate/AI actions` by default). *Challenge this note* sends the current note and returns about five open questions that challenge it. Insert the ones you want under a `## Questions` heading, or copy them. To make them tasks that the VaultMate app lists as open questions, change the action's `line` to `- [ ] {{text}} #question`.
- **Recommend me:** the second default action. Choose a type (Movies, Series, Manga...), and VaultMate sends the rated notes of that type (your 25 best and 10 lowest, with year, rating, genres and creators) plus the titles you already have, so they are not suggested again. You get about five cards: title, year, creator, "Because you rated <title> 8/10" and one sentence. **Search** opens a web search for the title in your browser (DuckDuckGo); VaultMate itself makes no request for it. **Copy title** copies the title. **Not interested** hides the title from future suggestions of that type (stored in the plugin's `data.json`, with an **Undo**). It needs at least three rated notes of the type. Under **Based on** you can instead pick **one entry** of the type (rated or not; the one in the open note is preselected): VaultMate then sends only that entry (title, year, rating, genres, creators and its `plot` property, cut at 400 characters) and the titles to exclude, and the cards say "Because you rated <title> 8/10" or, for an entry you have not rated, "Close to <title>". One entry is enough, rated or not. AI suggestions can be wrong: a title may not exist or be credited to the wrong person.
- **Collection settings:** under Collections in the settings, choose the folder of your collection notes (empty = the whole vault), the property that holds the type (default `type`, with values such as `movie`, `series`, `manga`, `game`, `book` or `boardgame`) and the property that holds your rating (default `rating`, from 0 to 10; 0 or empty means not rated, like in the VaultMate app). Only the properties of the notes are read (title, year, genres, director, author, studio, developers), never their text.
- **Running an action:** run **Open AI actions** from the command palette, or use the **AI** section of the VaultMate panel, which runs on the most recent note. An action with `command: true` also gets its own command, `AI: <name>`, that you can add to the mobile toolbar.
- **Nothing is sent without your click.** The run window shows the provider and model, each source with its size (and whether it was truncated), the note concerned and the total. The first time an action runs, and whenever its list of sources changes, you must tick *Send this to <provider>*. Then you click **Send**. **Ask again** is another explicit click and another call.
- **Provider:** in the settings, under AI actions, set an OpenAI-compatible base URL (HTTPS, except `localhost` and `127.0.0.1`), a model, and an API key secret chosen from Obsidian's secret storage. The key is never saved in the plugin's settings. A local server needs no key.
- **Questions or suggestions only:** the answer must be JSON; VaultMate keeps questions of one sentence ending with a question mark, at most 160 characters, without duplicates or questions already in the note, and drops everything else. For suggestions it keeps a title (one line, at most 120 characters), an optional four-digit year and creator (at most 80), at most two reasons that are titles you really rated, and one sentence of at most 160 characters; it drops any title already in your vault or marked as not interested.

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
- `sources` lists what is sent: `note` (title and text, without properties, code blocks or link targets; 24,000 characters at most), `selection` (the selected text when you start the action; 8,000), `properties` (the note's properties as `key: value` lines; 2,000) and `collection-profile` (the rated notes of one collection type and the titles to exclude, as above; 12,000, and the preview says when it was cut). `collection-profile` needs the `type` parameter and does not need an open note.
- `output` is `questions` or `suggestions`. `suggestions` needs the `collection-profile` source and has no `insert`. `count` is 1 to 10 (default 5) and replaces `{{count}}` in the prompt.
- `params` asks for a value before the preview. The first kind of choice is `collection-types`: `params: { type: { label: Type, choices: collection-types } }` shows a list of the types found in your collection notes, with their counts (for example "Movies (42 rated)"), and `{{type}}` in the prompt becomes the chosen label. The second kind, `collection-entries`, lists the entries of the chosen type, rated or not, as "Title (year) · 8/10" or "Title (year) · not rated" (best rated first), after "All my ratings" (the default). It depends on the type, so declare it after `type`: `params: { type: { label: Type, choices: collection-types }, entry: { label: Based on, choices: collection-entries } }`. `{{based_on}}` in the prompt becomes "the titles they rated high and low" or "the title “<title>”". Any other `choices` makes the action unavailable, with a message.
  - *Create default actions* never overwrites a file. To get **Based on** in an existing `Recommend me.md`, add the `entry` parameter under `params` as above, and write `close to {{based_on}}` in the prompt where it said "based on what they rated high and low".
- `insert` is optional. `heading: Questions` adds the lines at the end of that section, or creates `## Questions` at the end of the note; `at: cursor` adds them at the cursor. `line` must contain `{{text}}` (default `- {{text}}`). Without `insert`, the questions are only shown and can be copied.
- The text below the properties is the prompt. VaultMate adds the answer format after it, so a prompt cannot break the parsing.
- A file that is invalid, or that uses something not available yet, is listed in **Open AI actions** with the reason, and cannot be run.

## Location

**Search a place** adds a place to the active note's properties. Type a name, an address or a city, press Enter (or **Search**), pick a result, edit the label if you like, and **Add to note**. The same commands and buttons are on the **Places** page of the panel, which also shows the current note's place with a link to OpenStreetMap.

- **Properties:** `latitude` and `longitude` (numbers, 5 decimals) and `location` (the label). The three names can be changed in the settings, under Location. Only these three properties are written, and only through Obsidian's property API. If the note already has a different value in one of them, VaultMate shows the old and new values and asks before replacing it. The same values again change nothing.
- **OpenStreetMap search:** the search uses [Nominatim](https://nominatim.org/), the public OpenStreetMap search service. A request is sent only when you press Enter or **Search**, never while you type, and at most one per second, as the [usage policy](https://operations.osmfoundation.org/policies/nominatim/) asks. The request carries only your search text, plus a rectangle of about 110 km around the last place you used on this device (to rank nearby results first; it does not restrict them). VaultMate identifies itself with a `User-Agent` header of the form `VaultMate-Obsidian/<version> (+https://github.com/fabsamson/VaultMate-Obsidian)`. Results are © OpenStreetMap contributors, under the [ODbL](https://www.openstreetmap.org/copyright).
- **Show notes on a map:** create a Base (Bases core plugin), add a **Map** view, and set **Marker coordinates** to the formula `[latitude, longitude]` (use your own property names). This needs the Maps plugin that provides the Map view.

## New connections

The **New connections** page of the panel (or the **Show new connections** command) looks for notes that are not connected to the current note yet, but whose ideas could work with it. It shows at most 3 (you can choose 1 to 5), and "No new connection for this note yet" is a normal answer. Notes linked either way, notes cited together with it by a third note (an index, a map, a daily note), notes two links away, notes without text of their own and excluded folders are never proposed. The folder of a note plays no part in the choice.

- **Reasons:** distinctive words both notes use (the vocabulary of the current note's own neighbourhood does not count, and at least two words are needed); a note that names this note (title or alias) without a link, or that this note names (a single-word name counts only next to shared words); the same value in a people or place property (`author`, `people`); and a place within a kilometre (`latitude` and `longitude`). Titles that are dates, or a single common word, are not used to find mentions.
- **Each card:** the note title (click to open it, Ctrl or Cmd click for a new tab), "Both are about" the two most telling shared words, where the note is (and "another area" when it sits in a different top-level folder), a passage of each note around the shared words, the reasons, **Insert link** (at the cursor, when the current note is open in an editor), **Copy link** and **Not useful**.
- **Not useful:** hides that pair of notes for good, in both directions, and the next best connection takes its place. A message lets you undo it. The hidden pairs are stored in `data.json`, so they follow you to your other devices with your sync.
- **Computed on your device:** the first search indexes the text of your notes, which takes a few seconds on a large vault; the page shows the progress and the time it took. The index is cached in the app's IndexedDB on each device (it is not synced) and kept current as notes change. Nothing is sent anywhere.
- **Settings:** under New connections, turn the feature off, exclude folders (their notes are never proposed), choose the people and place properties, and set the maximum number of connections.

AI features run only when you ask for them, with the provider, model and prompts you choose.

## Working with the VaultMate Android app

The plugin and the app share data only through Markdown notes and properties in your vault. Review reminders are [Tasks](https://publish.obsidian.md/tasks/)-style lines with a due date, so the app's task widgets show them on the right day.

### Current position

Obsidian cannot read the device's location, so on Android the optional VaultMate app can supply it. Turn on **Use the VaultMate Android app for the current position** in the settings (off by default; it needs the VaultMate app). The command **Add current location** (and the button on the Places page) then asks the app for the position and writes it with the same checks as the place search. **Test the Android app link** checks that values survive the trip between Obsidian and the app.

### Link contract

For the app's developers. All values are percent-encoded UTF-8 in the query string, one parameter per value (never a `lat,lng` pair); both sides decode them.

1. **Request** (Obsidian to app): `vaultmate://location?nonce=<nonce>`. The nonce is 32 lowercase hex characters (128 random bits), valid for 2 minutes and for one answer.
2. **Answer** (app to Obsidian): `obsidian://vaultmate-location?nonce=<nonce>&lat=<lat>&lng=<lng>&accuracy=<metres>&label=<text>`, with the same nonce.
   - `lat`, `lng`: plain decimals with a dot, up to 10 decimals, no comma, no `+`, no exponent, no unit: `45.76404`, `-3.5`. Range -90 to 90 and -180 to 180.
   - `accuracy`: optional, metres, non-negative decimal.
   - `label`: optional text (a neighbourhood or a city), at most 120 characters.
   - On failure, send `error=<short message>` instead of the position (for example a refused permission). The nonce is used up either way.
3. **Echo test:** `vaultmate://echo?nonce=<nonce>&lat=45.76404&lng=4.83566&label=Caf%C3%A9%20%26%20Co%20%2F%20Lyon` must be answered with `obsidian://vaultmate-echo?nonce=<nonce>&lat=<lat>&lng=<lng>&label=<label>` carrying the decoded values unchanged (`Café & Co / Lyon`, re-encoded). Obsidian compares them exactly and reports which parameter changed.
4. A nonce is accepted once, only on the device that created it, and less than 2 minutes after its creation. Anything else is refused and nothing is written.

### Idea link

For the app's developers. The Ideas list of the VaultMate Android app opens an idea in Obsidian with:

`obsidian://vaultmate-idea?vault=<vault name>&file=<path>&line=<index>`

- `vault`: handled by Obsidian itself.
- `file`: the note's path relative to the vault, percent-encoded, with or without `.md` (the same path as for `obsidian://open`).
- `line`: the 0-based index of the idea's line, as the app read it.

When the Ideas feature is on, the plugin opens the note (in the pane already showing it, else the current one), puts the cursor on that line and opens the idea portal for it. If the note changed since the app read it, it uses the nearest open idea within 3 lines; if there is none, the note stays open at the line with a message. A processed idea is not reopened. A missing note, a missing `file` or a `line` that is not a non-negative integer is refused with a message. The link only opens: it never writes, and every change still needs a click in the portal.

### Review link

For the app's developers. The VaultMate Android app shows a **Review** button, instead of a checkbox, on every open decision or prediction. It opens the entry in Obsidian with:

`obsidian://vaultmate-review?vault=<vault name>&file=<path>&line=<index>`

- `vault`: handled by Obsidian itself.
- `file`: the note's path relative to the vault, percent-encoded, with or without `.md` (the same path as for `obsidian://open`).
- `line`: the 0-based index of the entry's line, as the app read it.

When the decision journal is on, the plugin opens the note (in the pane already showing it, else the current one), puts the cursor on that line and opens the review form. If the note changed since the app read it, it uses the nearest decision or prediction within 3 lines that still needs a review; if there is none, the note stays open at the line with a message. An entry ticked without a review opens **Add the outcome** instead; an entry already reviewed or cancelled only gets a message. A missing note, a missing `file` or a `line` that is not a non-negative integer is refused with a message. The link only opens: it never writes, and every change still needs a click in the form.

### Back link and daily note

For the app's developers. The idea link and the review link accept an optional `back=app`. On mobile, once the window the link opened is closed, the plugin opens the app with:

`vaultmate://back?kind=<idea|review|daily>&result=<done|cancel|error>`

- `kind=idea` or `kind=review`: `result=done` when the portal or the form wrote something, `result=cancel` when it was closed without a change (a skipped idea, Escape). No link is sent when the link only ended with a message (note not found, entry already processed), or when you choose to open the note from the portal.
- Without `back=app`, or on desktop, nothing changes.

A third link asks Obsidian to create today's daily note:

`obsidian://vaultmate-daily?vault=<vault name>&back=app`

The plugin runs the Daily notes core plugin's own command (open or create today's note, with your template), waits up to 10 seconds for the note to exist, then, with `back=app` on mobile, opens `vaultmate://back?kind=daily&result=done`. If the Daily notes core plugin is turned off or the note does not appear, a message says so and the result is `error`. The link never writes anything itself.

## Privacy

The plugin collects no telemetry. Its network requests are the AI actions you run (sent to the AI provider you configured, with the content you previewed) and the place searches you start (sent to OpenStreetMap Nominatim, with your search text only). See [PRIVACY.md](PRIVACY.md).

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
