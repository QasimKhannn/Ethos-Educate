# Cowork — Four-Feature Implementation Plan

_Scope: add exactly four capabilities to Cowork mode — (1) add skills, (2) add connectors,
(3) run/preview code in-platform, (4) connect GitHub. Nothing else changes. All work stays
additive and gated on `coworkProjectId`, per the existing Cowork rules._

Ground rules carried over from the existing handoffs:
- Cowork is **additive & isolated** — never touch the main Ethos chat, other agents, or global menus.
- Runtime injection point for agent instructions/tools: `api/server/services/Endpoints/agents/initialize.js` (~L153–440).
- Build matrix: `packages/*` → `npm run build:packages`; `api/` → backend restart; `client/` → client build.
- Secrets live in `.env` / `librechat.yaml` (gitignored). Per-user creds ride the **credential bridge** (`mcp_<server>` user vars → `processMCPEnv`).

---

## Feature 1 — Skills (toggle built-ins + upload custom)

### Current state (verified in code)
- **Built-in toggle: DONE.** `packages/api/src/cowork/CoworkSkillsService.ts` (`listBuiltinSkills`, `loadBuiltinSkill`, `buildSkillsPrompt`), `GET /api/cowork/projects/:id/skills`, `enabledSkills: string[]` on `CoworkProject`, PATCH to update, runtime injection at `initialize.js:225–245`, UI at `client/src/components/Cowork/CoworkSkillsPanel.tsx`. Built-in skills on disk: `api/lib/skills/{docx,pdf,pptx,xlsx,skill-creator}/SKILL.md`.
- **Custom upload: NOT built.** Only the fixed built-in set exists.

### Net-new work — custom skills
1. **Storage.** New Mongo collection `CoworkSkill` (user-scoped; optional projectId): `{ user, name, description, content, source:'custom', createdAt }`. Instructions-only markdown (a SKILL.md body). *No bundled executable scripts in v1* — that's a much larger security surface; defer.
2. **Service.** Extend `CoworkSkillsService`: `listCustomSkills(userId)`, `loadCustomSkill(userId, id)`; a resolver so `enabledSkills` entries can be `builtin:<id>` or `custom:<id>`. `buildSkillsPrompt` already just concatenates markdown, so injection is unchanged.
3. **Routes.** `POST /api/cowork/skills` (create: name + description + markdown, or upload a `.md`/`SKILL.md` file — reuse `parseFrontmatter`), `DELETE /api/cowork/skills/:id`, and extend the existing `GET .../skills` to merge built-in + custom with `enabled` flags.
4. **Injection.** In `initialize.js:225–245`, resolve enabled ids across both sources before `buildSkillsPrompt`.
5. **UI.** Add an "Add skill" affordance to `CoworkSkillsPanel.tsx`: name, description, paste-markdown (or file upload), plus delete on custom cards.
6. **Safety / multi-tenancy.** Scope custom skills to the owning user; never expose one teacher's skill to another. Content is prompt-injected, so treat as trusted-author-only.

**Effort:** small-to-medium (built-in half is done). **Build:** packages + backend + client.

**Open decision:** custom-skill scope — per-user (recommended) vs per-project vs org-shared.

---

## Feature 2 — Connectors (finish catalog + bring-your-own MCP)

### Current state (verified)
- Hardcoded catalog of 10 in `packages/api/src/cowork/coworkConnectors.ts` (YouTube, WordPress, Mailchimp, Airtable, Monday, Outlook, Teams, OneDrive, SharePoint, Canva) with a typed `CoworkConnectorDef`.
- UI `CoworkConnectorsPanel.tsx` (connect / always-on / API-key form / help). Credential bridge + tool injection at `initialize.js:326–440`. Soft (prompt-only) write-safety gate.

### Net-new work
**A. Finish catalog UX (small):** accurate connected/disconnected status, disconnect action, clearer error/help states; unpark the known-broken ones (Canva localhost URL, MS365 narrow scopes, Google Workspace commented out) as needed.

**B. Bring-your-own MCP server (medium-large, main risk):**
1. **Storage.** New `CoworkCustomConnector` collection (user-scoped) mirroring `CoworkConnectorDef`: `{ user, label, description, transport:'sse'|'http', url, auth:'none'|'apikey', credentialFields[], createdAt }`.
2. **Transport restriction (security).** v1 supports **remote URL / SSE-HTTP MCP servers only**. Do **not** allow arbitrary stdio/`npx`/command servers from end users (multi-tenant RCE risk). Credentials ride the existing bridge (encrypted per-user vars).
3. **Dynamic registration — the hard part.** LibreChat loads MCP servers from `librechat.yaml` at boot; user-defined servers must be registered **at runtime per user**. Needs a spike to confirm the cleanest hook (extend the per-user MCP init that already powers the API-key connectors so it also picks up `CoworkCustomConnector` rows). This is the one item with real unknowns.
4. **Injection.** Merge custom connectors with the catalog when building the connected-connector tool grants in `initialize.js`; reuse `mcp_all` to grant the whole server.
5. **Safety.** BYO URL = SSRF/exfil surface; add an allowlist or admin gate, and apply the same write-safety gate.

**Effort:** finish-catalog = small; BYO-MCP = the biggest single item. **Build:** packages + backend + client.

**Open decisions:** restrict BYO to remote URL/SSE only (recommended)? Per-user vs per-org? Admin-gated?

---

## Feature 3 — Run / preview code in-platform (simple: "preview a site before download")

### Current state (verified)
- **Backend exec bridge exists** (`execute_code`, Python/JS/TS, runs in the project workspace, writes to `output/`).
- **Artifacts/Sandpack stack fully exists in main chat** (`client/src/components/Artifacts/Artifact.tsx`, `ArtifactPreview.tsx` with `@codesandbox/sandpack-react`, `Providers/ArtifactsContext.tsx`) but is **intentionally disabled for the Cowork agent** (`config/seed-cowork-agent.js` — `artifacts` not set; comment says enable via `agentData.artifacts='default'`).

### Net-new work (aligned to "technically-dumb users just want a live preview")
1. **Enable artifacts on the Cowork agent.** Set `agentData.artifacts = 'default'` in `config/seed-cowork-agent.js`, re-run `npm run seed-cowork-agent`, restart backend. Agent now emits previewable artifact code.
2. **Render a Preview pane in the Cowork view.** The Cowork chat is a custom renderer (`CoworkChat.tsx` / `CoworkProjectView.tsx`), so reuse the existing Artifacts components: detect artifact content in the current run and render it via Sandpack in a **"Preview" tab** (next to Trace/Workspace). Single self-contained file (static HTML/CSS/JS or a React component) — no multi-file dev server.
3. **Prompt nudge.** Add one line to the Cowork instructions: when a user asks for a page/site, produce it as a **self-contained artifact** (so it previews live) **and** write the file to `output/` so the existing download works.
4. **Download.** Already covered — workspace `output/` files are downloadable today; "preview → download" needs no new backend.

**Effort:** small-to-medium (mostly wiring existing components into the Cowork pane). **Build:** backend (re-seed) + client. **Highest visual impact / best demo item.**

**Open decision:** none material — confirmed single-file preview.

---

## Feature 4 — Connect GitHub (browse via connector + workspace clone/commit/push)

### Current state (verified)
- No GitHub integration in Cowork. `api/strategies/githubStrategy.js` is **login-only OAuth** (scope `user:email`), unrelated.

### Net-new work
**A. Browse via connector (small — reuses the framework):**
- Add a `github` entry to `COWORK_CONNECTORS`: `auth:'apikey'`, `credentialFields:[{ key:'GITHUB_PERSONAL_ACCESS_TOKEN', secret:true }]`, pointed at a GitHub MCP server (read/search repos, issues, PRs, file contents). Rides the existing API-key credential bridge and tool injection — no new plumbing. `hasWriteActions:true` if we allow issue/PR writes (then the write-safety gate applies).

**B. Workspace git — clone / commit / push (medium):**
- Add **two dedicated backend tools** (not raw shell — safer, multi-tenant): `git_clone` (clone a repo URL into the project workspace using the stored PAT) and `git_commit_push` (stage, commit with a message, push to a branch). Both operate **only within the project workspace** and use the per-user PAT via the credential bridge.
- Flow: connect GitHub (PAT) → "Import repo" → agent edits files with the exec bridge → "Commit & push".
- **Safety:** confine to the project workspace dir; PAT encrypted per-user; treat push as a write action (approval gate).

**Effort:** connector = small; workspace git = medium. **Build:** packages (catalog) + backend (tools) + client (connect UI / import button).

**Open decision:** GitHub auth via **PAT** (fast, reuses the API-key bridge — recommended) vs an OAuth GitHub App (nicer UX, more setup).

---

## Production rollout order (this is a deployed product, not a demo)

Because everything ships to a multi-tenant production deployment, the two cross-cutting
foundations below are **in-scope work items**, not "later" — write paths cannot go live without them.

**Phase A — safe, no new write surface (ship first)**
1. **Feature 3 — Artifacts preview.** Read-only rendering; reuses existing Sandpack stack. High value, low risk.
2. **Feature 1 — Custom skills upload.** User-scoped, markdown-only; no code execution added.
3. **Feature 4A — GitHub connector, read scope only.** Browse/search repos/issues/PRs via PAT.

**Phase B — foundational hardening (required before any write path)**
4. **Real write-action interceptor.** Replace the soft, prompt-only gate with an enforced tool-call
   interceptor (intercept → preview/approve → release). This is the same interceptor the Routines
   approval queue needs, so it's build-once-use-twice.
5. **Multi-tenant isolation audit.** Every Cowork route/tool re-checks project + user ownership
   (workspace tree/file/download/upload/delete/checkpoints, all new routes). Closes the IDOR risk.

**Phase C — write paths (gated by Phase B)**
6. **Feature 4B — Workspace git (clone / commit / push).** Push treated as an approved write action.
7. **Feature 2A — Finish connector catalog + connector writes.** Unpark Canva/MS365/Workspace; enable
   write connectors behind the real interceptor.

**Phase D — biggest unknown + largest security surface (do last, spike first)**
8. **Feature 2B — Bring-your-own MCP.** Spike dynamic per-user MCP registration first; then build with
   remote-URL/SSE-only transport, an allowlist/SSRF guard, and the write gate applied.

## Cross-cutting requirements (production)
- **Multi-tenant isolation** — mandatory ownership re-check on every new route/tool (Phase B item 5).
- **Enforced write-safety** — the soft prompt gate is replaced, not shipped (Phase B item 4).
- **Secret handling** — all PATs / API keys / BYO creds stay in the encrypted per-user var store; never logged.
- **Supply-chain** — any MCP server run in-process (`npx`) must be version-pinned and pre-baked into the
  Docker image (never resolved from the npm registry at runtime in prod).
- **BYO-MCP egress** — outbound allowlist / SSRF protection for user-supplied server URLs.

---

## Decisions to resolve (let's discuss)

Each has a recommendation + the trade-off, so we can settle them before building.

1. **GitHub auth — PAT vs OAuth GitHub App.**
   - _PAT (recommended for speed):_ reuses the existing API-key credential bridge; teacher pastes a token.
     Downside: teachers must create/rotate tokens; broad scopes if they over-grant.
   - _OAuth App:_ nicer UX, scoped install, revocable centrally. Downside: more setup (app registration,
     callback, token refresh) and new plumbing beyond the bridge.
   - **Question:** are your end users comfortable creating a PAT, or do they need one-click OAuth?

2. **BYO-MCP transport — remote URL/SSE only vs also stdio/command.**
   - _Remote-only (strongly recommended):_ no arbitrary process execution from tenants. Covers hosted MCPs.
   - _Also stdio/`npx`:_ maximum flexibility but effectively lets a tenant run code on your backend — not
     acceptable in shared prod without heavy sandboxing.
   - **Question:** confirm remote-only, or is there a concrete server you need that's stdio-only?

3. **Custom skills — scope and capability.**
   - _Per-user, markdown-only (recommended v1):_ safe, simple; a skill is instructions the agent follows.
   - _Per-org shared / bundled scripts:_ powerful (reusable org playbooks, executable helpers) but adds a
     sharing model and a code-execution surface via the exec bridge.
   - **Question:** is per-user enough to start, or do teachers need to share skills across an org/team?

4. **Artifacts preview surface.**
   - _New "Preview" tab in the Cowork view (recommended):_ consistent with Trace/Workspace tabs.
   - _Side-by-side split pane:_ more like Claude/Lovable but more layout work in the custom Cowork UI.
   - **Question:** tab or split-pane for the live preview?

5. **Write-interceptor timing.**
   - Build it in Phase B (recommended) so write features land on a real gate — vs deferring and shipping
     writes on the soft gate (not recommended for prod).
   - **Question:** agreed to fund the interceptor before GitHub push / connector writes go live?
