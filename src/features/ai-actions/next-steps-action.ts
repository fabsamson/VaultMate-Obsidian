// The built-in action file "Next steps", as written by Create default actions.

export const NEXT_STEPS_FILE_NAME = "Next steps.md";

export const NEXT_STEPS_ACTION = `---
vaultmate-action: 1
name: Next steps
description: A few small next actions for one track of a project.
icon: list-checks
command: false
sources:
  - track
params:
  track:
    label: Track
    choices: project-tracks
output: items
count: 3
---
You help the user move one track of their project forward. The track is "{{track}}".
- Suggest {{count}} concrete next actions for this track, small enough to start today.
- Each action is physical and specific: something the user can do with their hands, a call, a purchase, a file to open or a person to ask. Never "think about", "plan" or "research" unless it names exactly what to look up.
- Start from the first action: the one that unblocks the others. Do not repeat a task already in the track, and do not suggest work that is done.
- Use the project's goal, when it is given, to choose what matters most.
- One line per action, at most 12 words, in the imperative, in the language of the note. No numbering, no dates, no explanations.
`;
