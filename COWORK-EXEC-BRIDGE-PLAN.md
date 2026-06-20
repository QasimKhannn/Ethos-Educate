# Cowork — Code Execution Bridge: Implementation Plan (for sign-off)

> How the Cowork agent runs code that reads the project workspace (incl. uploaded
> folders) and writes deliverables back — using the existing local executor, with
> **zero change to current chat behavior** and **no new hosting**.

_Status: awaiting sign-off. No code written yet._

---

## Goal

Make `execute_code`, for a Cowork project conversation, run **in the project's
workspace** so the agent can read the uploaded files/folders and write outputs
(e.g. `output/deck.pptx`) directly back into the workspace the user sees.

## Principles

1. **Work-in-place** — code runs with its working directory = the project workspace.
   No copy-in/copy-out, so it handles any-size folders and writes land in the workspace
   automatically.
2. **Clean environment** — executed code receives only the *operational* env the runtime
   needs (PATH, HOME, temp dir, locale, system vars, python/venv/pip vars). Backend
   secrets (API keys, `MONGO_URI`, JWT secret, …) are **not** passed in.
3. **Bounded** — a Cowork execution timeout (plus the executor's existing pip-install
   timeout).
4. **Cowork-only & opt-in** — new behavior activates **only** when a request belongs to a
   Cowork project. The shared executor's default path (current chats) is untouched.
5. **No new infra** — reuses the existing local executor (`python3`/`node` on the server).
   Container isolation + resource limits are **out of scope** here (production hardening,
   owned by senior/devops).

## How it works (runtime flow)

1. User chats inside a Cowork project → the chat request carries a **`coworkProjectId`**.
2. When the agent loads its `execute_code` tool
   (`api/server/services/ToolService.js`), it detects the Cowork project, resolves the
   workspace dir (via `CoworkWorkspaceService`), and creates the execution tool in
   **Cowork mode**: `workingDir = <workspace>`, `cleanEnv = true`, Cowork `timeout`.
3. The agent's code reads inputs (`./mnt/data/...` or workspace-relative) and writes
   outputs (`./output/...`) directly in the workspace.
4. stdout/stderr return to the agent as the tool result; the Workspace panel refresh shows
   new/changed files.
5. **Non-Cowork chats:** `coworkProjectId` is absent → the default executor path runs
   exactly as today.

## Components & changes

| Area | Change | File(s) |
|---|---|---|
| Executor | Add **opt-in** params `workingDir` (use this dir instead of a temp sandbox; don't delete it) + `cleanEnv` (allowlisted env). Defaults = today's behavior. | `packages/api/src/tools/localCodeExecution.ts` (+ the PTC wrapper that calls it) |
| Clean-env helper | Allowlist PATH/HOME/TMP/locale/system + python/pip/venv vars; drop app-specific vars. | `packages/api/src/tools/localCodeExecution.ts` |
| Tool loading | **Cowork branch**: if request is a Cowork project conversation, build `execute_code` with `workingDir`/`cleanEnv`/timeout; else unchanged. | `api/server/services/ToolService.js` |
| Workspace path | Resolve project workspace absolute path from `projectId`. | reuse `CoworkWorkspaceService` |
| Conversation→project link | Cowork chat sends `coworkProjectId` with each message; backend reads it during tool loading. No conversation-schema change. | chat integration (task 18) + `ToolService.js` |

## Dependency / sequencing

The bridge needs the request to carry `coworkProjectId`, which the **Cowork chat
integration (task 18)** provides. Recommended order: **chat integration first**, then this
bridge — or build the bridge behind the flag and connect when the chat lands.

## Safety — current chats stay identical

- All new behavior is gated on `coworkProjectId` being present; regular chats never set it.
- New executor params default to current behavior.
- A test asserts the non-Cowork execution path is unchanged.
- Clean-env applies only in Cowork mode; the shared executor's env handling is untouched.

## Out of scope (separate, senior/devops)

- Container/process isolation + CPU/memory limits (production hardening).
- Global secret-stripping for non-Cowork chats (separate, reversible security decision).
- Pre-baking python packages into the prod image (devops; removes slow first-run installs).

## Requirements to run

- `python3`/`python` installed where the backend runs (dev + prod); node already present.
- Outbound network + writable fs for first-run `pip install` (or pre-installed packages).

## Test plan

- **Unit:** clean-env keeps operational vars + drops secrets; `workingDir` mode writes into
  the given dir and doesn't delete it; non-Cowork path byte-identical to today.
- **Manual:** in a Cowork project, upload a CSV → ask the agent to chart it and save to
  `output/` → file appears in the workspace tree. Read a file from an uploaded folder.
  Confirm a normal chat's code execution behaves exactly as before.

## Open decisions (need your sign-off)

1. **Executor change style** — (a) opt-in params on the shared executor [less duplication]
   vs (b) a separate Cowork execution path reusing exported primitives [max isolation].
   *Recommend (a)* with strict defaults + a regression test.
2. **Sequencing** — do the chat integration (task 18) before this bridge? *Recommend yes.*
3. **Cowork timeout** — default executor cap is 30s; doc generation may want **60–120s**.
   Pick a value.
4. **Write scope** — agent writes only under `output/`, or anywhere in the workspace?
   *Recommend anywhere in the workspace* (so it can edit your files), with new deliverables
   encouraged into `output/`.
