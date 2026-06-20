---
name: skill-creator
description: "Author a new Cowork skill, or improve an existing one. Use when the user wants to teach the agent a reusable capability or codify a repeatable workflow as a skill."
---

# Creating Cowork skills

A **skill** is a folder under the skills root containing a `SKILL.md` file. It is pure
prompt content: instructions that are injected into the agent's system prompt when the
skill is enabled. There is no runtime to register — the agent reads the guidance and
executes it using code execution and the workspace.

## SKILL.md format

```markdown
---
name: <short-id>          # lowercase, matches the folder name; [a-z0-9_-]
description: "<one or two sentences: what it does AND when to use it>"
---

# <Human title>

<Concise, model-facing instructions...>
```

Only `name` and `description` are required in the frontmatter. The `description` is the
most important line: it's what helps the agent (and the user picking skills) decide *when*
this skill applies, so lead with the trigger ("Use when…").

## What makes a good skill

- **Scoped to one capability.** "Build Excel gradebooks" is a skill; "do office work" is not.
- **Actionable, not academic.** Give the exact library, the setup command, and copy-pasteable
  code recipes for the common cases — the agent should be able to follow it without guessing.
- **Names the tools.** State which library/approach to use and why, so the agent doesn't
  pick a worse one.
- **States the output contract.** Where to save (the workspace `output/` folder), what the
  finished deliverable looks like, and how to self-verify.
- **Includes guardrails.** Quality bar, and a reminder not to fabricate data/citations.

## Authoring workflow

1. Pick a short `name` and create `skills/<name>/SKILL.md`.
2. Write the frontmatter — get the `description` trigger right.
3. Body: Overview → Setup → Workflow → Recipes (code) → Quality guidance.
4. Keep it tight. If it needs long reference material, summarize in SKILL.md and put the
   detail in a sibling `.md` the instructions point to.
5. Prefer mature open-source libraries; avoid bespoke tooling unless a library can't do it.

## Improving a skill

Read the existing `SKILL.md`, find where the agent's output fell short, and tighten the
relevant section (clearer steps, a missing recipe, a sharper quality bar). Skills are
prompt text — iterate cheaply and re-test against real output.

## Licensing note

Only author original content here. Do not paste in skill text from other proprietary
sources — write instructions in your own words around open-source libraries.
