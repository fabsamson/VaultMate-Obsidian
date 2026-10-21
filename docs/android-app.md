# VaultMate Android app: link contracts

This page is for the developers of the VaultMate Android app. The plugin works on its own and needs nothing from the app; users who want the optional integration are covered in the [README](../README.md#android-app-optional).

The plugin and the app share data only through Markdown notes and properties in your vault. Review reminders are [Tasks](https://publish.obsidian.md/tasks/)-style lines with a due date, so the app's task widgets show them on the right day.

## Link contract

For the app's developers. All values are percent-encoded UTF-8 in the query string, one parameter per value (never a `lat,lng` pair); both sides decode them.

1. **Request** (Obsidian to app): `vaultmate://location?nonce=<nonce>`. The nonce is 32 lowercase hex characters (128 random bits), valid for 2 minutes and for one answer.
2. **Answer** (app to Obsidian): `obsidian://vaultmate-location?nonce=<nonce>&lat=<lat>&lng=<lng>&accuracy=<metres>&label=<text>`, with the same nonce.
   - `lat`, `lng`: plain decimals with a dot, up to 10 decimals, no comma, no `+`, no exponent, no unit: `45.76404`, `-3.5`. Range -90 to 90 and -180 to 180.
   - `accuracy`: optional, metres, non-negative decimal.
   - `label`: optional text (a neighbourhood or a city), at most 120 characters.
   - On failure, send `error=<short message>` instead of the position (for example a refused permission). The nonce is used up either way.
3. **Echo test:** `vaultmate://echo?nonce=<nonce>&lat=45.76404&lng=4.83566&label=Caf%C3%A9%20%26%20Co%20%2F%20Lyon` must be answered with `obsidian://vaultmate-echo?nonce=<nonce>&lat=<lat>&lng=<lng>&label=<label>` carrying the decoded values unchanged (`Café & Co / Lyon`, re-encoded). Obsidian compares them exactly and reports which parameter changed.
4. A nonce is accepted once, only on the device that created it, and less than 2 minutes after its creation. Anything else is refused and nothing is written.

## Idea link

For the app's developers. The Ideas list of the VaultMate Android app opens an idea in Obsidian with:

`obsidian://vaultmate-idea?vault=<vault name>&file=<path>&line=<index>`

- `vault`: handled by Obsidian itself.
- `file`: the note's path relative to the vault, percent-encoded, with or without `.md` (the same path as for `obsidian://open`).
- `line`: the 0-based index of the idea's line, as the app read it.

When the Ideas feature is on, the plugin opens the note (in the pane already showing it, else the current one), puts the cursor on that line and opens the idea portal for it. If the note changed since the app read it, it uses the nearest open idea within 3 lines; if there is none, the note stays open at the line with a message. A processed idea is not reopened. A missing note, a missing `file` or a `line` that is not a non-negative integer is refused with a message. The link only opens: it never writes, and every change still needs a click in the portal.

## Review link

For the app's developers. The VaultMate Android app shows a **Review** button, instead of a checkbox, on every open decision or prediction. It opens the entry in Obsidian with:

`obsidian://vaultmate-review?vault=<vault name>&file=<path>&line=<index>`

- `vault`: handled by Obsidian itself.
- `file`: the note's path relative to the vault, percent-encoded, with or without `.md` (the same path as for `obsidian://open`).
- `line`: the 0-based index of the entry's line, as the app read it.

When the decision journal is on, the plugin opens the note (in the pane already showing it, else the current one), puts the cursor on that line and opens the review form. If the note changed since the app read it, it uses the nearest decision or prediction within 3 lines that still needs a review; if there is none, the note stays open at the line with a message. An entry ticked without a review opens **Add the outcome** instead; an entry already reviewed or cancelled only gets a message. A missing note, a missing `file` or a `line` that is not a non-negative integer is refused with a message. The link only opens: it never writes, and every change still needs a click in the form.

## Back link and daily note

For the app's developers. The idea link and the review link accept an optional `back=app`. On mobile, once the window the link opened is closed, the plugin opens the app with:

`vaultmate://back?kind=<idea|review|daily>&result=<done|cancel|error>`

- `kind=idea` or `kind=review`: `result=done` when the portal or the form wrote something, `result=cancel` when it was closed without a change (a skipped idea, Escape). No link is sent when the link only ended with a message (note not found, entry already processed), or when you choose to open the note from the portal.
- Without `back=app`, or on desktop, nothing changes.

A third link asks Obsidian to create today's daily note:

`obsidian://vaultmate-daily?vault=<vault name>&back=app`

The plugin runs the Daily notes core plugin's own command (open or create today's note, with your template), waits up to 10 seconds for the note to exist, then, with `back=app` on mobile, opens `vaultmate://back?kind=daily&result=done`. If the Daily notes core plugin is turned off or the note does not appear, a message says so and the result is `error`. The link never writes anything itself.
