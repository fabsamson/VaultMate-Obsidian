# Privacy

VaultMate does not collect telemetry, analytics, or accounts, and it has no server of its own. It makes a network request only when you run an AI action, as described below.

Notes are read on your device to compute the plugin's views. VaultMate changes a note only when you run one of its commands, and only the note that command names.

## AI actions

An AI action sends data to the AI provider you configure in the settings (base URL and model; an OpenAI-compatible Chat Completions service). VaultMate sends nothing at startup and nothing in the background.

- A request is made only after you click **Send** (or **Ask again**) in the run window.
- Before that, the window lists the provider, the model, each source of the action with its size, and the note concerned. It can show the exact messages.
- What is sent is exactly that: the action's prompt, the output format instructions, and the sources the action file lists, among `note` (the note's title and text, without properties or code blocks), `selection` (the text you selected) and `properties` (the note's properties). The text is cut at fixed limits, and the preview says when it was.
- You confirm each action the first time it runs, and again whenever its list of sources changes. The confirmation is stored in the plugin's `data.json`, which holds only the action's path and its source names.
- The API key is read from Obsidian's secret storage when a request is made. It is sent to your provider as an authorization header and is never written to the plugin's settings. A local server (`localhost`, `127.0.0.1`) can be used without a key.
- The provider's own privacy policy applies to what it receives. VaultMate stores no answer: only the questions you choose to insert are written to your notes.

This document is updated with every feature that changes how data is read, written, or sent.
