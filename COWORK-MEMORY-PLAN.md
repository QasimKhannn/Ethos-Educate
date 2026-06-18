# Cowork — Project Memory (Claude Code-style) — Implementation Plan

> Plan for review **before** implementation. Cowork-only and additive — gated on
> `coworkProjectId`; **no change to normal chat, the existing per-user memory, or other agents.**
> Grep under `cowork` / `.cowork`.
>
> _Drafted: 2026-06-18 · branch `feature/cowork-mode`_

## 1. Goal

Give each Cowork **project** a persistent memory the agent always sees — like Claude Code's
`CLAUDE.md`. It is:

- **Per-project** (each project remembers its own context, decisions, preferences), isolated
  from other projects and from normal chat.
- **Manual + automatic** (decided): the user can view/edit it, AND the agent appends durable
  facts it learns during a session.
- **Always in context**: injected into the Cowork agent's run for that project, every message —
  not dependent on the agent remembering to read a file.

Optional stretch (decision §6): a lighter **per-chat** memory (notes scoped to one conversation)
layered on top of project memory.

## 2. What already exists (and why it's not enough)

LibreChat ships a **per-user, global** memory subsystem (`packages/api/src/agents/memory.ts`,
invoked in `api/server/controllers/agents/client.js` via `useMemory()` / `createMemoryProcessor`).
It's enabled in `librechat.yaml` (`memory.disabled: false`, model `gpt-5-mini`) and already runs
for Cowork chats. But it is **global per user** — it mixes Cowork context with normal-chat memory
and has no notion of a project. We keep it untouched and add a **project-scoped** layer beside it.

## 3. Design

Store project memory as markdown at a known hidden path in the workspace:

```
<workspace>/<projectId>/.cowork/memory/project.md
```

- Hidden + quota-exempt already (it's under `.cowork/`, which we exclude from the tree and usage).
- File-based, mirroring Claude Code and our existing file-centric architecture.
- **Read (inject):** on every Cowork agent run, the server reads `project.md` and prepends it to
  the agent's system context as "Project memory" — reliable, not left to the model.
- **Manual edit:** a Memory UI reads/writes the same file via new routes.
- **Auto-capture:** the agent is instructed to append concise, durable facts (preferences,
  decisions, naming conventions, "always do X") to project memory — written via `execute_code`
  to the same path. Volatile/one-off details are NOT memorized.

Why inject server-side rather than rely on the agent reading the file: guarantees the memory is
always present in context (the existing per-user memory uses the same inject-into-run approach).

## 4. Workstreams

### A. Service — read/write project memory (`CoworkWorkspaceService`)
- `getMemory(): Promise<string>` → contents of `.cowork/memory/project.md` (`''` if absent).
- `setMemory(text): Promise<void>` → write it (size-capped, e.g. 16 KB; quota-exempt).
- `appendMemory(text): Promise<void>` → append a timestamped bullet (used by auto-capture path).
- Unit tests (round-trip, cap, empty default).

### B. Injection into the Cowork agent run
- Where the agents request is assembled (resolve `coworkProjectId`, same gating as the exec
  bridge), read project memory and append it to the agent's system instructions / shared run
  context as a `# Project memory` block. Scoped so non-cowork runs are untouched.
- Likely touch point: `api/server/controllers/agents/client.js` (the `sharedRunContextParts`
  builder) or the agents `initialize` path — exact spot confirmed during implementation. Gated
  strictly on `coworkProjectId`.

### C. Auto-capture
- Add a short rule to the Cowork agent prompt (`seed-cowork-agent.js`) + the per-run code context
  (`handleTools.js`): "When you learn a durable fact about this project (a preference, decision,
  convention), append one concise bullet to `.cowork/memory/project.md`. Keep it short; don't
  record one-off details." (Re-seed required.)
- Optional later: a structured `remember(text)` tool instead of free-form file appends.

### D. Routes + data-provider
- `GET /projects/:id/memory` → `{ memory: string }`
- `PUT /projects/:id/memory` → body `{ memory }` (manual edit / clear)
- data-provider: endpoints, `getCoworkMemory` / `updateCoworkMemory`, `coworkMemory` query key,
  `useCoworkMemoryQuery` + `useUpdateCoworkMemoryMutation`.

### E. UI
- A **Memory** affordance in the project (a new right-pane tab "Memory", or a header button) with
  a simple editor: textarea of the markdown, Save, and a note that the agent updates it too.
- Refresh project memory after each agent run (auto-captured entries appear), like we do for the
  changes/workspace panels.

### F. (Optional) Per-chat memory — decision §6
- A second, conversation-scoped note (`.cowork/memory/chats/<conversationId>.md`) injected only
  for that chat. Same service/route/UI pattern, scoped by conversationId.

## 5. Isolation & safety
- Everything gated on `coworkProjectId`; the global per-user memory and normal chat are untouched.
- Memory lives under hidden, quota-exempt `.cowork/`; path-contained via `resolve()`.
- Size cap prevents memory from bloating the context window (relevant given token limits aren't
  pinned — §ammar notes).

## 6. Decisions (need your call)
1. **Per-chat memory** — ship project-level only now (matches Claude Code), or also add the
   per-chat layer (F)? Recommended: project-level first.
2. **Auto-capture mechanism** — free-form file append (fast, simple) vs a structured `remember`
   tool (cleaner, more work). Recommended: file append now, tool later.
3. **Editor placement** — new right-pane **"Memory" tab** (recommended) vs a header button/overlay.

## 7. Build / rebuild matrix
| Change area | packages build | backend restart | client build | re-seed agent |
|---|:--:|:--:|:--:|:--:|
| `packages/api` (service) | ✅ | ✅ | — | — |
| `packages/data-provider` | ✅ | ✅ | ✅ | — |
| `api/` (routes, injection, handleTools) | — | ✅ | — | — |
| `seed-cowork-agent.js` (auto-capture rule) | — | ✅ | — | ✅ |
| `client/` (Memory UI) | — | — | ✅ | — |

## 8. Sequencing
1. **A** — service get/set/append + tests.
2. **D** — routes + data-provider wiring.
3. **B** — server-side injection into the Cowork run (the core "always sees it" piece).
4. **E** — Memory tab UI (view/edit).
5. **C** — auto-capture prompt rule + re-seed.
6. **F** — per-chat memory (only if chosen in §6).
