# Cowork mode — status & next steps (handoff)

_Branch: `feature/cowork-mode`. Last updated: 2026-06-16._

This is a working handoff so the next session can pick up without re-discovery.
Constraint that still holds: **Cowork must not affect the existing web app / chat /
projects.** All cowork code is additive and gated on `coworkProjectId`.

---

## ✅ Done and working

- **Execution bridge** — agent reads the project workspace and runs code *in place*
  (`handleTools.js` resolves the workspace from `coworkProjectId`, runs
  `execute_code` with `workingDir` + `cleanEnv`). Local executor, no paid key.
- **Python auto-install** with import→pip overrides (incl. `dateutil → python-dateutil`).
- **Workspace tree** hides exec machinery (`.venv`, `__pycache__`, `__librechat_exec.*`).
- **Auto-refresh** of the workspace panel after each run.
- **Chat history persistence** — opening a project loads its most recent conversation.
- **Scroll-up message paging** — loads newest 25 on open, pages older on scroll-up
  via `GET /api/cowork/projects/:projectId/conversations/:conversationId/messages`
  (cursor on `createdAt`). Scroll position preserved on prepend.
- **Trace tab** — see below (now complete).
- **Inline tool steps** — the current run's tool calls also render inline in the chat
  (above the latest assistant message), reusing `TraceRow`. Ephemeral per run (not
  persisted per message); the side panel still shows them too. Client-only.
- **Agent tool audit** — final Cowork agent tools: `['execute_code', 'tavily_search_results_json']`.
  - `web_search` → removed; replaced by `tavily_search_results_json` (gated on the
    existing `TAVILY_API_KEY`). The unified `web_search` needs an unconfigured
    Serper+Firecrawl+Jina/Cohere stack, so it errored "Tool not found" and the agent retried.
  - `file_search` → removed (Cowork-agent only). It searches the RAG index, but Cowork
    files live on disk and are never indexed into RAG → finds nothing / errors if RAG is
    down. Workspace files are read via `execute_code`. The tool stays registered app-wide
    for normal chats/other agents. _(If semantic search over uploads is wanted later:
    index Cowork workspace uploads into RAG, then re-add `file_search`.)_
  - `artifacts` → removed from `tools` (it was a no-op there: it's the `agent.artifacts`
    string field, not a callable tool). Enable via `agentData.artifacts = 'default'` if
    ever wanted; usually unnecessary since Cowork outputs files to `output/`.
  - All changes are isolated to the seeded `agent_cowork_default`; nothing touches the
    global tool registry, `librechat.yaml`, or other agents.
  - **Action:** re-run `npm run seed-cowork-agent` + restart backend to apply the new
    tool list to the stored agent.
  - **⚠️ No search works until a key is added.** ALL search keys in `.env` are empty
    (`TAVILY_API_KEY`, `GOOGLE_*`, `TRAVERSAAL_API_KEY`, `AZURE_AI_SEARCH_*`) and
    Serper/Firecrawl/Jina/Cohere aren't present; `webSearch: false`. Web search has
    never been configured anywhere in this deployment (normal chats included). To enable:
    set a real `TAVILY_API_KEY` (one key, free tier) and restart — Tavily is the cheapest
    path since the unified `web_search` would need three keys (Serper+Firecrawl+Jina/Cohere).

---

## 🔎 Trace implementation — review

Status: **complete and wired**. Files:

- `useCoworkChat.ts`
  - `CoworkTraceEntry` type; `handleStepEvent(event, payload, setTrace)` translates
    run-step events into entries (start = `running`, completed = `done` + output).
  - `trace` state; `setTrace([])` at the start of each run; an effect pushes `trace`
    to the parent via `onTraceChange`.
  - In the SSE handler: `if (typeof data.event === 'string') handleStepEvent(data.event, data.data, setTrace)`.
- `CoworkChat.tsx` — accepts `onTraceChange` and forwards it as the 3rd hook arg.
- `CoworkProjectView.tsx` — owns `trace` state, passes `onTraceChange={setTrace}`,
  renders `<CoworkTracePanel trace={trace} />` in the Trace tab, resets on project switch.
- `CoworkTracePanel.tsx` — collapsible rows per step (icon + label + running/done),
  expandable Input/Output.

**⚠️ One thing to verify on next run:** `handleStepEvent` assumes the stream emits
`data.event === 'on_run_step'` / `'on_run_step_completed'` with `data.data` shaped as
`{ id, stepDetails.tool_calls[], result.tool_call }`. If the Trace panel stays empty
during a run that clearly used a tool, log a few raw SSE `data` objects and adjust the
event names / payload paths in `handleStepEvent`. It fails safe (no crash, just no rows).

**Rebuild for trace:** client only (`useCoworkChat.ts`, `CoworkChat.tsx`,
`CoworkProjectView.tsx`, `CoworkTracePanel.tsx` are all client). No package/backend build.

---

## 🚧 Remaining tasks (suggested order)

### 1. Skills injection into the Cowork agent prompt  _(not started at runtime)_
The pieces exist but aren't connected:
- `CoworkSkillsService.buildSkillsPrompt()` exists (+ tests) but is **never called** at runtime.
- `enabledSkills` is stored on the project (update route) but nothing reads it into a prompt.
- No route to **list available skills**; the Skills tab is a placeholder.

To do:
- Add `GET /api/cowork/projects/:projectId/skills` (available skills + enabled flags).
- Inject `buildSkillsPrompt(enabledSkills)` into the agent's system prompt **only for
  cowork conversations** (resolve via `coworkProjectId`, same gating as the exec bridge).
  Find where the agent system/additional instructions are assembled for the agents
  endpoint and append there — keep it scoped so normal chats are untouched.
- Build the Skills tab UI (toggle PPTX/DOCX/XLSX/PDF; persist via the project update route).
- Rebuild scope: packages (`@librechat/api` if service signature changes) + backend + client.

### 2. Model selection per session  _(backlogged feature)_
Let the user pick the model when starting a project/conversation and lock it for the
session (like Claude Cowork). Today the agent is fixed to `gpt-5-chat`. Plumb a model
field through the cowork submission (`endpointOption`) and a picker in the project header.

### 3. Agent response quality + UI polish  _(do last, together with #2)_
- Responses currently feel like a generic chat. Improve the agent's system prompt
  (operator/agentic framing, explicit "read workspace → plan → run → write to output/ →
  confirm" loop) and consider the `ajaia-voice` direction where relevant.
- Polish the chat UI (message styling, tool/trace affordances inline, empty states).

### Minor cleanup
- The conversation-**list** endpoint (`GET .../conversations`, `listCoworkConversations`,
  `useCoworkConversationsQuery`, `QueryKeys.coworkConversations`) is **unused** after we
  dropped the History button. Keep for a future sidebar, or remove to reduce surface.
- `useCoworkChat` still invalidates `coworkConversations` on run-complete (harmless no-op).

---

## 🔁 Rebuild quick-reference

| Change area | packages build | backend restart | client build |
|---|:--:|:--:|:--:|
| `packages/data-provider` / `packages/api` | ✅ | ✅ | ✅ |
| `api/` (routes, models, handleTools) | — | ✅ | — |
| `client/` (components, hooks) | — | — | ✅ |

For the most recent batch (message paging) all three were needed. The Trace completion
is **client-only**.

---

## Pointers
- Plan / decisions: `COWORK-DEVIATIONS.md`, `COWORK-EXEC-BRIDGE-PLAN.md`.
- Exec bridge: `api/app/clients/tools/util/handleTools.js` (cowork block ~L324).
- Workspace service: `packages/api/src/cowork/CoworkWorkspaceService.ts`.
- Skills service: `packages/api/src/cowork/CoworkSkillsService.ts` (built, not wired).
- Cowork routes: `api/server/routes/cowork.js`. Model: `api/models/CoworkProject.js`.
- Client: `client/src/components/Cowork/*`, data layer `client/src/data-provider/Cowork/*`.
