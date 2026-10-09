# Privacy

VaultMate does not collect telemetry, analytics, or accounts, and it has no server of its own. It makes a network request only when you run an AI action or start a place search, as described below.

Notes are read on your device to compute the plugin's views. VaultMate changes a note only when you run one of its commands, and only the note that command names.

## New connections

The New connections page is computed entirely on your device and sends nothing. To search quickly, VaultMate keeps an index of the words of your notes (word counts and each note's modification time, not the notes themselves) in the app's IndexedDB, on each device. It is not written to `data.json`, so it is not synced, and it is rebuilt if you clear the app's data. When you press "Not useful" on a connection, the paths of the two notes are saved in `data.json`, so that the pair is not proposed again; `data.json` is shared between your devices by whatever sync you use, like the other settings.

## AI actions

An AI action sends data to the AI provider you configure in the settings (base URL and model; an OpenAI-compatible Chat Completions service). VaultMate sends nothing at startup and nothing in the background.

- A request is made only after you click **Send** (or **Ask again**) in the run window.
- Before that, the window lists the provider, the model, each source of the action with its size, and the note concerned. It can show the exact messages.
- What is sent is exactly that: the action's prompt, the output format instructions, and the sources the action file lists, among `note` (the note's title and text, without properties or code blocks), `selection` (the text you selected), `properties` (the note's properties) and `collection-profile` (see below). The text is cut at fixed limits, and the preview says when it was.
- The `collection-profile` source, used by the *Recommend me* action, sends information about the notes of your collections folder, only for the type you chose, and only after you have seen the preview and clicked **Send**: for your 25 best and 10 lowest rated notes, the title, year, your rating, the genres and the creators (director, author, studio or developers); and the titles of all your notes of that type, rated or not, plus the titles you marked as not interested, so that they are not suggested. It reads these from the notes' properties, never from their text. When you choose one entry under **Based on**, only that entry is sent instead of your ratings (its title, year, rating or "not rated", genres, creators and its `plot` property, cut at 400 characters), plus the same list of titles to exclude. Your choice of the type or of the entry is not stored. The titles you mark as not interested are stored in the plugin's `data.json`, per type.
- The **Search** button on a suggestion opens a web search (DuckDuckGo) for the suggested title, year and creator in your browser. VaultMate sends nothing itself; your browser and that search engine receive the query.
- You confirm each action the first time it runs, and again whenever its list of sources changes. The confirmation is stored in the plugin's `data.json`, which holds only the action's path and its source names.
- The API key is read from Obsidian's secret storage when a request is made. It is sent to your provider as an authorization header and is never written to the plugin's settings. A local server (`localhost`, `127.0.0.1`) can be used without a key.
- The provider's own privacy policy applies to what it receives. VaultMate stores no answer: only the questions you choose to insert are written to your notes.

## Place search (OpenStreetMap)

The **Search a place** command sends your search to [Nominatim](https://nominatim.openstreetmap.org/), the public search service of OpenStreetMap, operated by the OpenStreetMap Foundation. Its [privacy policy](https://osmfoundation.org/wiki/Privacy_Policy) applies to what it receives.

- A request is made only when you press Enter or **Search** in the search window. Nothing is sent while you type, at startup or in the background.
- What is sent: the text you typed; for ranking, a rectangle of about 110 km around the last position you used on this device (kept in this device's local storage for the vault, never in `data.json`, and absent until you have added a place); and the usual technical data of a web request (your IP address, a `User-Agent` of the form `VaultMate-Obsidian/<version>`, and the language of Obsidian when it is a simple code). No note content, note name or property is sent.
- Coordinates are personal data. When you choose a place, its coordinates and label are written to the properties of your note, and so stay wherever you keep or sync your vault. VaultMate does not send them anywhere else.

## VaultMate Android app link

If you turn on the optional Android app link, **Add current location** opens the VaultMate app on your phone, which answers with a position that VaultMate writes to the note after checking it. The exchange stays on your device (an app link between Obsidian and the app). Pending requests (a random one-time code, the note path and the time) are kept in this device's local storage for 2 minutes at most.

This document is updated with every feature that changes how data is read, written, or sent.
