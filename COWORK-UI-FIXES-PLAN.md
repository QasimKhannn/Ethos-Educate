# Cowork UI / Session Fixes — Plan (no implementation)

Grounded in the actual codebase. Six issues from testing, plus two enhancement ideas.
Goal: sequence the work so the cheap, high-impact demo polish lands first and the one
genuinely architectural item (session persistence) is scoped correctly — not over-built.

---

## Headline finding (changes the priority story)

The "task stops when I leave the chat" issue is **not** a from-scratch persistence build.
The backend already has most of the machinery:

- Generation runs as a **fire-and-forget background job** via `GenerationJobManager`, created
  in `api/server/controllers/agents/request.js` and driven by a controller literally named
  `ResumableAgentController`.
- The stream endpoint `/api/agents/chat/stream/:streamId` (`api/server/routes/agents/index.js`)
  only **unsubscribes** the client on disconnect (`req.on('close')`) and emits an
  `allSubscribersLeft` event that **saves the partial response**.
- `CoworkRoutineRunner.js` already runs the same agent **fully headless** (no HTTP connection),
  proving the execution path is decoupled from the browser.
- Messages persist to the standard Message collection; `useCoworkChat.ts` reloads history on
  mount via `getCoworkConversationMessages`.

So the real gap is mostly **client-side**: on navigation the `CoworkChat` component unmounts
(forced remount via `key={chatMountKey}` in `CoworkProjectView.tsx`), `useCoworkChat.ts` has
**no reconnect path**, and there's no flag telling the server "this is a Cowork run, keep going."

**One diagnostic must be answered before building Phase 1** (see below): does generation
actually *continue* server-side after disconnect today, or does something abort it? That single
answer decides whether Phase 1 is "wire up reconnection" (small) or "stop the abort + wire up
reconnection" (medium).

> Note: the obvious-looking "add a cleanup `useEffect` that calls `abortStream()` on unmount"
> is the **wrong** fix for the autonomous-coworker goal — it makes the task stop *cleanly*
> instead of *not stopping*. We want continue + reconnect, not graceful abort.

---

## Diagnostic spike (do first — ~30–60 min, no code)

Run a long Cowork task, navigate away mid-run, and check:
1. Server logs — does generation keep running and `saveMessage` fire after the client leaves?
2. DB — does the assistant message complete while the user is on another screen?
3. Return to the chat — does reload show the finished message (proving server continued)?

- If **server continues** → Phase 1 = client reconnect/resume only (smaller).
- If **server aborts** → Phase 1 = add a `coworkHeadless` flag to skip abort-on-close
  (`request.js`) **and** client reconnect.

---

## Phases & sequence

### Phase 0 — Demo polish (client-only, low risk, high impact) — do first

All independent, all small, all browser-only. Batch by file to avoid edit collisions.

| # | Issue | File(s) | Cause | Fix approach | Risk |
|---|-------|---------|-------|--------------|------|
| 2 | Skills button reloads chat | `CoworkSidebar.tsx` (skills button), `CoworkProjectView.tsx` (tab state) | Button calls `go('/cowork/:id?tab=skills')` — a router navigation — instead of a local state toggle | Mirror the **Connectors** pattern (which uses a local `setShowConnectors(true)` toggle / in-place panel). Lift skills open-state or toggle the existing pane without `navigate()` | Low |
| 3 | Long message won't scroll | `CoworkChat.tsx` (scroll container ~`flex-1 overflow-y-auto`, message wrappers) | **Most likely** a flex child missing `min-h-0`, so `overflow-y-auto` never actually clips/scrolls — *not* a per-message problem | Verify the scroll column has `min-h-0`; fix there. Avoid the per-message `max-h-96 overflow-y-auto` band-aid (creates nested scroll traps) unless intentionally collapsing huge code blocks | Low |
| 5 | No copy-message action | `CoworkChat.tsx` (user + agent bubbles) | Bubbles have no hover action toolbar (user bubble has only an Edit button) | Add a `group`-hover action bar; reuse the main chat's clipboard logic (`HoverButtons` / `useMessageActions` `copyToClipboard`). Add copy-message; optionally copy-code-block | Low |
| 6 | Routine card truncates | `CoworkRoutinesPanel.tsx` (prompt ~`line-clamp-2`, schedule/meta row) | `line-clamp-2` hard-clips the prompt; schedule text can overflow narrow card | Replace `line-clamp-2` with an expand/collapse ("Show more"); add `flex-wrap` + `break-words` to the meta row. Reuse the existing "Recent runs" accordion pattern | Low |

Sequencing inside Phase 0: do **#3 + #5 together** (same file/region in `CoworkChat.tsx`),
then **#2** (`CoworkSidebar` + `CoworkProjectView`), then **#6** (`CoworkRoutinesPanel`).

### Phase 1 — Session persistence (P0 for positioning) — do after Phase 0

Scope decided by the diagnostic. Components in play:

- **`useCoworkChat.ts`** — add a `resumeRun(streamId)` path that re-subscribes to
  `/api/agents/chat/stream/:streamId` on mount when a run is still in flight; hydrate UI from
  the resume/sync payload. Track the active `streamId` so a returning view can find it.
- **`request.js` (`ResumableAgentController`)** — only if the diagnostic shows generation is
  aborted on client close: add a `coworkHeadless` flag (set from `useCoworkChat` submission)
  that skips abort-on-disconnect and lets `allSubscribersLeft` save the partial/final result.
- **State to restore on return:** in-flight indicator, streamed-so-far content, trace steps.

Effort: medium (mostly client reconnect). Risk: medium — touches the shared agent stream path,
so gate behind the `coworkProjectId`/Cowork flag to avoid affecting normal chat.

### Phase 2 — Enhancements (after demo / pilot) — optional, sequenced last

- **Activity timeline** — *already partially built*: `CoworkTracePanel.tsx` exists and renders
  tool calls (execute_code, file_search, web_search…) as expandable rows, wired as the "Trace"
  tab in `CoworkProjectView.tsx`. The enhancement is presentation (make it prominent / temporal /
  cross-run), not new infrastructure. Low effort, high perceived-intelligence payoff.
- **Checkpointed / cross-restart resumable run log** — the only genuinely hard item: a new
  `CoworkRunLog` model + externalizing `GenerationJobManager` state (Redis/Mongo) so runs survive
  a server restart or multi-instance deploy. **Defer** unless you need crash-recovery or run more
  than one backend instance. High effort, high risk.

### Separate track — not a Cowork code issue

- **#4 Microsoft MCP auth mismatch** — OAuth redirect URIs / deployment URL don't match the
  deployed app. This is **config/deploy**, not Cowork architecture: align each MS MCP server's
  `redirect_uri` (and Azure AD app callback) with the real deployed host. Fix whenever; it
  doesn't block the others. Worth adding a "connector unhealthy" indicator later (small).

---

## Recommended order (one line)

Diagnostic spike → Phase 0 (#3+#5, then #2, then #6) → Phase 1 (reconnect, + headless flag if
needed) → Phase 2 (trace polish; defer the run-log/Redis work) → #4 on its own config track.

## Why this order

Phase 0 is all low-risk, browser-only, and immediately visible in a demo — ship it first.
Phase 1 is the real differentiator but should be scoped by the diagnostic so you don't build a
resumable-job database you may not need. Phase 2's headline ("activity timeline") is largely
already there in `CoworkTracePanel`, so it's cheap polish, not new architecture. #4 is orthogonal
config and shouldn't gate any of it.
