# Cowork — Phase A: Safe features (no new write surface)

_Read-only / additive features that can ship first. Nothing here executes external writes, so none of it
is blocked on the Phase B hardening._

**Isolation guarantee (applies to every item):** all behavior is gated on `coworkProjectId`; data lives in
Cowork-only collections; no change to the global tool registry, `librechat.yaml` global config, other agents,
or the main Ethos chat. Each item is independently revertible.

Decisions locked: custom skills = **per-user, markdown-only**; preview surface = **"Preview" tab**;
BYO transport (Phase D) = **remote-only**; **GitHub auth = OAuth** (via GitHub's official remote MCP server,
modeled on the existing Monday OAuth connector — no dependency on Phase D).

---

## A1 — Live artifact preview ("create a site → preview before download")

**Current state:** the full artifacts/Sandpack stack already exists for the main chat
(`client/src/components/Artifacts/Artifact.tsx`, `ArtifactPreview.tsx` = Sandpack live preview,
`client/src/Providers/ArtifactsContext.tsx`). It is deliberately **off** for the Cowork agent
(`config/seed-cowork-agent.js` never sets the `artifacts` field).

**Work:**
1. **Enable on the Cowork agent.** Set `agentData.artifacts = 'default'` in `config/seed-cowork-agent.js`;
   re-run `npm run seed-cowork-agent`; restart backend. (Scoped to `agent_cowork_default` only.)
2. **Preview tab in the Cowork view.** Add a "Preview" tab in `CoworkProjectView.tsx` (alongside
   Trace/Workspace) that renders the current run's artifact by reusing the existing `ArtifactPreview`
   (Sandpack) + `ArtifactsContext`. Detect artifact content from the stream in `useCoworkChat.ts` /
   `CoworkChat.tsx`. Single self-contained file (static HTML/CSS/JS or one React component) — no
   multi-file dev server.
3. **Prompt nudge (one line, Cowork instructions only).** When the user asks for a page/site, produce a
   **self-contained artifact** (so it previews live) **and** also write the file to `output/` so the
   existing download works.
4. **Download:** already supported (workspace `output/` files are downloadable). No backend change.

**Files:** `config/seed-cowork-agent.js`; `client/src/components/Cowork/CoworkProjectView.tsx`,
`CoworkChat.tsx`, `useCoworkChat.ts`; reuse `client/src/components/Artifacts/*` + `ArtifactsContext`.
**Build:** backend re-seed + client. **Effort:** small–medium. **Risk:** low (reuses proven components).
**Test:** ask the coworker to "make a landing page" → preview renders → download the file.

---

## A2 — Custom skills (per-user, markdown-only)

**Current state:** built-in toggling is fully wired (`CoworkSkillsService`, `GET .../skills`,
`enabledSkills` on `CoworkProject`, injection at `initialize.js:225–245`, `CoworkSkillsPanel.tsx`).
Only the fixed built-ins (docx/pdf/pptx/xlsx) exist — no custom uploads.

**Work:**
1. **Schema:** new `CoworkSkill` collection (`packages/data-schemas`): `{ user, name, description, content,
   source:'custom', createdAt }`. **User-scoped.** Markdown body only — no bundled executable scripts in v1.
2. **Model + CRUD:** `api/models/CoworkSkill.js` — create / list-by-user / get / delete, all ownership-scoped.
3. **Service:** extend `CoworkSkillsService` — `listCustomSkills(userId)`, `loadCustomSkill(userId,id)`, and a
   resolver so `enabledSkills` entries can be `builtin:<id>` or `custom:<id>`. `buildSkillsPrompt` is unchanged
   (it just concatenates markdown).
4. **Routes:** `POST /api/cowork/skills` (name + description + pasted markdown, or upload a `.md`/`SKILL.md` →
   reuse `parseFrontmatter`); `DELETE /api/cowork/skills/:id`; extend `GET .../skills` to merge built-in +
   custom with `enabled` flags.
5. **Injection:** in `initialize.js:225–245`, resolve enabled ids across both sources before building the prompt.
6. **UI:** "Add skill" form + delete on custom cards in `CoworkSkillsPanel.tsx`.

**Isolation:** custom skills belong to the creating user only; never surfaced to other teachers; injected only
into Cowork runs. **Build:** packages + backend + client. **Effort:** small–medium.
**Test:** create a custom skill, enable it, confirm its instructions appear in the agent's behavior; confirm a
second user cannot see or enable it.

---

## A3 — GitHub connector (read scope, OAuth)

**Current state:** none (the existing `githubStrategy.js` is login-only, unrelated).

**Decision: OAuth** via GitHub's official **remote** MCP server — the same mechanism as the working
**Monday** connector (`auth:'oauth'`, hosted MCP URL). No dependency on Phase D's dynamic BYO registration.

**Work:**
1. **One-time setup:** register a GitHub OAuth App (client id/secret + callback), store creds in `.env`
   (like the `MICROSOFT_*` / Monday OAuth env vars). Configure GitHub's official remote MCP server as an
   OAuth connector entry in `librechat.yaml` (Cowork-scoped, `chatMenu:false`).
2. **Catalog:** add a `github` entry to `COWORK_CONNECTORS` (`packages/api/src/cowork/coworkConnectors.ts`):
   `auth:'oauth'`, `mcpServer:'github'`, read tools (search/read repos, issues, PRs, file contents),
   `hasWriteActions:false` for v1.
3. **Wiring:** reuse the existing OAuth connect flow + `getMCPSetupData`/`getServerConnectionStatus` status
   path and the tool injection at `initialize.js:326–440`. The connect UI in `CoworkConnectorsPanel.tsx`
   already handles OAuth connectors (Connect → consent → connected).

**Isolation:** per-teacher OAuth token in the encrypted user store; tools injected only into Cowork agent runs.
**Build:** packages (catalog) + backend + `librechat.yaml` + client (minor). **Effort:** small–medium (OAuth
app registration is the extra step vs PAT).
**Test:** click Connect → GitHub consent → pick repos → ask the coworker to "list my repos / read file X".

> Note: this is the read connector. GitHub **write** (issues/PRs) and **workspace push** come in Phase C
> behind the enforced write gate.

---

### Phase A exit criteria
Preview tab renders a generated site and it downloads; a user can add/enable/delete a private custom skill and
see its effect; GitHub read connector returns repo data — all with zero impact on the main app. **Stop here for
review before Phase B.**
