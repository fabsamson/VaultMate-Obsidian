// The "New action" template: an action file that explains every property. It is itself a valid, runnable action. Pure.

export const NEW_ACTION_BASE_NAME = "New action";

/** Where the guide to writing an action lives. */
export const ACTIONS_GUIDE_URL = "https://github.com/fabsamson/VaultMate-Obsidian#writing-an-action-file";

/**
 * The `%% ... %%` block is an Obsidian comment: hidden in reading view, kept by the Properties editor and never sent
 * (VaultMate removes it from the prompt). The prompt is what follows it.
 */
export const NEW_ACTION = `---
vaultmate-action: 1
name: Find the gaps
description: Questions about what the current note leaves out.
icon: search
command: false
sources:
  - note
output: questions
count: 5
---
%%
How to write an action. This comment is never sent to the AI. Delete it when you no longer need it.

The properties above say what the action reads and what it returns. The text below this comment is the prompt.

- name: the name shown in the AI actions page. Required.
- description: one line shown under the name.
- icon: the name of a Lucide icon, for example sparkles or search.
- command: true adds a command named AI: followed by the name to the command palette.
- sources: what is sent with the prompt, after a preview you confirm. Choose from
  - note: the text of the current note.
  - selection: the selected text of the current note.
  - properties: the properties of the current note.
  - collection-profile: your rated collection notes. Needs the type parameter.
  - track: one track of a project note. Needs a parameter with choices: project-tracks.
- output: what the AI returns.
  - questions: a list of questions. They can be inserted into the note.
  - suggestions: titles to try. Needs the collection-profile source. They cannot be inserted.
  - items: next steps for a track, added as tasks. Needs the track source. They cannot be inserted.
- count: how many results to ask for, from 1 to 10. It is the starting value of "How many" in the run window, where you can change it. Write {{count}} in the prompt to use it.
- insert: where the questions go. Leave it out to only show them.
  - insert with heading: Questions and line: "- {{text}}" puts each one under that heading.
  - insert with at: cursor puts them at the cursor.
  - line must contain {{text}}.
- params: values the run window asks for before the preview. Each one has a label and choices: collection-types, collection-entries or project-tracks. The chosen label replaces {{name}} in the prompt, so a parameter named type gives {{type}} and one named track gives {{track}}. {{based_on}} is the entry chosen by a collection-entries parameter.

More: ${ACTIONS_GUIDE_URL}
%%
You help the user see what their own note leaves out. Return only questions.
- Ask {{count}} open questions about what the note does not say yet: a missing step, an unstated reason, a case it ignores, a person or a constraint it never mentions.
- Each question targets a specific gap: name the part of the note it comes from.
- One sentence per question, at most 25 words, in plain words, addressed to the author. Write in the note's language.
- No preamble, no summary, no answers, no advice, no praise. Do not repeat a question already in the note.
`;

/** In the (normalized) folder: `New action.md`, else `New action 2.md`, `New action 3.md`... : the first free path in the folder. */
export function freeActionPath(folder: string, exists: (path: string) => boolean): string {
	for (let n = 1; ; n++) {
		const path = `${folder}/${NEW_ACTION_BASE_NAME}${n === 1 ? "" : ` ${n}`}.md`;
		if (!exists(path)) return path;
	}
}
