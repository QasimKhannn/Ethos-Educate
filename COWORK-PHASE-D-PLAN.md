# Cowork — Phase D: Bring-your-own MCP connector (remote-only)

_Last, on purpose: it has the biggest unknown (dynamic per-user MCP registration) and the largest security
surface. Start with a spike; don't commit an approach until it's proven._

**Decision locked:** **remote URL / SSE-HTTP servers only.** No stdio/`npx`/command servers from tenants
(that would let a tenant run code on your backend). Remote-only covers hosted MCP servers — including GitHub's
official remote server, which is the same pattern Claude uses.

**Isolation guarantee:** a user's custom server + creds are scoped to that user; tools injected only into that
user's Cowork runs; no global config change.

---

## D0 — Spike (do first)

Confirm the cleanest way to register a **user-defined remote MCP server at runtime**. LibreChat loads MCP
servers from `librechat.yaml` at boot; user-supplied servers must be registered per-user dynamically. Likely
path: extend the per-user MCP initialization that already powers the API-key connectors so it also reads
`CoworkCustomConnector` rows for the current user. Output of the spike: a proven registration hook + how the
tool grant flows into `initialize.js`.

## D1 — Build (after spike)

1. **Schema:** `CoworkCustomConnector` (user-scoped): `{ user, label, description, transport:'sse'|'http',
   url, auth:'none'|'apikey', credentialFields[], createdAt }`. Creds ride the encrypted per-user var store.
2. **Registration:** dynamic per-user remote MCP server init (from the spike). Merge into the connected-connector
   tool injection in `initialize.js`; grant the whole server via `mcp_all`.
3. **Security (mandatory):**
   - **Egress allowlist / SSRF guard** on user-supplied URLs (block internal/metadata addresses).
   - Any write tools from a custom server flow through the **Phase B interceptor**.
   - Optional admin gate for who may add custom servers.
4. **UI:** "Add custom connector" in `CoworkConnectorsPanel.tsx` — label, description, server URL, transport
   (SSE/HTTP), optional auth header/token. Connect/disconnect/status like existing connectors.

**Files:** `coworkConnectors.ts` (merge logic), per-user MCP init, `initialize.js`, new model/routes,
`CoworkConnectorsPanel.tsx`.
**Build:** packages + backend + client. **Effort:** large (spike + build + security).
**Test:** register a known hosted MCP server → its tools appear only for that user in Cowork → an SSRF/internal
URL is rejected → a write tool is gated by the interceptor.

---

### Phase D exit criteria
A teacher can add a remote MCP server, use its tools inside their own Cowork projects only, with SSRF protection
and the write gate enforced — and nothing leaks to other tenants or the main app.
