# Cowork — Connectors (MCP) — Implementation Plan

> Plan for review **before** implementation. Strict rule: **nothing outside the Cowork workspace
> changes** — the main Ethos Assistant chat, other agents, and the global tool/plugin menus stay
> exactly as they are. All connector behavior is scoped to the Cowork agent and the Cowork UI.
>
> _Drafted: 2026-06-18 · branch `feature/cowork-mode`_

## 1. Goal

Let the Cowork coworker **act in the tools schools already use** — publish to WordPress, send a
Mailchimp newsletter, read/write Airtable & Monday, search YouTube, and (via login) use Google
Workspace, Microsoft 365, and Canva. This is the wedge vs. chat-only tools.

## 2. The core idea — connectors are to MCP tools what skills are to prompts

You already have a clean per-project pattern: `enabledSkills` on the project + injection at run time.
Connectors reuse it exactly:

- Add **`enabledConnectors: string[]`** to the CoworkProject (mirrors `enabledSkills`).
- A **Connectors tab** in the Cowork pane lets the user connect/authenticate a connector and toggle
  it on for the project.
- At run time, the Cowork run **injects the enabled connectors' MCP tools** into the agent's toolset
  — in the same `coworkProjectId`-gated block in `agents/initialize.js` where we already inject
  skills, memory, and modes. Nothing global is touched.

So the agent gets `execute_code` + `tavily_search` (always) **plus** the project's enabled
connector tools, and only for Cowork runs.

## 3. How the agent accesses a connector (end to end)

1. User opens the **Connectors tab**, connects an account (OAuth) or pastes a credential (API key),
   and toggles the connector **on** for this project.
2. On the next message, the Cowork run resolves `enabledConnectors`, looks up each connector's MCP
   tool ids, and adds them to the agent's tools for that run (LibreChat's `mcpToolPattern` path in
   `handleTools.js` already loads MCP tools listed on an agent).
3. The agent calls the tool like any other; calls show up in the **Trace** panel.
4. **Mode gating:** connectors are **Agent-mode only**. Ask/Plan runs get **no** connector tools, so
   they can't act on the outside world (the read-only file trick doesn't cover external APIs, so we
   exclude connectors entirely in those modes). _(Later option: allow clearly read-only tools — e.g.
   YouTube search — in Ask/Plan.)_
5. **Write actions use draft→approve→act:** for anything that publishes/sends (WP post, newsletter,
   Monday item), the agent first shows a preview card and only performs the action after the user
   confirms — same principle as the email card. (v1: prompt-driven; a hard tool-call confirmation
   gate is a later hardening.)

## 4. The Connectors tab (UI)

A new right-pane tab next to Workspace / Trace / Skills / Memory:

- One row per connector: name, status (Connected / Not connected), and an **enable** toggle for this
  project.
- **OAuth connectors** (Google, Microsoft 365, Canva, Monday): a **Connect** button → the user logs
  in once → token stored per user. "User only needs to log in and it works."
- **API-key connectors** (WordPress, Mailchimp, Airtable, YouTube): a small form for the
  credential(s) — e.g. WordPress = site URL + Application Password; Mailchimp/Airtable/Monday-token =
  one key.
- Credentials are stored **per user** (connect once, reuse across your projects); `enabledConnectors`
  is **per project** (which ones this project may use). Reuses LibreChat's existing per-user MCP
  auth/credential store.

## 5. The connectors — auth type & MCP-server source

| Connector | Auth (per user) | Hustle | MCP server source |
|---|---|---|---|
| **WordPress** | Site URL + Application Password | very low | community/self-host MCP |
| **Mailchimp** | API key | very low | community/self-host MCP |
| **Airtable** | Personal access token | very low | community/self-host MCP |
| **YouTube search** | single platform API key (read-only, can be env — not per user) | very low | small self-host MCP |
| **Monday** | OAuth or API token | low | `mcp.monday.com` (already whitelisted) |
| **Google Workspace** (Docs/Drive/Classroom/Calendar) | OAuth (Workspace-internal = no verification) | medium | your Cloud Run MCP(s) |
| **Microsoft 365** (Teams/Outlook/OneDrive/SharePoint) | OAuth (tenant consent) | medium | your Cloud Run MCPs (already whitelisted) |
| **Canva** | OAuth (Canva-hosted) | low–medium | `mcp.canva.com` (already whitelisted) |

So Monday/Canva/MS365 (and likely Google) already have hosted/whitelisted MCPs; the API-key ones
(WordPress, Mailchimp, Airtable, YouTube) need an MCP server stood up or a community one adopted.

## 5b. What "Cowork-configured MCPs" means (the scoping mechanism)

LibreChat's `mcpServers` are global by nature, so "Cowork-configured" is enforced by **the framework
(Phase A), not by config flags alone**:
- MCP servers are registered with `chatMenu: false` + non-global so they never show in the main chat.
- Their tools are **only ever granted to the Cowork agent**, and only for a run where the project has
  that connector enabled — injected in the `coworkProjectId`-gated block of `agents/initialize.js`
  (same place as skills/memory/modes). The main Ethos Assistant (a `modelSpecs` chat, not an agent)
  never receives MCP tools at all.
- This is exactly why Phase A (per-project `enabledConnectors` + run-time injection) is the thing that
  *makes* an MCP "Cowork-configured" — without it, a global server entry could leak into the agents
  endpoint generally.

## 6. Isolation — how the main app stays untouched

1. MCP servers are defined in config but **not surfaced to the main chat** (`chatMenu: false`,
   non-global), so they never appear in the Ethos Assistant tool/plugin menus.
2. Connector tools are granted **only to the Cowork agent**, dynamically, via per-project
   `enabledConnectors` injection in the cowork-gated block — never added to other agents or the
   `modelSpecs` chat.
3. Credentials are **per user**, via the existing MCP auth store.
4. Connectors are **Agent-mode only** within Cowork.
5. All new UI lives in the **Cowork pane** only.
- _Verification step:_ during implementation, confirm the chosen MCP flags truly keep these servers
  out of the main chat's menus on this LibreChat version.

## 7. Phases

**Phase A — Connector framework (the platform).** `enabledConnectors` on the project; Connectors tab
(connect/auth + per-project toggle); per-user credential/OAuth wiring; run-time tool injection in
`initialize.js`, Agent-mode-gated; trace shows calls. No connector added yet — validated with one
trivial one.

**Phase B — API-key connectors (validate the framework, lowest hustle).** WordPress → Mailchimp →
Airtable → YouTube → Monday. Each: stand up/adopt the MCP server, register it (Cowork-scoped),
add its tool ids to the connector registry, add draft→approve cards for write actions.

**Phase C — OAuth connectors (login-and-go).** Google Workspace, Microsoft 365, Canva. Each: the
OAuth app + MCP server, the Connect flow in the tab, tool wiring. (Google/MS365 lean on
Workspace/tenant internal trust to avoid public verification.)

**Phase D — Hardening.** Hard tool-call confirmation gate for destructive actions; optional read-only
connector access in Ask/Plan; per-connector scope minimization.

## 8. Audit — what already exists vs. what to build (2026-06-18)

Credential scope decision: **per teacher** (each user connects their own account / enters their own
key; nothing shared at the school level).

| Connector | MCP server | OAuth / credentials in place? | Verdict |
|---|---|---|---|
| **MS365** (Teams/Outlook/OneDrive/SharePoint) | Cloud Run MCPs **whitelisted** | **Azure AD app exists** (`MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` set) | **Ready** — just scope into Cowork |
| **Canva** | `mcp.canva.com` **whitelisted** + `/api/mcp/canva/oauth/callback` | **Canva OAuth app exists** (`CANVA_CLIENT_ID/SECRET` set) | **Ready** — just scope into Cowork |
| **Monday** | `mcp.monday.com` **whitelisted** (hosted, does its own OAuth) | hosted OAuth (no app creds needed) | **Ready** — configure server |
| **Google Workspace** (Docs/Drive/Classroom/Calendar) | **none — build** a Workspace MCP | **Google OAuth client exists** (`GOOGLE_CLIENT_ID/SECRET`, currently the login app) — needs Workspace **scopes added + APIs enabled** in the Google Cloud project | OAuth foundation present; **build MCP + extend scopes** |
| **WordPress** | **none — build** | per-teacher **site URL + Application Password** (entered in Connectors tab) | **build MCP** |
| **Mailchimp** | **none — build** | per-teacher **API key** | **build MCP** |
| **Airtable** | **none — build** | per-teacher **PAT** | **build MCP** |
| **YouTube search** | **none — build** (small, read-only) | needs **YouTube Data API key** (the existing `GOOGLE_KEY` is the Gemini key; YouTube API must be enabled). Read-only public search → a **single platform key** fits better than per-teacher | **build MCP**; key decision below |

**Buckets:**
- **Ready (OAuth + MCP exist) — only wire into Cowork:** MS365, Canva, Monday.
- **OAuth exists, build the MCP + add scopes/APIs:** Google Workspace.
- **Build MCP + per-teacher key entry (no OAuth):** WordPress, Mailchimp, Airtable, YouTube.

**Notes / decisions:**
- Only `librechat.yaml` `mcpServers` actually configured today: **Image_Generation** and
  **lesson-planning**. The MS365/Canva/Monday ones are **whitelisted but not configured as servers**
  — so even the "ready" ones still need a Cowork-scoped server entry (`chatMenu:false`, non-global).
- **YouTube** — DECIDED: **platform-wide**. One YouTube Data API key set in env (not per-teacher),
  read-only search. No Connectors-tab credential entry for it; it's just always available in Agent mode.
- **Security hygiene:** live client secrets (Google/Microsoft/Canva/Okta/NetSuite) sit in `.env` —
  make sure `.env` is gitignored and never committed.
- **First Phase-B connector:** TBD (recommend WordPress).

## 9. Build/rebuild matrix
| Change area | packages build | backend restart | client build | re-seed agent |
|---|:--:|:--:|:--:|:--:|
| `packages/data-schemas` (enabledConnectors field) | ✅ | ✅ | — | — |
| `packages/data-provider` (types/endpoints) | ✅ | ✅ | ✅ | — |
| `api/` (routes, initialize.js injection) | — | ✅ | — | — |
| `librechat.yaml` (MCP servers, Cowork-scoped) | — | ✅ | — | — |
| `client/` (Connectors tab) | — | — | ✅ | — |
| connector registry / agent tools | — | ✅ | — | maybe |
