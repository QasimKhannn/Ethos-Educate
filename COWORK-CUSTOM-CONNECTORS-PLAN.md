# Cowork — Custom Connectors (Bring-Your-Own MCP)

_Let a teacher add their own remote MCP server as a connector, per-user, just like custom skills.
Decisions locked: any user may add; HTTPS remote-only + SSRF guard; auth = none / API-key-header /
OAuth (both auto-registration and explicit OAuth-app client_id+secret)._

## Key finding — most of this already exists

This fork already has full runtime, per-user MCP registration:
- **`MCPServer` DB collection** + CRUD, per-user (`author`) scoped.
- The **registry merges DB servers with yaml per request** (`getServerConfig(serverName, userId)`) —
  no restart needed.
- Per-user credential injection (`processMCPEnv`), **encryption at rest**, **OAuth** (initiate +
  `/api/mcp/:serverName/oauth/callback`), and **SSRF protection** (`useSSRFProtection`,
  `resolveHostnameSSRF`) are all built.

So we **reuse** that engine and add a thin Cowork layer — we do NOT reimplement connections/auth.

## Design

- **Storage:** custom connectors are `MCPServer` records created by the teacher, marked Cowork-only:
  `serverName` prefixed `cowork_<userShort>_<slug>`, `config.chatMenu = false` (never in the main chat),
  `author = user`. A `config` marker (`config.coworkCustom = true`) lets us list/filter them.
- **Isolation:** granted ONLY to the Cowork agent, in Agent mode, for that user (extends the existing
  connector-injection loop). Never touches the main chat, other agents, or other users.
- **SSRF:** validate at add-time (require `https:`, reject IP-literals in private/loopback/link-local
  ranges, `localhost`, `*.local`, cloud-metadata hosts) AND connect with `useSSRFProtection: true` so
  DNS-rebinding is blocked at connect-time too.
- **Auth types:**
  - *None* — open server, just a URL.
  - *API key / header* — teacher pastes a token; stored per-user via the existing credential bridge
    (`customUserVars` → `processMCPEnv`), encrypted.
  - *OAuth* — auto-registration (DCR) when the server supports it (like Monday); or explicit OAuth app
    (client_id/secret/scope) when it doesn't (like GitHub). Reuses the existing MCP OAuth flow.
- **Write safety:** a custom server's tools are unknown, so treat them as **write-capable** → they pass
  through the existing interactive approval gate and are withheld on unattended routine runs (until the
  Phase B enforced interceptor lands).

## Build order (testable layers)

**Layer 1 — backend foundation.** SSRF-validated create/list/delete of Cowork custom connectors (as
`MCPServer` records) + inject the user's connected custom servers into the Cowork agent. Auth: none +
API-key-header. _Test via API + a known hosted MCP server._

**Layer 2 — UI (none + API-key).** "Add custom connector" in the Connectors panel (label, URL, auth
type, optional key), list with connect/disconnect/delete, mirroring the custom-skills UX.

**Layer 3 — OAuth.** Add OAuth to the add form (auto-registration; and explicit app fields
client_id/secret/scope) reusing the existing MCP OAuth initiate/callback.

**Layer 4 — polish + hardening.** Accurate status, error surfaces, per-user quota, and tests
(SSRF rejection, isolation/IDOR, injection).

## Files (anticipated)
- Backend: a small `~/models/CoworkCustomConnector.js` wrapper over the MCPServer methods (create/list/
  delete with the cowork marker + SSRF validation); new routes in `api/server/routes/cowork.js`; grant
  loop in `api/server/services/Endpoints/agents/initialize.js`.
- Data-provider: endpoints + service fns + types.
- Client: Connectors panel add/list/delete UI + mutations.

## Exit criteria
A teacher can add a remote HTTPS MCP server (no-auth, API-key, or OAuth), connect it, use its tools in
their own Cowork Agent-mode chats only, with SSRF blocked and writes gated — and nothing leaks to other
tenants or the main chat.
