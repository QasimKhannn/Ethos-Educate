# Cowork — In-Place Edit, Undo & Upload Hardening — Implementation Plan

> Plan for review **before** implementation. Follows the Cowork isolation rule: everything is
> additive and gated on `coworkProjectId` — **no effect on normal chat, projects, or other agents.**
> Grep everything under `cowork` / `.cowork`.
>
> _Drafted: 2026-06-18 · branch `feature/cowork-mode`_

---

## 1. Goals

1. **In-place edits with a gate** — the Cowork agent proposes changes to existing workspace files;
   the user reviews a diff and clicks **Apply** to commit them to the live file.
2. **Undo (Cursor/Copilot-style)** — every Apply creates a restorable checkpoint; the user can roll
   back to a previous state if something goes wrong.
3. **Re-download** — download a single changed file, or the **whole workspace as a `.zip`**, after edits.
4. **Upload hardening** — enable workspace quota + per-file cap, and make large folder uploads robust
   via **chunked** uploads instead of one giant request.

## 2. Non-goals / constraints

- **New-file creation is UNCHANGED.** When the agent *creates* a new file (a doc, sheet, etc.), it keeps
  working exactly as today: it writes the file into the workspace (the `output/` folder is **not**
  required — anywhere in the workspace is fine), the file appears in the Workspace panel, and the user
  downloads it. The staging/Apply/undo flow in this plan applies **only to edits of files that already
  exist** in the workspace. Creation never goes through staging.
- **Everything is COWORK-ONLY. We make NO changes to the existing project or chat section.** All limits,
  routes, services, prompt changes, and UI here are scoped to Cowork and gated on `coworkProjectId`.
- **Do not touch the global `fileConfig.serverFileSizeLimit`** (the 20 MB normal-chat upload cap) or any
  global `librechat.yaml` endpoint config. Cowork uploads use their **own** env knobs
  (`COWORK_UPLOAD_LIMIT_MB`, `COWORK_WORKSPACE_QUOTA_MB`), read only by `api/server/routes/cowork.js`.
- **Not** editing the user's actual local-machine files (browser can't; out of scope). Re-download is
  the bridge for local files; OneDrive/SharePoint write-back is a *future* follow-up, not this plan.
- **Not** touching the global chat, `Project` collection, the shared tool registry, or other agents.
- **No token-config changes** (per decision — left as-is for now).
- All new on-disk machinery lives under a hidden `.cowork/` dir so the Workspace panel stays clean.

## 3. Current state (what we build on)

| Piece | Location | Reuse |
|---|---|---|
| Workspace store | `packages/api/src/cowork/CoworkWorkspaceService.ts` (+ `.spec.ts`) | `resolve/readFile/writeFile/getTree/deleteFile/getUsage` already exist & are quota-safe |
| Exec bridge (in-place run) | `api/app/clients/tools/util/handleTools.js` (~L324) | already runs `execute_code` with `workingDir = <workspace>` |
| REST routes | `api/server/routes/cowork.js` | add edit/checkpoint/zip routes here |
| Model layer | `api/models/CoworkProject.js` | checkpoint metadata if we store it in Mongo |
| Agent prompt | `config/seed-cowork-agent.js` (`COWORK_INSTRUCTIONS`) | add the staging convention |
| Shared API | `packages/data-provider/src/{api-endpoints,data-service,keys}.ts` | add endpoints/types/keys |
| FE data layer | `client/src/data-provider/Cowork/{queries,mutations}.ts` | add queries/mutations |
| Workspace UI | `client/src/components/SidePanel/Cowork/CoworkWorkspace*.tsx` | add diff + checkpoints + zip |
| Upload | `client/src/data-provider/Cowork/mutations.ts` (`useUploadCoworkFilesMutation`) + `CoworkWorkspaceHeader.tsx` | chunk it |

## 4. Design overview — staging + checkpoints

```
Agent run ──► writes proposed versions to  .cowork/proposed/<path>   (NOT the live file)
                                   │
User opens Workspace ──► backend diffs live vs proposed ──► "Pending changes" cards
                                   │
        Apply / Apply all ────────┤
                                   ▼
        1) snapshot live file → .cowork/history/<checkpointId>/<path>
        2) promote .cowork/proposed/<path> → <path>   (live)
        3) record checkpoint {id, ts, message, paths[]}
                                   │
        Undo (Restore checkpoint) ─► copy snapshot back over live files
        Discard ───────────────────► delete the staged proposed file(s)
        Download ──────────────────► single file (exists) OR whole workspace .zip (new)
```

**This flow is for EDITS of existing files only.** Creating a new file is unchanged — the agent writes
it straight into the workspace and it shows up in the panel for download (see §2).

Why staging-as-file-write (not chat text): the agent already writes files via `execute_code`, so this
is a small prompt change; and because the proposed content never passes through the model's
output/context, **file size is irrelevant to token limits.** Diffs are computed server-side.

## 5. Hidden machinery layout

```
<workspace>/<projectId>/
  ├─ <user files / output/ …>            ← visible, unchanged
  └─ .cowork/                            ← hidden (added to COWORK_HIDDEN_ENTRIES)
       ├─ proposed/<path>                ← staged edits awaiting Apply
       ├─ history/<checkpointId>/<path>  ← pre-Apply snapshots (undo source)
       └─ checkpoints.json               ← ordered checkpoint manifest
```

`.cowork` is added to `COWORK_HIDDEN_ENTRIES` so it never appears in the tree, downloads, or zip.

## 6. Workstreams (detailed)

### A. Config & upload hardening

- **A1 — Enable limits (Cowork-only env vars; route already reads them, no global change).**
  Set in the real `.env`: `COWORK_WORKSPACE_QUOTA_MB=2000` (2 GB per project workspace) and
  `COWORK_UPLOAD_LIMIT_MB=500` (per-file). The per-file cap is set **high (500 MB)** on purpose so it
  never blocks a normal user — including large meeting **audio/video** uploads (mp3/mp4) — while still
  stopping a runaway single file. The 2 GB workspace quota **excludes** the hidden `.cowork/` history
  (see §9). Document both in `.env.example`. These do **not** touch `fileConfig.serverFileSizeLimit`.
- **A2 — Chunked folder upload.** Change `useUploadCoworkFilesMutation` to send files in batches
  (e.g. **200 files / ~50 MB per request**, whichever first), sequentially, aggregating progress.
  `CoworkWorkspaceHeader` gets a simple progress indicator ("Uploading 412 / 1,830…"). Server route
  is unchanged (each batch is a normal multipart POST). Makes large folders resumable batch-by-batch
  and bounds browser memory.

### B. Backend — `CoworkWorkspaceService` (new methods, unit-tested)

- `stageProposed(path, data)` → write under `.cowork/proposed/`.
- `listProposed()` → paths with a staged version.
- `diffProposed(path)` → `{ kind: 'text'|'binary', hunks?|sizes }` (live vs proposed).
- `discardProposed(path | all)`.
- `applyProposed(paths[], message?)` → snapshot live → `.cowork/history/<id>/`, promote proposed→live,
  append to `checkpoints.json`. Returns the checkpoint.
- `listCheckpoints()` / `restoreCheckpoint(id)` / checkpoint **retention** (keep last N — proposed **20** —
  prune oldest history dirs).
- `zipWorkspace()` → stream a `.zip` of visible files (excludes `.cowork/`).
- Add `.cowork` to `COWORK_HIDDEN_ENTRIES`; ensure quota accounting **excludes `.cowork/`** (§11).

### C. Backend — routes (`api/server/routes/cowork.js`, all owner-scoped)

```
GET    /projects/:id/changes                  → pending proposed edits (+ diff summary)
GET    /projects/:id/changes/diff?path=        → full diff for one file
POST   /projects/:id/changes/apply             → { paths[], message? } → checkpoint
DELETE /projects/:id/changes?path=|all         → discard staged
GET    /projects/:id/checkpoints               → list
POST   /projects/:id/checkpoints/:cid/restore  → undo
GET    /projects/:id/archive                   → workspace .zip (attachment)
```

### D. Backend — agent staging convention

- Update `COWORK_INSTRUCTIONS` (`seed-cowork-agent.js`) to distinguish the two cases clearly:
  - **Creating a new file** → unchanged: write it into the workspace as today (it appears in the panel
    for download). No staging.
  - **Editing an existing workspace file** → do **not** overwrite it; write the full new version to
    `.cowork/proposed/<same relative path>` so the user can review & Apply.
  Re-seed (`npm run seed-cowork-agent`) + restart.
- Optionally inject a one-line reminder of this convention via the existing cowork code-tool context
  (`buildCoworkCodeContext` in `handleTools.js`) so it's reinforced per-run. No exec-bridge logic change.

### E. Shared — `packages/data-provider`

- `api-endpoints.ts`: add the 7 endpoints above.
- `data-service.ts`: add typed functions + `TCoworkChange`, `TCoworkCheckpoint`, `TCoworkDiff` types.
- `keys.ts`: add `coworkChanges`, `coworkCheckpoints` query keys.

### F. Frontend — `client/src`

- `data-provider/Cowork/queries.ts`: `useCoworkChangesQuery`, `useCoworkCheckpointsQuery`.
- `data-provider/Cowork/mutations.ts`: `useApplyCoworkChanges`, `useDiscardCoworkChange`,
  `useRestoreCheckpoint` (optimistic + invalidate `coworkChanges`/`coworkWorkspace`).
- **Pending-changes UI** — a "Changes" affordance in `CoworkWorkspacePanel` (badge with count): per-file
  card with a themed diff (line diff for text via the `diff` lib; "modified · size→size · Preview" for
  Office/PDF reusing `CoworkFilePreview`) and **Apply / Apply all / Discard**.
- **Checkpoints UI** — a small history list with timestamp + message + **Restore** (with a confirm).
- **Download** — add "Download workspace (.zip)" to `CoworkWorkspaceHeader` (single-file download exists).
- Auto-refresh changes after each agent run (the run-complete handler already invalidates
  `coworkWorkspace`; add `coworkChanges`).

## 7. Dependencies to add

- **`archiver`** (api) — server-side streaming `.zip` (Node has no built-in zip-archive writer).
- **`diff`** — currently only transitive. Either promote to a **direct** dep where used, or hand-roll a
  minimal LCS line-diff to avoid the dependency. _(Decision — §11.)_ Diff is rendered with a small
  themed component; no heavy `react-diff-viewer` needed.

## 8. Diff handling

- **Text** (`.md/.txt/.csv/.json/.html`/code): line-level unified diff, added/removed highlighted.
- **Binary / Office** (`.docx/.xlsx/.pptx/.pdf`/images): no line diff — show
  "modified · `12 KB → 14 KB`" + Preview + Apply/Discard. Undo still works (snapshot restore).
- Diff size guard: above a threshold (e.g. 1 MB text), show "large change — preview only".

## 9. Checkpoint / undo semantics

- One checkpoint **per Apply action** (may cover multiple files).
- Restore is itself snapshotted first, so **undo is reversible** (redo == restore the auto-snapshot).
- Retention: keep last **20** checkpoints; prune oldest `history/` dirs beyond that.
- Checkpoints are per-project, stored on disk (`checkpoints.json`) — no Mongo change needed unless we
  later want them queryable across the app.

## 10. Isolation & safety guarantees

- Every route is owner-scoped via `getUserCoworkProject`; every path goes through
  `CoworkWorkspaceService.resolve()` (containment — no escape).
- `.cowork/` is hidden from tree/download/zip; never an input the agent reads as data.
- Nothing here registers global tools or alters `librechat.yaml` endpoints — `coworkProjectId` gating
  unchanged.

## 11. Decisions (resolved)

1. **Quota / per-file values** — `COWORK_WORKSPACE_QUOTA_MB=2000`, `COWORK_UPLOAD_LIMIT_MB=500` (per-file
   set high so it never blocks a normal user, incl. large mp3/mp4). Cowork-only env vars.
2. **Quota excludes history** — the user-facing quota counts only their real files; `.cowork/` snapshots
   are internal overhead and are capped by **count (last 20 checkpoints)**, not by the quota.
3. **`diff` dependency** — **add `diff` as a direct dependency** (already transitive; diffing is fiddly to
   hand-roll correctly).
4. **Apply gate** — keep the explicit **Apply** button (confirmed).
5. **New-file creation** — unchanged; staging applies to edits of existing files only (see §2).

## 12. Build / rebuild matrix (per `COWORK-NEXT-STEPS.md`)

| Change area | packages build | backend restart | client build | re-seed agent |
|---|:--:|:--:|:--:|:--:|
| `packages/api` (service) | ✅ | ✅ | — | — |
| `packages/data-provider` (endpoints/types) | ✅ | ✅ | ✅ | — |
| `api/` (routes, `.env`) | — | ✅ | — | — |
| `seed-cowork-agent.js` (prompt) | — | ✅ | — | ✅ |
| `client/` (UI, mutations) | — | — | ✅ | — |

## 13. Testing

- **Unit** (`CoworkWorkspaceService.spec.ts`): stage→diff→apply→checkpoint→restore round-trip; retention
  pruning; `.cowork` hidden from tree/zip; quota excludes `.cowork`; path-escape rejection.
- **Manual**: agent edits a `.md` and a `.docx`; review diff; Apply; verify live file; Restore; re-download
  zip; large folder upload (chunked) with progress.

## 14. Sequencing (suggested PR order)

1. **A1 + A2** — limits + chunked upload (small, independently shippable).
2. **B** — service methods + unit tests.
3. **C + E** — routes + data-provider wiring.
4. **F** — pending-changes diff UI + Apply/Discard.
5. **Checkpoints UI + zip download.**
6. **D** — prompt convention + re-seed; end-to-end manual test.
