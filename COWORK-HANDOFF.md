# Cowork — Session Handoff (2026-06-19)

Handoff for the next agent. Covers the connector rollout (Phases 5–8) and the new **Routines /
scheduled automations** feature (Phase 1 done, Phases 2–6 remaining). Read this top-to-bottom before
touching anything.

---

## 0. Environment & ground rules (IMPORTANT)

- **Repo:** LibreChat fork. Branch: `feature/cowork-mode`. Working folder:
  `C:\Users\HP\OneDrive\Desktop\Ajaia\Ethos\EthosEducate_Admin-`.
- **OneDrive caveat:** this folder is OneDrive-synced. `bash`/`git` via the shell often read **stale or
  partial** copies (a file can look truncated or a diff can look wrong). **Always use the Read/Grep/Glob
  tools for file contents** — they fetch the true file. Use git only for committed-history reads.
- **Cowork is additive & isolated:** everything is gated on `req.body.coworkProjectId`; it must never
  change the main Ethos Assistant chat, other agents, or global menus. Cowork data lives in its own
  collections (`CoworkProject`, now `CoworkRoutine`).
- **`librechat.yaml` and `.env` are gitignored** (only `.env.example` is tracked). Don't commit secrets.
- **Build matrix:** `packages/data-schemas` → `npm run build:data-schemas`; `packages/api` →
  `npm run build:api`; `packages/data-provider` → `npm run build:data-provider`; `api/` + `librechat.yaml`
  → backend restart; `client/` → client build. Local backend runs on `http://localhost:3080`.

---

## 1. Connectors — current state (Phases 1–8, committed)

Framework (Phases 1–4) was built earlier. This session wired the connectors and the write-safety gate.

**Working / wired:**
- **Monday** (OAuth, hosted `mcp.monday.com`) — tested, works, write-gate applies.
- **Microsoft 365** — four separate connectors/servers (`outlook`, `teams`, `onedrive`, `sharepoint`),
  Cloud Run URLs, Azure AD OAuth (`MICROSOFT_*` env). `chatMenu:false` (Cowork-only). Login works.
  ⚠️ Scopes are minimal (`openid profile User.Read`) — may not actually read mail/files until broadened.
- **WordPress / Airtable / Mailchimp** (API-key, per-teacher) — run in-process via `npx`. Mailchimp is
  **read-only** (chosen server can't send). See the credential bridge below.
- **YouTube** (platform/shared key) — needs `YOUTUBE_API_KEY` in `.env` + YouTube Data API v3 enabled.
- **Canva** — wired but its server is `http://localhost:8080/mcp`, which is **unreachable from a cloud
  backend** (works only with a local backend + that server running). Parked.
- **Google Workspace** — intentionally **commented out** in `packages/api/src/cowork/coworkConnectors.ts`
  (and removed from the spec list). Uncomment when a Workspace MCP server is deployed.

**The credential bridge (key concept):** API-key connectors store per-teacher creds under the MCP
server's per-user var key `mcp_<server>` (`Constants.mcp_prefix` = `'mcp_'`), which is the SAME place
LibreChat reads `customUserVars` from — so `processMCPEnv` injects them into the spawned per-user MCP
server automatically. The catalog `credentialFields` keys MUST equal the server's env-var names
(e.g. `WORDPRESS_SITE_URL`). Resolver: `connectorStoreKey(def)` in `cowork.js` and
`coworkConnectorStoreKey(def)` in `initialize.js`.

**Tool injection:** in `initialize.js`, Agent-mode-only, for each connected `available` connector it adds
`${Constants.mcp_all}${Constants.mcp_delimiter}${server}` (= `sys__all__sys_mcp_<server>`) to the agent's
tools — grants the whole server toolset without hard-coding tool names. OAuth "connected" status uses
`getMCPSetupData` + `getServerConnectionStatus` (same source the UI shows).

**Phase 8 write-safety (soft, prompt-driven):** when a connected connector `hasWriteActions`, the agent
gets an instruction to preview write actions as a fenced ` ```action ` block and wait for approval. The
client (`CoworkActionCard.tsx` + `extractAction`, wired in `CoworkChat.tsx`) renders an "Approve & run"
card. ⚠️ This is NOT enforced — the model is merely asked to wait. Hardening to a real tool-call
interceptor is needed (and is required for the Routines approval queue — see §3).

**Connector files:** `packages/api/src/cowork/coworkConnectors.ts` (+ `.spec.ts`),
`api/server/services/Endpoints/agents/initialize.js`, `api/server/routes/cowork.js`,
`packages/data-provider/src/data-service.ts`, `client/src/components/Cowork/CoworkConnectorsPanel.tsx`,
`CoworkActionCard.tsx`, `CoworkChat.tsx`, and `librechat.yaml`.

---

## 2. Routines / Scheduled Automations — the plan

Goal: let a teacher save a prompt + schedule against a Cowork project; the coworker runs it
automatically and delivers the result, with no one in the chat. Scoped to Cowork only.

**Phased plan (ship one at a time):**
1. **Foundation + headless run-now** — model + a service that runs a Cowork agent run with no
   browser/HTTP, persists the result. **DONE & VALIDATED** (see §4).
2. **Scheduler** — cron poller that finds due routines (`enabled && nextRun <= now`), claims each
   atomically (multi-instance safe), runs it, recomputes `nextRun`. *(Deployment note: needs an
   always-on backend; if prod scales to zero, trigger via an external ping.)*
3. **Routines UI** — a "Routines" tab in the Cowork pane: create (prompt + schedule picker + project),
   list, enable/disable, last-run status, "Run now".
4. **Delivery + run history** — result to a message / workspace file / email draft; per-routine run log.
5. **Unattended write policy + approval queue** — see §3. This is also where Phase 8 becomes a real,
   enforced interceptor.
6. **Hardening** — timeouts, retries/backoff, quotas (max routines/user, min interval), failure alerts.

---

## 3. The approval-queue design (Phase 5) — decided

The Phase 8 approval card is synchronous (human clicks in chat). Routines have no human at run time, so:
- **Make approval asynchronous.** A write action in a scheduled run is **not executed and not dropped** —
  it's captured as a persisted **pending approval** (`CoworkPendingAction`: the real tool call + args +
  preview). The teacher sees an "N actions awaiting approval" indicator and approves/rejects later;
  approve → it executes then.
- **Per-routine `autoApprove` opt-in (default off).** If enabled, writes execute on the scheduled run
  with no queue — a conscious risk decision, scoped to that routine. (Field already exists on the model.)
- **This forces the Phase 8 hardening:** to queue and later execute an action you must capture the actual
  tool call (not just have the model emit a card). So build ONE real interceptor that serves both: chat =
  intercept→card→approve→release now; routine = intercept→persist→approve later→release then.

---

## 4. Routines Phase 1 — what was built (DONE, tested working)

**Validated:** created a routine and ran it via API → `{ "conversationId": "...", "status": "success" }`,
output saved to a conversation linked to the project. (A benign `execute_code "bash" unsupported` log can
appear — that's normal agent behavior, only JS/TS/Python are supported; the run self-corrects.)

**Files added/changed:**
- `packages/data-schemas/src/schema/coworkRoutine.ts` — schema. Fields: `name`, `user`, `projectId`,
  `prompt`, `cronExpression` (Phase 2), `mode` (default `agent`), `enabled`, `autoApprove` (Phase 5),
  `deliveryTarget` (Phase 4), `nextRun`, `lastRun`, `lastStatus`, `lastError`, `lastConversationId`.
  Indexes: `{enabled,nextRun}` (scheduler), `{user,updatedAt}`.
- `packages/data-schemas/src/models/coworkRoutine.ts` — model factory.
- `packages/data-schemas/src/models/index.ts` — registered `CoworkRoutine` (so `{...models}` exposes it).
- `api/models/CoworkRoutine.js` — CRUD: `createCoworkRoutine`, `getUserCoworkRoutines`,
  `getCoworkRoutine`, `updateCoworkRoutine`, `deleteCoworkRoutine`, `markRoutineRun`. Ownership-scoped by
  `user`; `createCoworkRoutine` verifies the project belongs to the user.
- `api/server/services/Cowork/CoworkRoutineRunner.js` — **the headless runner**. Builds a synthetic
  `req` (user + body with `endpoint:'agents'`, `agent_id:'agent_cowork_default'`, `coworkProjectId`,
  `coworkMode`, `text`) + a no-op `res`, runs the REAL `buildEndpointOption` middleware →
  `initializeClient` → `client.sendMessage`, awaits persistence, `saveConvo` + `addCoworkProjectConversation`
  to link the run to the project, and records `markRoutineRun`. Uses a plain `AbortController` (no
  GenerationJobManager). Export: `runRoutine(routine)`, `COWORK_AGENT_ID`.
- `api/server/routes/cowork.js` — routes (all behind `requireJwtAuth`, ownership-scoped):
  `GET /api/cowork/routines?projectId=`, `POST /api/cowork/routines`,
  `GET/PATCH/DELETE /api/cowork/routines/:routineId`, `POST /api/cowork/routines/:routineId/run`.

**Why headless (not cron→HTTP):** the chat endpoint needs a logged-in user's JWT (cron has none) and is
built to stream over SSE to a browser (cron has no consumer). The runner reuses the same engine
(middleware + initializeClient + sendMessage + persistence) but drops the HTTP/SSE shell. Only new
concept = the routine definition collection.

**Build to run Phase 1:** `npm run build:data-schemas` + restart backend. No client build (no UI yet).

**Manual test (Thunder Client / Postman):** base `http://localhost:3080`, header
`Authorization: Bearer <JWT>` (the JWT is the long `eyJ...` value from a logged-in request's
Authorization header — NOT the user id). Flow: `GET /api/cowork/projects` → pick `_id` →
`POST /api/cowork/routines` `{projectId,name,prompt}` → `POST /api/cowork/routines/<id>/run` `{}`.
A ready Postman collection exists at `cowork-routines.postman_collection.json` in the repo root.

---

## 5. Next step

**Phase 2 — the scheduler.** Add a backend cron poller (e.g. an interval that queries
`CoworkRoutine.find({ enabled:true, nextRun:{$lte:now} })`, claims each via atomic `findOneAndUpdate`,
calls `runRoutine`, then sets the next `nextRun` from `cronExpression`). Start it once on server boot
(guard with an env flag like `COWORK_ROUTINES_ENABLED`). Keep multi-instance safety (the atomic claim).
Add cron-expression parsing/validation in `createCoworkRoutine`/`updateCoworkRoutine`.

---

## 6. Known flaws / things to harden (from this session's review)

Highest priority first:
1. **Phase 8 write gate is soft (prompt-only)** — not enforced. Build the real tool-call interceptor
   (also unblocks the Routines approval queue). Monday/WordPress/Airtable can currently write without a
   hard gate.
2. **Third-party `npx` MCP servers** (WordPress/Airtable/Mailchimp/YouTube) — unpinned, run arbitrary
   code in-process with user creds, depend on npm registry at runtime. Pin versions + pre-bake into the
   Docker image for prod; consider sandboxing.
3. **`execute_code` execution bridge** — arbitrary code + auto-`pip install` on the backend. Verify it's
   sandboxed (workspace escape? network? resource limits?). Bigger surface than connectors.
4. **Multi-tenant isolation audit** — confirm EVERY cowork workspace route (tree/file/download/upload/
   delete/archive/checkpoints) re-checks project ownership (IDOR risk).
5. **"Read-only" Ask/Plan modes are prompt-enforced** — verify `execute_code` is actually stripped, not
   just instructed against, in those modes.
6. **Web search is dead** (`TAVILY_API_KEY` empty) — the coworker can't research until a key is set.
7. **No RAG over workspace files**; **thin tests**; **Trace panel** event-shape unverified.
8. **MS365 scopes too narrow**; **Mailchimp read-only** vs the "send newsletters" intent.

---

## 7. Useful pointers

- Connector catalog: `packages/api/src/cowork/coworkConnectors.ts`.
- Run-path injection / modes / memory / connectors: `api/server/services/Endpoints/agents/initialize.js`.
- Cowork routes: `api/server/routes/cowork.js`. Models: `api/models/CoworkProject.js`,
  `api/models/CoworkRoutine.js`.
- Headless runner: `api/server/services/Cowork/CoworkRoutineRunner.js`.
- Client: `client/src/components/Cowork/*`, data layer `client/src/data-provider/Cowork/*`.
- Constants: `mcp_prefix='mcp_'`, `mcp_delimiter='_mcp_'`, `mcp_all='sys__all__sys'`
  (`packages/data-provider/src/config.ts`).
- Cowork agent id: `agent_cowork_default` (seed: `config/seed-cowork-agent.js`).
- Earlier plan docs: `COWORK-CONNECTORS-PLAN.md`, `COWORK-NEXT-STEPS.md`, `COWORK-DEVIATIONS.md`.
