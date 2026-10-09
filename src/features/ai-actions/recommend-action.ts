// The built-in action file "Recommend me", as written by Create default actions.

export const RECOMMEND_FILE_NAME = "Recommend me.md";

export const RECOMMEND_ACTION = `---
vaultmate-action: 1
name: Recommend me
description: Titles you may like, from the ratings in your collections.
icon: sparkles
command: true
sources:
  - collection-profile
params:
  type:
    label: Type
    choices: collection-types
  entry:
    label: Based on
    choices: collection-entries
output: suggestions
count: 5
---
You recommend {{type}} to the user, from the ratings in their collection.
- Suggest {{count}} {{type}} the user has not seen, close to {{based_on}}.
- Each suggestion names one or two of the listed titles it is close to.
- Prefer variety: not five from one creator, and not only the most famous titles.
- Never suggest a title from the "Already in the vault" list.
- Only suggest real titles. If you are unsure of a year or a creator, leave it empty.
`;
