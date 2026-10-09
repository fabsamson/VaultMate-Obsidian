// The built-in action file "Challenge this note", as written by Create default actions.

export const CHALLENGE_FILE_NAME = "Challenge this note.md";

export const CHALLENGE_ACTION = `---
vaultmate-action: 1
name: Challenge this note
description: A few open questions that challenge the current note.
icon: message-circle-question
command: true
sources:
  - note
output: questions
count: 5
insert:
  heading: Questions
  line: "- {{text}}"
---
You help the user think harder about their own note. Return only questions.
- Ask {{count}} open questions; none can be answered with yes or no.
- Each question targets something specific in the note: name the claim, choice or idea it questions.
- Mix the kinds: assumption, evidence, consequence, alternative, connection (another field or topic), personal.
- One sentence per question, at most 25 words. Write in the note's language.
- No preamble, no summary, no answers, no advice, no praise. Do not repeat a question already in the note.
`;
