# Cowork — Deviations & Parked Items

> Living record of where the implementation departs from **ETHOS-COWORK-PLAN-V2.md**, and
> what is intentionally parked. Update this as decisions change. Everything Cowork-related
> in the code is grep-able under `cowork`.

_Last updated: 2026-06-15 · branch `feature/cowork-mode`_

---

## Status snapshot

| Phase | State |
|---|---|
| 0 — Foundations (agent, capabilities, provider) | **Done & verified** (agent replies via Azure) |
| 1 — Workspace (service, routes, panel) | **Done** except the sandbox bridge (parked, see D-2) |
| 2 — Skills (port, service, routes, injection, panel) | Skills **rewritten original** + service done; routes/injection/panel **remaining** |
| 3–6 | Not started |
| 5 — Dedicated Cowork UI | **Pulled forward** (see D-7) |

---

## Deviations from the plan

### D-1 — Provider: reused existing `azureOpenAI`, no separate "Azure Foundry" endpoint
- **Plan (§7):** add an `Azure Foundry` custom endpoint with `AZURE_FOUNDRY_*` env vars.
- **Did:** the Cowork agent uses the existing `azureOpenAI` endpoint already configured in
  `librechat.yaml` (instance `arij-me35gkee-eastus2`). Agent model is the endpoint's model
  **key** `gpt-5-chat` (which maps to deployment `gpt-5.2-chat`), not the deployment name.
- **Why:** the existing Azure config already powers the `agents` endpoint; a second endpoint
  was redundant. Verified end-to-end (agent replies).
- **Action for prod:** when seeding the agent in prod, pass the model arg matching that
  cluster's `azureOpenAI` model key.

### D-2 — Sandbox (Decision D1): no Code Interpreter key; self-host not viable
- **Plan:** choose hosted Code Interpreter **or** self-hosted sandbox container.
- **Reality:** `execute_code` resolves via `getCodeBaseURL()` to LibreChat's **hosted, paid**
  Code Interpreter API and needs `LIBRECHAT_CODE_API_KEY`. That key is **not set**, and the
  hosted API is **not self-hostable** from this repo — so the plan's "self-host" option isn't
  actually available.
- **Impact:** anything requiring `execute_code` cannot run or be tested locally yet. See Parked.
- **Action:** obtain a `LIBRECHAT_CODE_API_KEY` for local/dev, or confirm prod sandbox reachability.

### D-3 — Workspace keyed by `conversationId`, not `projectId`
- **Plan (Phase 1/5):** per-**project** workspace folder.
- **Did:** Phase 1 keys workspaces by **conversationId** (`/uploads/cowork-workspaces/<conversationId>/`),
  ownership checked via `getConvo`.
- **Why:** testable immediately without the Phase 5 project model. The service
  (`CoworkWorkspaceService`) takes an opaque id, so promoting to project-scoping later is a
  small change, not a rewrite.
- **Note:** a workspace only activates once a conversation has a real id (after the first
  message); a brand-new unsent chat (`id = "new"`) shows an empty-state.

### D-4 — Backend services live in `packages/api` (TS), not `api/server/services` (JS)
- **Plan (§8):** listed `api/server/services/WorkspaceService.js`.
- **Did:** `packages/api/src/cowork/CoworkWorkspaceService.ts` + `CoworkSkillsService.ts`, with
  thin JS route wrappers in `api/server/routes/cowork.js`.
- **Why:** matches the plan's own §6.5 convention ("TS in `packages/api`, thin JS wrappers").
- **Cost:** editing these requires rebuilding `@librechat/api` before the backend sees changes.

### D-5 — Skills are ORIGINAL, not ported from Open Cowork (licensing)
- **Plan (Phase 2):** copy Open Cowork's `.claude/skills/*/SKILL.md` into `api/lib/skills/`.
- **Did:** ported them, then **removed them**, and **wrote original** SKILL.md files instead.
- **Why:** the Open Cowork skill files carry an Anthropic `LICENSE.txt` (© 2025 Anthropic)
  that forbids retaining copies outside Anthropic's Services, reproducing, creating derivative
  works, or distributing them. "Open Cowork" is a **third-party** open-source app, not official
  Anthropic; it can use those files because it runs Claude Code (authorized use of the
  Services) — that does **not** grant us a license, and EduChat runs on Azure/GPT, not
  Anthropic's Services. Shipping them would conflict with the license.
- **Result:** 5 original `SKILL.md` files (pptx, docx, xlsx, pdf, skill-creator) built around
  open-source libraries (`python-pptx`, `python-docx`, `openpyxl`, `pypdf`/`reportlab`).
  **5 files instead of 138** — see D-6.
- **Open item:** confirm with whoever owns legal before shipping; this is the safe path regardless.

### D-6 — Skills use mature libraries instead of raw-OOXML tooling
- **Open Cowork shipped:** ~138 files/skill-set — mostly public OOXML `.xsd` schemas (~80),
  duplicated pack/unpack/validate scripts, an `html2pptx` pipeline, etc.
- **Did:** rely on the libraries (which emit valid OOXML), so the schemas, pack/validate
  scripts, and html2pptx pipeline are **unnecessary**. Recipes live inline in each SKILL.md.
- **Tradeoff:** lower out-of-the-box design fidelity, especially for slide decks. These skills
  are **v1, untested** until the Code Interpreter key (D-2) — expect a wording/quality tuning
  pass once we can run them. The library approach makes that tuning, not a rewrite.

### D-7 — Reordering: dedicated Cowork UI pulled forward
- **Plan order:** finish Phase 2 (injection, panel), then Phases 3–4, then Phase 5 (dedicated
  Cowork projects + entry).
- **Doing:** building the **dedicated Cowork UI** now, ahead of the remaining key-gated backend.
- **Why:** the key is imminent; the execution-dependent work (sandbox bridge, skill injection,
  file generation) should be built **test-driven after the key**, not blind. The UI is the
  highest-value work that's fully testable **without** the key, and it's the final home for the
  workspace/skills/trace panels (so we build those into it once, not migrate them).
- **Consequence:** this engages the Phase 5 project model early and will re-home the
  conversation-keyed workspace (D-3) into a project-scoped, dedicated layout.

### D-8 — Cowork projects use a SEPARATE collection, not an extension of `Project`
- **Plan (Phase 5):** "extend the existing project system; don't fork."
- **Did:** created a separate `CoworkProject` model/collection
  (`packages/data-schemas/.../coworkProject.ts`, `api/models/CoworkProject.js`, routes under
  `/api/cowork/projects`).
- **Why:** even additive fields on the shared `Project` collection would leak Cowork projects
  into the existing projects list/nav unless those queries were filtered by `type` — and
  filtering means *modifying existing behavior*, which the user explicitly wanted to avoid.
  A separate collection guarantees the current projects feature (and the internal global
  "instance" project) is untouched. Tradeoff: some duplicated CRUD. Accepted for isolation.

---

## Parked — blocked on the Code Interpreter key (D-2)

- **Phase 1 / task 8:** sandbox ↔ workspace file flow (push workspace files into the
  `execute_code` session, persist generated outputs back). Until this + the key exist, an
  agent cannot read uploaded workspace files or write deliverables to the workspace.
- **Phase 2 end-to-end:** skills actually generating real `.pptx/.docx/.xlsx/.pdf`, and
  validating/tuning the v1 skill wording against real output.
- **The "agent reads my uploaded file" behavior** users will expect — depends on task 8 + key.

---

## Remaining Phase 2 (buildable now, partly testable without the key)

- Enabled-skill state model + REST routes (list/toggle/create custom).
- Prompt injection of enabled skills into the Cowork agent system prompt — **verifiable via
  chat** (ask the agent what it can build) without running code.
- Skills panel UI (toggle cards + Create Skill editor) — built into the dedicated Cowork shell.

---

## Conventions & environment notes

- **Naming:** every Cowork file is prefixed/marked `cowork` (e.g. `CoworkWorkspaceService.ts`,
  `api/server/routes/cowork.js`, `// cowork` comments on edits to shared files) — grep `cowork`.
- **Permissioning (future):** Cowork will be gated by a new `COWORK` permission type via the
  existing admin permission engine (Phase 5 / §6.5), not a parallel system.
- **Dev environment:** the working folder is OneDrive-synced; during this session the Linux
  shell intermittently served stale/truncated reads of just-edited files and blocked deletes
  ("Operation not permitted"). File edits via the editor are authoritative; verify with the
  editor, not the shell. Strongly consider a non-synced path (`C:\dev\…`) for the repo.
- **Seeding for prod:** the Cowork agent lives in MongoDB; run `npm run seed-cowork-agent`
  once per environment/database (idempotent).
