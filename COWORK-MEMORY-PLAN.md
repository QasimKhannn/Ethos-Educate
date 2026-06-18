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

## 3. Design — tiered memory (context-window safe)

The naive "inject the whole memory file every run" blows up the context window because the system
block is re-sent every turn. Instead, **two tiers** under the hidden, quota-exempt `.cowork/memory/`:

```
<workspace>/<projectId>/.cowork/memory/
  ├─ core.md       ← ALWAYS injected. Hard token budget (~1.5 KB). Curated + top auto-facts.
  └─ archive.md    ← NEVER injected. The long tail; agent reads it on demand via execute_code.
```

1. **Always-on core (`core.md`)** — a tiny, budgeted block injected into every Cowork run as a
   `# Project memory` system section. Server-side budget enforcement: measure on inject and
   truncate with a marker if over. Holds only high-signal durable facts.
2. **Compaction, not unbounded growth** — when `core.md` nears its budget, compact it with the
   already-configured memory model (`gpt-5-mini`): dedupe, merge, drop stale/contradicted facts;
   overflow is spilled to `archive.md`. Mirrors LibreChat's built-in `memory.tokenLimit: 3000`.
3. **On-demand archive (`archive.md`)** — verbose/historical detail lives here and is NOT injected;
   the agent greps/reads it via `execute_code` only when a task needs it. Costs **zero** context
   until used, and only for that one turn's tool output.

Steady-state context cost = just the small core block. Depth is retrieved, not resident.

- **Budget** is configurable — `COWORK_MEMORY_TOKEN_BUDGET` (default ~1500 tokens / ~6 KB chars),
  enforced server-side. Pairs with pinning `maxContextTokens` so the budget is a known fraction.
- **Read (inject):** server reads `core.md` and injects it — reliable, not left to the model.
- **Manual edit:** the Memory UI reads/writes `core.md` (and can view `archive.md` read-only).
- **Auto-capture:** the agent appends concise durable facts to `core.md` (via `execute_code`);
  verbose detail goes to `archive.md`. Volatile/one-off details are not memorized.

## 4. Workstreams

### A. Service — tiered memory store (`CoworkWorkspaceService`)
- `getMemory(): Promise<string>` → `core.md` (`''` if absent).
- `setMemory(text): Promise<void>` → write `core.md`, enforcing the budget (truncate/return a
  flag if over so the caller can trigger compaction). Quota-exempt (`.cowork/`).
- `appendMemory(text): Promise<void>` → append a concise bullet to `core.md`.
- `getMemoryArchive()` / `appendMemoryArchive(text)` → the non-injected long tail.
- `isMemoryOverBudget()` helper using the configurable budget.
- Unit tests (round-trip, budget enforcement, archive spill, empty default).

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

## 8. Phases (implementation order)

**Phase 1 — Memory store + budget (service).** `CoworkWorkspaceService`: core/archive read/write,
configurable `COWORK_MEMORY_TOKEN_BUDGET`, budget enforcement + archive spill, unit tests. _(packages/api
build + restart.)_

**Phase 2 — Routes + data-provider wiring.** `GET/PUT /projects/:id/memory` (core),
`GET /projects/:id/memory/archive`; endpoints, types, keys, data-service fns, query/mutation hooks.
_(packages build + restart + client build.)_

**Phase 3 — Server-side injection (the core "always sees it" piece).** Resolve `coworkProjectId`
in the agents run, inject budget-enforced `core.md` as a `# Project memory` system block, gated so
non-cowork runs are untouched. _(backend restart.)_

**Phase 4 — Memory UI.** A right-pane **"Memory" tab**: edit `core.md` (textarea + Save), read-only
view of `archive.md`, auto-refresh after each run. _(client build.)_

**Phase 5 — Auto-capture + compaction.** Prompt rule (`seed-cowork-agent.js` + `handleTools.js`):
append durable facts to `core.md`, verbose detail to `archive.md`. Compaction with `gpt-5-mini` when
core exceeds budget (dedupe/merge, spill overflow). _(backend restart + re-seed.)_

**Phase 6 — (optional) Per-chat memory.** Conversation-scoped note injected only for that chat —
only if chosen in §6.

Each phase is independently shippable and testable, same cadence as the edit/undo work.
