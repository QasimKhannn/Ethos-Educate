# Cowork — Phase C: Write paths (gated by Phase B)

_Do not start until the Phase B interceptor + isolation audit are in. Every external write here flows through
the enforced approval gate._

**Isolation guarantee:** new tools operate only within the project workspace / that user's connected creds,
only on Cowork runs; no global config or other-agent impact.

---

## C1 — GitHub workspace git (clone / commit / push)

**Goal:** import a repo into the project workspace, let the coworker edit files (existing exec bridge), then
commit & push back.

**Work — two dedicated backend tools (not raw shell, for multi-tenant safety):**
1. `git_clone(repoUrl, [branch])` — clone into the project workspace dir using the user's stored PAT (same
   credential bridge as the GitHub connector). Confined to the workspace; validates the URL/host.
2. `git_commit_push(message, [branch])` — stage, commit, push. **Push is a write action → routed through the
   Phase B interceptor** (approval required; or Routine `autoApprove`).
3. **UI:** an "Import repo" action in the Cowork view (repo URL → clone); commit/push surfaces as an approval
   card.

**Files:** new tools in the Cowork tool set + registration in `initialize.js`; workspace resolution reuses
`CoworkWorkspaceService`; client gets an import button.
**Build:** packages + backend + client. **Effort:** medium.
**Test:** import a test repo, edit a file via the coworker, commit & push → change appears on GitHub only after
approval; confirm operations can't escape the workspace dir.

---

## C2 — Finish connector catalog + enable connector writes

**Work:**
1. **Unpark known-broken catalog items** as needed: Canva (localhost URL → reachable/hosted server), MS365
   (broaden scopes so mail/files actually read), Google Workspace (currently commented out — enable when a
   Workspace MCP server is deployed).
2. **Enable write connectors behind the Phase B interceptor** (e.g. Monday, WordPress publish): writes now hit
   the enforced gate instead of the soft prompt.
3. **UX polish:** accurate connected/disconnected status, disconnect action, clearer errors/help.
4. **Supply-chain:** pin + pre-bake any `npx` MCP servers into the Docker image for prod.

**Files:** `coworkConnectors.ts`, `initialize.js`, `CoworkConnectorsPanel.tsx`, `librechat.yaml` (Cowork-scoped
entries only).
**Build:** packages + backend + client. **Effort:** small–medium.
**Test:** a write connector action is blocked until approved; status/disconnect behave correctly.

---

### Phase C exit criteria
GitHub push and connector writes work end-to-end, each gated by the enforced approval flow; catalog statuses are
accurate. **Stop for review before Phase D.**
