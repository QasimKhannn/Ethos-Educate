# Cowork — Phase B: Foundational hardening (required before any write path)

_These two items must land before GitHub push, connector writes, or BYO-MCP go live in production. They add no
end-user feature by themselves; they make the write features safe. Entirely inside Cowork._

**Isolation guarantee:** interceptor and checks run only on Cowork agent runs (gated on `coworkProjectId`);
nothing touches the main chat, other agents, or the global tool registry.

---

## B1 — Real write-action interceptor (replaces the soft, prompt-only gate)

**Why:** today the write gate is an *instruction* asking the model to preview a ` ```action ` block and wait
(`initialize.js:388–440` + `CoworkActionCard.tsx`). It is **not enforced** — the model can call a write tool
directly. For a deployed product, external writes (WordPress publish, GitHub push, mail send, connector writes)
must be *physically* blocked until approved.

**Design (build once, used twice):**
- Intercept tool calls **before execution** in the Cowork run path. Classify each call: read → run normally;
  **write** (connector `hasWriteActions`, `git_commit_push`, etc.) → do **not** execute.
- **Interactive chat:** capture the real tool call + args + a human-readable preview → render the approval card
  (reuse `CoworkActionCard.tsx`) → on approve, **release the captured call** and execute; on reject, drop it.
- **Unattended (Routines):** persist the captured call as a `CoworkPendingAction` (already designed in the
  handoff) → teacher approves later → execute then. (`autoApprove` per-routine bypasses, a conscious opt-in.)
- One interceptor serves both paths — this is the same mechanism the Routines approval queue needs.

**Where:** the Cowork tool-execution path (the exec bridge / agent run in
`api/app/clients/tools/util/handleTools.js` + `initialize.js`); persistence via a `CoworkPendingAction`
collection; UI reuses the existing action card.
**Build:** packages + backend + client. **Effort:** medium (the keystone item).
**Test:** attempt a write tool with the gate on → it does **not** execute until approved; approve → it executes
once; reject → no effect; confirm reads are unaffected.

---

## B2 — Multi-tenant isolation audit (close IDOR risk)

**Why:** the handoff flags that not every Cowork workspace route provably re-checks project + user ownership.
In a shared deployment, a missed check lets one teacher touch another's project/files.

**Work:**
- Enumerate **every** Cowork route and tool (project CRUD; workspace tree/file/read/download/upload/delete/
  archive/checkpoints; skills; connectors; routines; the new Phase A/C/D routes) and assert each re-checks that
  the target project belongs to the requesting user.
- Add a shared ownership-guard helper and apply it uniformly; add regression tests that a second user is denied.

**Build:** backend (+ tests). **Effort:** small–medium (mostly audit + tests).
**Test:** for each route, user B is rejected (403/404) on user A's project id.

---

### Phase B exit criteria
No write tool can execute without passing the enforced interceptor; every Cowork route denies cross-tenant
access under test. **Stop for review before enabling Phase C write paths.**
