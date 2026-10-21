# VaultMate for Obsidian

VaultMate keeps a journal of your decisions and predictions, with review dates, reviews and a track record of how well you judged. It also collects ideas you sort later, moves project tracks from idea to done, and offers optional AI actions that run only when you ask, a place search and suggestions of new connections between notes. Everything is plain Markdown lines in your own notes, it works on desktop and mobile, and your notes stay on your device. It works fully on its own.

Current version: 0.12.0.

![Writing a decision, its badge in the note and its review](https://raw.githubusercontent.com/fabsamson/VaultMate-Obsidian/main/docs/media/decision.gif)

Write a decision, see its badge, review it when the date comes.

![Tending fresh ideas one by one](https://raw.githubusercontent.com/fabsamson/VaultMate-Obsidian/main/docs/media/tend-ideas.gif)

Tend fresh ideas: sort each one into a note, a track, a decision or the bin.

![The track record of decisions and predictions](https://raw.githubusercontent.com/fabsamson/VaultMate-Obsidian/main/docs/media/track-record.gif)

The track record: hits, misses, calibration and the lessons of your reviews.

## Install

VaultMate is not in the Community plugins directory yet; it will be installable from there once it is accepted. Until then:

- **With BRAT:** install the BRAT plugin, run *BRAT: Add a beta plugin for testing*, and enter the repository `fabsamson/VaultMate-Obsidian`.
- **Manually:** download `main.js`, `manifest.json` and `styles.css` from the latest [GitHub release](https://github.com/fabsamson/VaultMate-Obsidian/releases), put them in `<your vault>/.obsidian/plugins/vaultmate/`, then reload Obsidian and enable VaultMate under Community plugins.

## Quick start

1. Open the VaultMate panel from the ribbon icon or with the **Open panel** command.
2. In any note, write a decision and end the line with `#decision ` (a space after the tag). Pick a review date in the list that appears. The line becomes a task-style line with a badge at its end.
3. Capture an idea the same way: end a line with `#idea `.
4. Open the **Ideas** page of the panel and press **Process** on the idea to turn it into a note, a decision, a project track, or to drop it.
5. Make a note a project with the **Make this note a project** command, or create one with **New project…**. Its page lists tracks you can start, move and finish.
6. When a review date comes, click the decision's badge (or use **Review this line**) to record what happened.

The sections below describe each feature in detail.

## Decision journal

Write a decision or a prediction anywhere in a note as a task-style line, such as `- [ ] Move to Lyon #decision [confidence: 70%] ➕ 2026-10-08 📅 2027-01-08`. The due date is the review date, so the Tasks plugin and the VaultMate app show it on the right day. The tag names can be changed in the settings; the journal can be turned off there.

- **Capture:** type `#decision` (or `#prediction`) and a space at the end of a line, or start a line with `Decision:` (also `Décision :`, `Prediction:`, `Prédiction :`), and pick a review date. The commands **New decision**, **New prediction**, **Track this line as a decision** and **Track this line as a prediction** open a short form. They work on mobile; add them to the mobile toolbar in the Obsidian settings.
- **Answer:** when the statement is a question ("Should I move to Lyon?", "Who wins the league?"), the optional **Answer** field of the forms records your decision or your predicted answer on the line, before the confidence: `- [ ] Should I move to Lyon? #decision [answer: yes, in January] [confidence: 70%] ➕ 2026-10-15 📅 2027-01-15`. It is kept on one line (square brackets become parentheses) and is shown again as a reminder when you review the entry. It is set when you create or track an entry, not afterwards; **Track as…** shows the answer already on the line, and an empty field keeps it.
- **Badge:** a small label at the end of each decision or prediction line shows its state (for example "Decision · review in 3 months" or "Decision · 3 days overdue"). Click it to review the entry, or to track a line. Live Preview and source mode only; reading view shows no badge.
- **Track record:** the hub's "Track record" section shows hanko stamps for hits, misses and reviews done, your Brier score and a calibration row per probability band (once five predictions are resolved), a decision quality by outcome table, and the latest lessons from your reviews.
- **Review:** the **Review this line** command, the badge or the panel opens a form that shows what you wrote and expected. Close the entry with its outcome, or review again later. The review is written as a `Review <date>: …` sub-item under the line.
- **Panel:** the Reviews section lists open entries as not tracked yet, overdue, this week or upcoming. A notice tells you once a day when reviews are due.
- **Not tracked yet:** lines that carry the tag but have no review date, such as a plain bullet `- Rent will go up next year #decision` or a task without 📅, are listed in their own group, the first of the Reviews section (five rows, then **Show n more**; it follows the chosen kind and is hidden when empty), with **Track as decision** for a `#decision` line or **Track as prediction** for a `#prediction` line, like the badge. A tagged line is only tracked as the kind of its tag.
- **Closed without a review:** an entry ticked done without its review (a decision without `[outcome: …]` or `[quality: …]`, a prediction without `[result: …]`) is listed in its own group under the Reviews, and counted under the track record instead of being ignored. **Add the outcome** opens the review form with the fields already on the line filled in; it writes only the missing fields, keeps the box ticked and the existing ✅ date, and adds a `Review <date>: …` sub-item only if you typed a note. **Not reviewable** turns the box into `[-]` (cancelled) so the entry leaves the list and your statistics; **Undo** shows for a few seconds.

## Ideas

Write an idea anywhere in a note and sort it later. An idea is a task-style line with the idea tag, such as `- [ ] Prepare a sprint like a kitchen mise en place #idea ➕ 2026-10-13`; a line with the tag that is not a task yet counts too. Once you have dealt with it, the line is closed and says what became of it: `- [x] … #idea [result: added] ➕ 2026-10-13 ✅ 2026-10-15`, with a sub-item such as `Added to [[Cooking]]`, `New note: [[Mise en place]]`, `Track in [[Cooking app]]: Mise en place` or `Dropped: not now`. The result is `new-note`, `added`, `track`, `decision`, `prediction` or `dropped`. Everything stays plain Markdown, so Tasks queries and the VaultMate app read the same lines. The ideas feature and its tag can be changed or turned off in the settings, under Ideas.

- **Capture:** type `#idea` and a space at the end of a line, or start a line with `Idea:` (also `Idée :`), to plant it as a task with today's date. The command **Track this line as an idea** does the same for the line at the cursor.
- **Badge:** a small label at the end of each idea line: `Idea · 3 days` for an open idea, `Idea` for a tagged line that is not a task yet, and for a processed one `Added · <note>`, `New note · <note>`, `Track · <project>`, `Decision`, `Prediction`, `Dropped` or `Done`. Click an open idea's badge to process it, or a processed one's to open the note it went to. Live Preview and source mode only; reading view shows no badge.
- **Process an idea:** the badge, the **Process idea on this line** command or the Ideas page opens a form with the idea and where it was planted, then one row of icon buttons (New note, New track, Drop, Add to a note, Decision, Prediction, Project seed and, when tending, Skip) and no field; each icon names itself in a tooltip. Choose an action, shown pressed, to see its name and only its fields, with one button that Enter also presses; choosing another action replaces them. The optional note is hidden behind an **Add a note** link (**Add a reason** for Drop).
  - **Add to a note:** type or pick an existing note (not the idea's own), choose the heading and **Add to <note>**. The tracks of a project note are listed first, so the idea can join a track; the first heading with "idea" in it is preselected, else the end of the note. The idea goes in as a plain bullet with its sub-bullets, without the tag or the checkbox, and the idea line is closed with `Added to [[…]]`. If the chosen heading has gone in the meantime, nothing is written. A name that matches no note disables the button ("No note with this name: use New note").
  - **New note:** a **Short name** (prefilled from the idea) and **Create "<name>"** makes a new note in the folder set in the settings (or where Obsidian puts new notes), from the template you chose or from the idea and a link back to its note. Nothing is ever overwritten: if the name already exists, the idea is added to that note.
  - **New track:** pick a project note (the idea's own note when it is one; **New project…** creates one and picks it), a status (Explore by default), a **Short name** and, for In progress, an optional first task. In the idea's own note the idea moves into the Tracks section, like a promoted bullet. In another project note the track is added first, then the idea is closed as `track` with `Track in [[Project]]: <short name>`, and its sub-bullets are copied. A name already used by a track of the project only warns.
  - **Decision** or **Prediction** opens the usual form with the idea as its statement and writes the journal line as a sub-task of the idea.
  - **Project seed** (only when the **Project seed sub-tag** setting is filled): the tag becomes `#idea/<sub-tag>` and the line stays open. A seed waits for a project: it leaves the lists to tend and the idea boxes of project notes.
  - **Drop** closes the idea; the optional reason is kept as `Dropped: …`.
- **Ideas page:** the panel's **Ideas** page (or the **Open ideas** command) shows a summary of the month, then the open ideas as fresh (0 to 2 days), waiting (3 to 14) and wilting (older), each with **Process** and **Drop** (**Undo** shows for a few seconds), and the processed ideas with a filter by result (including **Track**) and, when project seeds are on, a line such as "2 project seeds waiting" and a **Project seeds** group: one line per seed, with **Launch** (when Projects is on), **Drop** and **Open** (the note at the seed). **Launch** opens **New project** with the seed's short name; once the project exists, the seed is closed like a new note (`New note: [[Project]]`) and the project note opens. Pick the whole vault, this note or a folder note's tree with the scope list.
- **Tend fresh ideas:** the button on the page or the command goes through the fresh ideas one by one, oldest first ("Idea 2 of 5"), with the same form and a **Skip** action.
- **Local only:** ideas are read from your notes on your device. Nothing is sent anywhere.

## Projects

A note is a project when its `tags` property contains the **Project tag** (`project` by default; set it in the settings under Projects). The tag is compared exactly, ignoring case, in a list or in a text value (`projet, work`); a leading `#` is ignored. A subtag such as `project/finance`, a `#project` written in the text and the `tag` property do not count. No section is needed; the **Make this note a project** command adds the tag to the note you are editing (a missing `tags` property is created, a text value becomes a list), and the **New project…** command creates a new project note: type a name and it creates `<Project folder>/<name>.md`, with the project tag in its `tags` property, and opens it. A name that already exists opens that note instead; nothing is overwritten. The **New project** button of the Projects page does the same. Without a template the note holds `# 💡 Ideas` and `# 📝 Notes` sections; with a **Project template** (a note in your vault) the note is that template, with `{{title}}` and `{{date}}` filled in and the project tag added to its `tags`, and no section added. The template note itself is never listed as a project. A project note can keep its raw ideas in an **Ideas** section and its work in a **Tracks** section. Each track is a heading one level below the Tracks section, and the first character of the heading is its status: `★` Explore, `📥` Backlog, `🔨` In progress, `✅` Done, `🗑️` Dropped. Changing the status changes that character; the track's block never moves.

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

- **Projects page:** the panel's **Projects** page opens on a dashboard with one tile per project: its name, a counter line (In progress, Backlog and Explore seals, then the ideas), **n reviews due** when decisions or predictions of the project are due, and a progress bar: the `progress` property of the note when it holds a number from 0 to 100 (`40`, `40%` and `40 %` are accepted, decimals are rounded, out-of-range values are clamped) with the text **62%**, else **n/m tracks done** (the tracks that are done among all the tracks but the dropped ones); the same rule as the app, and no bar without either, and its next due task with the track it belongs to (the open task with the nearest 📅, overdue ones included; with no dated task, the next task of the first In progress track). Projects with a review due come first, then those with an In progress track; the others are under **Other projects**. Pick the whole vault, this note or a folder note's tree with the scope list; **This note** on a project note opens that project's page directly. A tap on a tile opens the project's page in the same view (the arrow at the top goes back to the dashboard, with the focus on that project's tile, and from the dashboard to the panel's home; the open project is remembered with the layout).
- **Project page:** next to the project's name, the same progress bar as on its tile (the `progress` property, else **n/m tracks done**; nothing without either; on a narrow panel or a phone it moves under the name). A row of chips (**Ideas**, In progress, Backlog, Explore, **Reviews**, **Closed tracks**, with their counts) scrolls to the matching section; only sections that have something get a chip, and a status with no track has no heading. Each track shows its title (it opens the note at the heading), a small bar of its tasks, its open tasks (see **Tasks of a track**), and three icon buttons: the main action (the seal of the status it leads to), **Move to…** (a menu of statuses) and **Add task**. **Done** and **Dropped** tracks are grouped in **Closed tracks**, collapsed at the bottom.
- **Decisions and predictions in a project:** with the Decisions and predictions module on, an open entry with a review date written inside a track's block shows under that track, with **Review** (the same "Time to judge?" review). The project's other open entries are in **Reviews**: those of the project note outside the tracks and, when the note is a folder note, those of its sub-notes. Due reviews come first. Untracked lines (plain tagged lines and entries without a review date) come first in each place, in note order, with **not tracked yet** instead of the date and **Track as decision** or **Track as prediction** instead of Review; once tracked they are dated and show Review. Closed entries are not shown (see Tidy up in the journal). A review is due when its 📅 date is today or earlier.
- **Ideas:** each idea is one line, its text cut after two lines, with three icon buttons: **Promote**, **Drop** and **Open** (the note at the idea). The list shows the bullets of the Ideas section and the open `#idea` lines of the note, wherever they are (a task or a plain tagged line, in the Ideas section, in a track or anywhere else); project seeds, closed ideas and code are left out. **Promote** opens a form with the status (Explore by default), a **Short name** and, for In progress, an optional first task. The track is added at the end of the Tracks section with the short name as its heading; when the short name differs from the idea's text, the full text is the first line of the block, and the sub-bullets follow. The idea moves (its line and sub-bullets leave their place). **Drop** removes a bullet and closes a tagged idea as dropped (**Undo** shows for a few seconds). If the note has no Tracks section yet, a promotion creates one after the Ideas section (at the end of the note when it has none), using the **Tracks section title** setting.
- **Buttons:** each track has a main icon button (Explore: **To backlog**, Backlog: **Start**, In progress: **Done**, Done: **Reopen**, Dropped: **Restore**) then **Move to…** and **Add task** icon buttons. **Start** and **Add task** ask for a task and an optional due date, written as `- [ ] <task> ➕ <today> 📅 <due>` at the end of the track. An In progress track with no open task shows **No next task** and, when the *Next steps* AI action is available, a **Suggest next steps** icon button.
- **Commands:** **Move this track…**, **Promote this idea to a track** (also on a tagged idea line) **Add a task to this track** and **Suggest next steps for this track** (AI, see below) work on the note you are editing, from the cursor, and can be undone with Ctrl+Z.
- **Tasks of a track:** all the task lines of the block, except those tagged with the idea, decision or prediction tag or `#question`: those are ideas, reviews and questions, not work. Under the track's title, a small bar shows the tasks done out of the tasks done or open (**2/5 tasks**); cancelled tasks `[-]` do not count, and a track with no task has no bar. Each open task is then a row, like the decisions and predictions: a task mark, its text and its due date (a click opens the note at the line), then three icon buttons: **Done** (checks the box and adds ` ✅ <today>`, before a block id, as Tasks does), **Drop** (turns the box into `[-]`) and **Open in the note**. **Done** and **Drop** show an **Undo** for a few seconds; nothing is written if the line changed since the page was drawn. A recurring task (🔁) only has **Open in the note**: only the Tasks plugin can create its next occurrence. The tasks come before the track's decisions and predictions, in note order, in closed tracks too.
- **Safe writes:** every change checks that the line it targets still reads as it did when it was shown; otherwise nothing is written. Other notes are changed through `Vault.process`, the note you are editing through the editor.
- **First-run check:** once per vault, if 20 or more lines carry the idea tag without being tasks, or 20 or more notes carry the Project tag, a dialog shows the counts and where to change the tags. It only informs; nothing is written.
- **Local only:** projects are read from your notes on your device. Nothing is sent anywhere. Turn the feature, change the Project tag, the title of new Tracks sections, the **Project folder** (empty: the vault root) or the **Project template** (empty: the built-in skeleton) in the settings under Projects.

## Weekly review

The **Weekly review** command goes through the windows you already know, one after the other, with no page of its own:

1. the **Time to judge?** window of each review due (review date today or earlier), oldest first;
2. **Tend fresh ideas**, over the fresh ideas of the whole vault;
3. if a project has an In progress track without an open task, the hub opens on the page of the first such project (a notice counts the other projects).

A step with nothing to do is skipped, and so is a feature that is turned off. Closing a window without writing stops the whole session. A notice sums up what was done, for example "Weekly review: 3 reviews done, 4 ideas sorted, 1 track needs a next task."

## AI actions

An AI action is a Markdown file in your vault: a prompt, the data it may send, and the kind of answer you want. VaultMate runs it only when you click, shows exactly what will be sent first, and keeps only short questions, suggestion cards or next-step items from the answer. It never shows free-form AI text.

- **Default actions:** **Create default actions** in the settings writes *Challenge this note*, *Recommend me* and *Next steps* to the actions folder (`VaultMate/AI actions` by default). *Challenge this note* sends the current note and returns about five open questions that challenge it. Insert the ones you want under a `## Questions` heading, or copy them. To make them tasks that the VaultMate app lists as open questions, change the action's `line` to `- [ ] {{text}} #question`.
- **Recommend me:** the second default action. Choose a type (Movies, Series, Manga...), and VaultMate sends the rated notes of that type (your 25 best and 10 lowest, with year, rating, genres and creators) plus the titles you already have, so they are not suggested again. You get about five cards: title, year, creator, "Because you rated <title> 8/10" and one sentence. **Search** opens a web search for the title in your browser (DuckDuckGo); VaultMate itself makes no request for it. **Copy title** copies the title. **Not interested** hides the title from future suggestions of that type (stored in the plugin's `data.json`, with an **Undo**). It needs at least three rated notes of the type. Under **Based on** you can instead pick **one entry** of the type (rated or not; the one in the open note is preselected): VaultMate then sends only that entry (title, year, rating, genres, creators and its `plot` property, cut at 400 characters) and the titles to exclude, and the cards say "Because you rated <title> 8/10" or, for an entry you have not rated, "Close to <title>". One entry is enough, rated or not. AI suggestions can be wrong: a title may not exist or be credited to the wrong person.
- **Collection settings:** under Collections in the settings, choose the folder of your collection notes (empty = the whole vault), the property that holds the type (default `type`, with values such as `movie`, `series`, `manga`, `game`, `book` or `boardgame`) and the property that holds your rating (default `rating`, from 0 to 10; 0 or empty means not rated, like in the VaultMate app). Only the properties of the notes are read (title, year, genres, director, author, studio, developers), never their text.
- **Next steps:** the third default action, for the tracks of a project note. On the project page, an In progress track with no open task shows **No next task** and a **Suggest next steps** icon button (only when the *Next steps* action exists and AI is configured). The command **Suggest next steps for this track** does the same from the cursor, inside an open track (Explore, Backlog or In progress) of a project note. The run window shows what will be sent: the project's name, the text under its **Goal** or **Objectif** heading if it has one (cut at 1,500 characters), then the track's title, status and whole block, tasks included (8,000 characters at most in all). Nothing else from the note is sent. You get about three short actions with unchecked boxes; **Add selected** writes the ones you tick as tasks at the end of that track (`- [ ] <text> ➕ <today>`), in one edit that refuses to write if the track has moved. Nothing is sent or written without your click. **Ask again** is a new request.
- **Running an action:** run **Open AI actions** from the command palette, or use the **AI** section of the VaultMate panel, which runs on the most recent note. An action with `command: true` also gets its own command, `AI: <name>`, that you can add to the mobile toolbar.
- **Nothing is sent without your click.** The run window shows the provider and model, each source with its size (and whether it was truncated), the note concerned and the total. The first time an action runs, and whenever its list of sources changes, you must tick *Send this to <provider>*. Then you click **Send**. **Ask again** is another explicit click and another call.
- **Provider:** in the settings, under AI actions, set an OpenAI-compatible base URL (HTTPS, except `localhost` and `127.0.0.1`), a model, and an API key secret chosen from Obsidian's secret storage. The key is never saved in the plugin's settings. A local server needs no key.
- **Questions, suggestions or items only:** the answer must be JSON; VaultMate keeps questions of one sentence ending with a question mark, at most 160 characters, without duplicates or questions already in the note, and drops everything else. For suggestions it keeps a title (one line, at most 120 characters), an optional four-digit year and creator (at most 80), at most two reasons that are titles you really rated, and one sentence of at most 160 characters; it drops any title already in your vault or marked as not interested. For items it keeps a list of strings, at most `count`, each one line of at most 100 characters in plain text (no list marker, checkbox or heading, no date, Tasks emoji or tag, no line that ends with a colon), without duplicates or tasks the track already has.

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
- `sources` lists what is sent: `note` (title and text, without properties, code blocks or link targets; 24,000 characters at most), `selection` (the selected text when you start the action; 8,000), `properties` (the note's properties as `key: value` lines; 2,000) and `collection-profile` (the rated notes of one collection type and the titles to exclude, as above; 12,000, and the preview says when it was cut) and `track` (one track of a project note, with the project's goal section; 8,000, of which the goal takes at most 1,500). `collection-profile` needs the `type` parameter and does not need an open note. `track` needs a parameter with `choices: project-tracks`.
- `output` is `questions`, `suggestions` or `items`. `suggestions` needs the `collection-profile` source and has no `insert`. `items` needs the `track` source, has no `insert`, and shows checkboxes whose ticked lines become tasks of the track. `count` is 1 to 10 (default 5) and replaces `{{count}}` in the prompt.
- `params` asks for a value before the preview. The first kind of choice is `collection-types`: `params: { type: { label: Type, choices: collection-types } }` shows a list of the types found in your collection notes, with their counts (for example "Movies (42 rated)"), and `{{type}}` in the prompt becomes the chosen label. The second kind, `collection-entries`, lists the entries of the chosen type, rated or not, as "Title (year) · 8/10" or "Title (year) · not rated" (best rated first), after "All my ratings" (the default). It depends on the type, so declare it after `type`: `params: { type: { label: Type, choices: collection-types }, entry: { label: Based on, choices: collection-entries } }`. `{{based_on}}` in the prompt becomes "the titles they rated high and low" or "the title “<title>”". The third kind, `project-tracks`, lists the open tracks of the open project note (`params: { track: { label: Track, choices: project-tracks } }`), and `{{track}}` in the prompt becomes the chosen track's title. Any other `choices` makes the action unavailable, with a message.
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

## Using VaultMate with the Tasks plugin

Ideas, decisions and predictions are task-style lines, so a plain Tasks query lists them next to your real work. To keep your task queries clean, exclude the tags in the query:

````markdown
```tasks
not done
tags do not include #idea
tags do not include #decision
tags do not include #prediction
```
````

The three tags are settings (Ideas and Decision journal); if you changed them, use your own names. Add `tags do not include #question` if you also use that tag. To see only the reviews that are due, do the opposite: `tags include #decision` with `due before tomorrow`.


## Appearance

The panel opens on a scene for the time of day: morning (05:00 to 10:59), daytime (11:00 to 16:59), evening (17:00 to 20:59) or night (21:00 to 04:59), the same four scenes as the app. With animations on, the sun pulses, the lanterns flicker, the stars twinkle and the clouds drift, at pixel pace (7 images per second; the clouds move one pixel every 250 ms). Everything pauses while the panel is hidden or the window is in the background. A stamp also lands, with its ink, in the middle of the window when you close a review, sort an idea in the idea portal (any outcome, including dropping it) or move a track to Done.

The **Animations** setting (under Appearance, on by default) turns all of that off, leaving the still scene and the existing notices. Animations are also off whenever your system asks for reduced motion (`prefers-reduced-motion`), whatever the setting says.

For a neutral panel at work, turn off **Scene banner** (also under Appearance, on by default): the panel then starts with its title and shows no scene at all, whatever the Animations setting. Turn off **Animations** as well to drop the stamp moments. The two settings are independent: with the banner on and animations off you get the still scene.


## Android app (optional)

The plugin needs nothing from the VaultMate Android app, and the integration is off by default. If you use the app, the two share data only through Markdown notes and properties in your vault: review reminders are [Tasks](https://publish.obsidian.md/tasks/)-style lines with a due date, so the app's task widgets show them on the right day.

Obsidian cannot read the device's location, so on Android the app can supply it. Turn on **Use the VaultMate Android app for the current position** in the settings (off by default; it needs the VaultMate app). The command **Add current location** (and the button on the Places page) then asks the app for the position and writes it with the same checks as the place search. **Test the Android app link** checks that values survive the trip between Obsidian and the app.

The links between the two are documented for the app's developers in [docs/android-app.md](https://github.com/fabsamson/VaultMate-Obsidian/blob/main/docs/android-app.md).

## Privacy

The plugin collects no telemetry. Its network requests are the AI actions you run (sent to the AI provider you configured, with the content you previewed) and the place searches you start (sent to OpenStreetMap Nominatim, with your search text only). VaultMate needs no account, shows no ads and has no paid features; the Buy Me a Coffee link below is an optional donation. See [PRIVACY.md](https://github.com/fabsamson/VaultMate-Obsidian/blob/main/PRIVACY.md).

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
