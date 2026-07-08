# Cowork — Phase B2: Multi-Tenant Isolation Audit

_Goal: confirm every Cowork route and agent-side tool re-checks that the target project/resource
belongs to the requesting user (no IDOR / cross-tenant access), and lock the invariant with tests._

## Result: isolation already holds

The audit found **no IDOR gaps**. Every Cowork surface resolves the project/resource through an
owner-scoped query — `ownerFilter(user, projectId) = { _id: projectId, user }` — or through the
`loadWorkspace` helper, which verifies ownership and responds `404` before returning a workspace.

### Route-by-route (api/server/routes/cowork.js)

| Route family | Guard | Evidence |
|---|---|---|
| `GET/POST/GET:id/PATCH:id/DELETE:id /projects` | `getUserCoworkProjects(user)` / `ownerFilter` in every model fn | L172–235 |
| `GET /projects/:id/skills` | `getUserCoworkProject({user, projectId})` → 404 if null | L248–250 |
| `POST /skills`, `DELETE /skills/:id` (custom skills) | user-scoped `createCoworkSkill/deleteCoworkSkill` | L286–316 |
| `changes` (list/diff/apply/delete) | `loadWorkspace(req,res)` (ownership + 404) | L326–408 |
| `checkpoints` (list/restore) | `loadWorkspace` | L411–439 |
| `archive` (zip) | `loadWorkspace` | L442–485 |
| `memory` (get/put/archive) | `loadWorkspace` | L493–534 |
| `conversations` (list/messages/link/unlink) | owner-scoped model fns; messages also require `conversationIds: conversationId` | L537–612 |
| `connectors` (list/save creds/delete creds) | scoped to `req.user.id` | L702–760 |
| `routines` (list/create/get/patch/delete/run/runs) | `getCoworkRoutine({user, routineId})`; create verifies project via `assertOwnsProject` | L772–892 |
| workspace `tree/file/download/upload/delete` | `loadWorkspace` | L929–1046 |

`loadWorkspace` (L909–927): `getUserCoworkProject({ user: req.user.id, projectId })` → `404` and
returns `null` if the project isn't owned by the caller. Every file/workspace route bails on `null`.

### Agent-side (not a route)

The execution bridge resolves the workspace from `req.body.coworkProjectId` **but re-checks ownership**:
`handleTools.js:342` — `getUserCoworkProject({ user, projectId: coworkProjectId })`, and only proceeds
`if (project)`. A forged `coworkProjectId` for another user's project resolves to `null` → no access.
The runtime injection in `initialize.js` (skills/memory/connectors) likewise gates on
`getUserCoworkProject(...)` and only injects `if (project)`.

### Model layer (the invariant)

Ownership is enforced at the source in the model functions:
- `api/models/CoworkProject.js` — every read/write uses `ownerFilter(user, projectId)`;
  `getCoworkConversationMessages` additionally scopes by `conversationIds: conversationId`.
- `api/models/CoworkRoutine.js` — `ownerFilter(user, routineId)`; create verifies project ownership.
- `api/models/CoworkSkill.js` — `{ _id: skillId, user }`; validates ObjectId before querying.

## What B2 adds

1. **This audit** (evidence above).
2. **Regression tests** — `api/models/__tests__/coworkIsolation.spec.js` asserts each ownership
   function builds an owner-scoped filter, so a future edit that drops `user` from a query fails CI.

## Guidance for future changes (keep the invariant)

- New workspace/file routes MUST go through `loadWorkspace(req, res)`.
- New project-scoped model reads/writes MUST use `ownerFilter(user, id)` — never query by `_id` alone.
- Any new agent-side workspace access MUST re-check `getUserCoworkProject({ user, projectId })`.

## Note
No enforced write-gate change here — that is **B1** (separate). B2 is the isolation audit only.
