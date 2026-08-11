# UI/UX Audit

Date: 2026-08-07
Branch: main
Repo: https://github.com/AJAIA-Dev/Ethos-Educate-
Status: Audit only. No product UI fixes were made in this pass.

## Scope

Audit the existing Ethos Educate UI/UX without redesigning the product direction. The goal is to preserve the current visual language while identifying bugs, brittle component behavior, accessibility gaps, and performance issues that make the app feel slow or unreliable.

## Current Runtime

- Frontend: http://127.0.0.1:3090
- Backend: http://localhost:3080
- Local status at audit start: frontend and backend both responding

## Design Principle

Keep the existing Ethos visual system: dark navy product shell, gold/blue accent language, dotted/grid backgrounds, compact left rail, current card styling, and existing modal tone. The fixes should improve behavior, state, accessibility, performance, and responsiveness without changing the product identity.

## Executive Summary

The app runs locally and the core routes render, but it feels slow and buggy because too many heavyweight surfaces are mounted or fetched globally, several overlays keep hidden UI in the DOM, and some features duplicate similar component behavior instead of sharing one reliable pattern.

Highest impact issues:

- P0: Global authenticated loading fetches agents, assistants, files, startup config, search config, health, terms, and conversations across routes where they are not always needed.
- P0: Route-level code splitting is missing for large surfaces like Toolkit, Admin, Cowork, Project, Search, and Chat.
- P1: Agent detail modal state is split between URL state and local state, so closing a modal can leave stale `agent_id` in the URL.
- P1: Agent card/detail implementations differ between desktop and mobile, which can cause behavior drift.
- P1: Hidden sidebar/nav/menu/dialog content remains mounted and appears in the accessibility tree or DOM audits, increasing render work and focus risk.
- P1: Password/secret visibility is not standardized outside login/register/reset flows.
- P1: Tours and animated backgrounds run automatically and can add layout work or interrupt real workflows.
- P2: Many user-facing strings are hard-coded instead of localized.
- P2: Several dialogs, popovers, menus, and tabs need stronger ARIA and focus semantics.

## Runtime Evidence

Local checks were run against the running app:

| Route | Viewport | Observed Load/Probe Time | DOM Nodes | Notes |
|---|---:|---:|---:|---|
| `/c/new` | Desktop | ~6.1s | 502 | Hidden full sidebar content mounted while compact rail is visible. |
| `/agents` | Desktop | ~15.7s | 521 | Route rendered, but DOM evaluation timed out during one probe. |
| `/search` | Desktop | ~6.1s | 335 | Hidden nav/sidebar still present in body text. |
| `/cowork` | Desktop | ~7.1s | 253 | Cowork tour opens immediately. |
| `/admin` | Desktop | ~13.5s | 400 | Route rendered, but lacks a `main` landmark in the checked root. |
| `/c/new` | Mobile 390x844 | ~12.2s | 450 | Visually usable, hidden sidebar controls remain in DOM. |
| `/agents` | Mobile 390x844 | ~14.2s | 460 | Visually usable, route probe was slow. |
| `/cowork` | Mobile 390x844 | ~10.1s | 253 | Tour opens immediately on entry. |

Top built asset sizes found in `client/dist/assets`:

| Asset | Size |
|---|---:|
| `vendor.B6pKj7ft.js` | 3485.8 KB |
| `heic-converter.Cz_Prg7D.js` | 2134.9 KB |
| `locales.CCpE15gp.js` | 2126.3 KB |
| `index.DJXEIFDI.js` | 1930.7 KB |
| `mermaid.DwhL0Be3.js` | 1431.3 KB |
| `index.Cl8Ibbkn.css` | 510.6 KB |

Browser console did not show app crashes during the audit. The visible console warnings were React Router future flag warnings, so the current slowdown appears more related to render/query/bundle pressure than a fatal runtime error.

## Severity Key

- P0: Major performance or workflow reliability problem.
- P1: Visible bug, state bug, accessibility problem, or repeated source of UX breakage.
- P2: Cleanup or consistency issue that still affects polish, maintainability, or future bugs.
- P3: Nice-to-have hardening.

## Component Inventory

`client/src/components` currently contains 721 component files. High-density areas:

| Area | Component Files | Audit Risk |
|---|---:|---|
| `Chat` | 177 | High render pressure, composer/tool/menu complexity. |
| `SidePanel` | 153 | Many always-mounted panels and duplicate queries. |
| `Nav` | 83 | Hidden sidebar DOM, conversation query behavior. |
| `Prompts` | 38 | Needs follow-up interaction audit. |
| `Agents` | 27 | Toolkit/detail/card drift, animation cost, modal state bugs. |
| `Endpoints` | 24 | Config/query duplication risk. |
| `Files` | 24 | Hook-rule disables, upload/delete gaps, localization gaps. |
| `Input` | 24 | Needs consistent password/secret and accessibility patterns. |
| `Cowork` | 20 | Tour, tabs, native confirms, panel behavior. |
| `Auth` | 19 | Login/register improved; reset password still inconsistent. |

This audit covers the full component tree at the directory/pattern level and records detailed findings for the highest-risk, highest-traffic surfaces. A later fix pass should work from this document route by route.

## Cross-Cutting Findings

### P0 - Global Authenticated Data Loading

Evidence:

- `client/src/routes/Root.tsx` runs global health, assistants map, agents map, file map, startup config, terms, and search config queries for authenticated users.
- `client/src/hooks/Agents/useAgentsMap.ts` fetches all/list agents globally.
- `client/src/hooks/Assistants/useAssistantsMap.ts` fetches assistants globally.
- `client/src/hooks/Files/useFileMap.ts` fetches files globally.
- `client/src/components/Nav/Nav.tsx` fetches conversations whenever authenticated and also has a manual `refetch()` effect.

Impact:

- Chat, Admin, Toolkit, Cowork, Search, and Project routes all pay for data they may not need yet.
- The app feels slow even when the visible route is simple.
- Query duplication increases backend pressure and loading-state churn.

Fix direction:

- Route-scope expensive data: agents only on Toolkit/agent surfaces, files only on file panels/upload flows, assistants only where selected.
- Use shared query selectors and React Query cache instead of duplicate direct queries.
- Add meaningful `enabled` flags and stale times.
- Remove manual refetch effects where React Query invalidation already handles freshness.

### P0 - Route-Level Code Splitting Gap

Evidence:

- `client/src/routes/index.tsx` statically imports large routes and providers including Marketplace, ChatRoute, Search, ProjectRoute, AdminConsole, and CoworkLayout.
- Heavy feature code becomes part of the initial app graph.

Impact:

- Larger initial JS parse/execute cost.
- Slow route transitions and initial auth-to-app load.

Fix direction:

- Convert heavyweight routes to lazy imports with route-level suspense.
- Prioritize `/agents`, `/admin`, `/cowork`, `/projects/:projectId`, `/search`, and heavy chat subfeatures.

### P0 - Bundle Weight

Evidence:

- `vendor` is ~3.5 MB.
- HEIC converter chunk is ~2.1 MB.
- locales chunk is ~2.1 MB.
- main index chunk is ~1.9 MB.
- Mermaid chunk is ~1.4 MB.
- `client/src/locales/i18n.ts` imports all locale JSON files eagerly.
- `client/src/utils/heicConverter.ts` imports HEIC conversion statically.
- `client/src/components/Artifacts/Mermaid.tsx` imports `mermaid` statically.

Impact:

- Large parse and download costs.
- Features unrelated to the current screen still affect perceived speed.

Fix direction:

- Lazy-load locales by selected language.
- Lazy-load HEIC conversion only for HEIC files.
- Lazy-load Mermaid/code rendering only when a message/artifact actually contains Mermaid/code.
- Use bundle analyzer before and after changes.

### P1 - Hidden Mounted UI

Evidence:

- `/c/new` body text includes full hidden sidebar content even when the compact rail is the visible nav.
- `client/src/components/Nav/Nav.tsx` intentionally always renders sidebar content.
- Hidden account/Canva menus appear in DOM audits with role/menu but zero-size rects.
- Side panel masks and overlay containers stay mounted even when inactive.

Impact:

- More DOM work, more query hooks, more components to reconcile.
- Focus order and screen-reader exposure can drift if `inert`, `aria-hidden`, or menu state fails.
- Automated tests and accessibility checks see UI that users cannot visually see.

Fix direction:

- Keep the compact rail mounted, but lazy-mount full sidebar contents only when expanded or after idle.
- Ensure hidden menus are unmounted or truly inert.
- Gate side panel query hooks by open/active state.

### P1 - Overlay And Tour Behavior

Evidence:

- `FirstLoginTour` observes body mutations, scroll/resize, can smooth-scroll targets, and can auto-advance.
- `CoworkTour` opens immediately on `/cowork` if not dismissed.
- Mobile `/cowork` loaded directly into the tour.

Impact:

- Tours can interrupt testing and real workflows.
- Mutation observers and scroll tracking increase layout work.
- Auto-navigation/auto-advance can make the app feel unpredictable.

Fix direction:

- Prefer manual replay or explicit "Start tour" prompts after first load.
- Avoid auto-navigation during tours unless the user confirms.
- Keep observers scoped to the active route and active tour target.

### P1 - Password And Secret Inputs Are Inconsistent

Working:

- Login and register now use `PasswordInput`.
- Login no longer shows the 8-character password policy hint.

Remaining gaps:

- `client/src/components/Auth/ResetPassword.tsx` still uses raw password fields.
- `client/src/components/SidePanel/Builder/ActionsAuth.tsx` has API key/client secret fields without a shared visibility pattern and includes invalid `type="new-password"`.
- `client/src/components/Admin/SsoSettings.tsx` uses raw secret/password input.
- `client/src/components/SidePanel/Agents/Search/InputSection.tsx` appears to render password config as text with a visibility toggle that may not control the actual input type.

Impact:

- Users get different behavior for the same kind of sensitive field.
- Secret fields can be accidentally visible or impossible to inspect.
- Accessibility labels vary by surface.

Fix direction:

- Promote `PasswordInput` into a shared `SecretInput` or extend it safely.
- Use it for login, register, reset password, SSO secrets, action auth secrets, and agent config password fields.
- Standardize `aria-label`, `aria-pressed`, autocomplete, and reveal/hide behavior.

### P2 - Localization Gaps

Evidence:

- `client/src/components/Admin/AdminConsole.tsx` has many hard-coded tab labels, headings, form labels, stats, and table copy.
- `client/src/components/Admin/SsoSettings.tsx` has many hard-coded labels, helper text, validation messages, and button labels.
- `client/src/components/Chat/Input/ToolsDropdown.tsx` has hard-coded aria labels and tool labels in several places.
- `client/src/components/Files/FileList/UploadFileModal.tsx` has hard-coded upload guidance.
- `client/src/components/Cowork/*` includes hard-coded aria labels and confirm text.

Impact:

- Violates frontend localization rule.
- Makes copy updates and future translations brittle.

Fix direction:

- Move user-facing text to `client/src/locales/en/translation.json`.
- Prefer semantic keys such as `com_ui_`, `com_agents_`, `com_admin_`, `com_cowork_`.

### P2 - Accessibility Semantics Need Standardization

Evidence:

- Agent detail dialog has `role="dialog"` but audit did not find `aria-modal` or a clear label.
- Admin tab buttons do not expose full tab semantics.
- Project tabs expose `role="tablist"` and `aria-selected`, but should verify `role="tab"` and `tabpanel` pairing.
- Repeated pin buttons use generic labels like `Pin` and `Unpin`.
- Hidden menus and sidebars appear in DOM/focus scans.

Impact:

- Keyboard and screen-reader users can land in confusing UI.
- Regression tests may pass visually but fail accessibility behavior.

Fix direction:

- Standardize modal/dialog component APIs around title/description/aria-modal.
- Use `role="tablist"`, `role="tab"`, `aria-selected`, and `role="tabpanel"` consistently.
- Give icon-only actions contextual labels such as `Pin File Search` or `Unpin Artifacts`.

## Route And Surface Audit

## Auth

What works:

- Login and register have the new password visibility toggle.
- Login no longer exposes signup/password creation policy hints.
- Login error copy is general and does not reveal credential-specific details.

Findings:

- P1: Reset password still uses raw password inputs and needs the same eye toggle.
- P1: Secret/password behavior is not shared across auth, admin, builder, and agent config.
- P2: Keep login validation separate from registration/reset validation. Login should validate presence and format lightly, not password policy.

Evidence:

- `client/src/components/Auth/PasswordInput.tsx`
- `client/src/components/Auth/LoginForm.tsx`
- `client/src/components/Auth/Registration.tsx`
- `client/src/components/Auth/ResetPassword.tsx`

## Chat

What works:

- Desktop and mobile chat screens render without horizontal overflow in the sampled viewports.
- Composer, model selector, tools button, attachments, prompt/search, and right-side control handle are visible.

Findings:

- P0: Chat route pays for global nav/conversation/file/agent/assistant work even on a blank chat.
- P1: Hidden full sidebar controls remain mounted offscreen on mobile and desktop.
- P1: Tools dropdown has repeated generic pin labels and hidden menus remain mounted.
- P1: Hidden autosize/shadow textareas should be verified as `aria-hidden`/inert.
- P2: Some icon-only controls need more contextual labels.

Evidence:

- `client/src/components/Nav/Nav.tsx`
- `client/src/components/Chat/Input/ToolsDropdown.tsx`
- `client/src/components/Chat/Input/ArtifactsSubMenu.tsx`
- `client/src/components/Chat/ChatBackgroundLights.tsx`

Fix direction:

- Gate full chat history/sidebar rendering and conversation fetching.
- Add contextual aria labels for repeated icon buttons.
- Confirm autosize/internal textareas are not exposed to assistive tech.
- Make animated background opt-in or idle-mounted where possible.

## Toolkit And Agents

What works:

- The Toolkit page visually matches the existing Ethos design on desktop and mobile.
- Agent short/long description support is now conceptually correct: short copy for Toolkit cards, long copy for the agent landing/detail experience.
- Old detail-card steps are removed from the visible detail modal.
- Search, category filtering, sort controls, and detail modal generally render.

Findings:

- P0: `/agents` is one of the slowest audited routes.
- P1: Closing an agent detail modal can leave stale `agent_id` in the URL.
- P1: Searching or changing category preserves stale `agent_id`, for example `/agents/all?agent_id=...&q=hr`.
- P1: Desktop and mobile use different detail implementations, increasing drift risk.
- P1: Detail dialog needs stronger accessible labeling.
- P1: Marketplace renders two `AgentGrid` instances during animated transitions.
- P1: Agent grid uses GSAP hover animation and scroll listeners on a route that is already slow.
- P2: Mobile cards work, but long category labels can crowd the card layout.

Evidence:

- `client/src/components/Agents/Marketplace.tsx`
- `client/src/components/Agents/AgentGrid.tsx`
- `client/src/components/Agents/AgentCard.tsx`
- `client/src/components/Agents/AgentDetail.tsx`
- `client/src/components/Agents/AgentDetailContent.tsx`
- `client/src/components/Agents/VirtualizedAgentGrid.tsx`

Fix direction:

- Make one shared agent detail modal path for desktop and mobile.
- Clear `agent_id` on close and when search/category changes unless intentionally deep-linking.
- Use the existing virtualized grid or a simpler paginated render for large lists.
- Avoid rendering both current and next grids at full cost during transitions.
- Keep the current visual styling, but reduce animation/layout work.

## Side Panel And Control Panel

What works:

- The right-side control panel is discoverable and opens on mobile.
- Panel categories are grouped around app settings, agent builder, prompts, memories, files, bookmarks, and MCP settings.

Findings:

- P1: Side panel queries run even when the panel is not actively used.
- P1: Full-screen masks/overlay containers stay mounted while inactive.
- P1: Mobile control panel needs modal labeling/focus verification.
- P2: Startup config/endpoints are queried in multiple places instead of shared through a cached selector.

Evidence:

- `client/src/components/SidePanel/SidePanelGroup.tsx`
- `client/src/components/SidePanel/SidePanel.tsx`

Fix direction:

- Gate panel-specific queries by open state and selected panel.
- Unmount inactive overlay layers where possible.
- Standardize panel dialog labels and focus restoration.

## Cowork

What works:

- Cowork route renders and uses a `main` landmark.
- Project list, activity, and skill configuration surfaces are visible.

Findings:

- P1: Cowork tour opens immediately and can interrupt workflow.
- P1: Native `window.confirm` is used for destructive/meaningful actions.
- P1: Project view tabs need full tab semantics.
- P2: Several Cowork labels and aria labels are hard-coded.
- P2: Verify rendered copy encoding in Cowork comments/help text where punctuation appears unusual in terminal output.

Evidence:

- `client/src/components/Cowork/CoworkLayout.tsx`
- `client/src/components/Cowork/CoworkTour.tsx`
- `client/src/components/Cowork/CoworkSkillsPanel.tsx`
- `client/src/components/Cowork/CoworkProjectView.tsx`
- `client/src/components/Cowork/CoworkPreviewPanel.tsx`
- `client/src/components/Cowork/CoworkNavLink.tsx`

Fix direction:

- Replace native confirms with the app's dialog pattern.
- Make tours explicit or replayable instead of automatic.
- Add tab/tabpanel semantics.
- Localize Cowork text.

## Admin

What works:

- Admin route renders locally and shows the current operations surface.
- Invite settings, SSO settings, stats, and history are accessible from the page.

Findings:

- P1: Admin route is slow and probe-heavy.
- P1: Page root lacks a clear `main` landmark in the audited DOM.
- P1: Tabs are styled buttons, but should expose tab semantics.
- P1: SSO secret field lacks a reveal/hide control.
- P2: AdminConsole is a large component and should be split by tab/surface.
- P2: Many hard-coded strings violate localization rules.
- P2: `catch (error: any)` violates the repo's no-`any` guidance.

Evidence:

- `client/src/components/Admin/AdminConsole.tsx`
- `client/src/components/Admin/SsoSettings.tsx`

Fix direction:

- Split Admin into smaller tab components.
- Add `main`, tab, and panel semantics.
- Use shared secret input.
- Localize text.
- Replace `any` with explicit error handling helpers.

## Projects

What works:

- Project route generally follows the app shell and uses localized copy more consistently than Admin.
- It has tab-like UI for project subviews.

Findings:

- P1: Project conversations can be queried in both route-level and panel-level components.
- P2: Verify complete tab semantics, including `role="tab"` and `role="tabpanel"`.
- P2: Watch for route-level query duplication with global conversation fetching.

Evidence:

- `client/src/routes/ProjectRoute.tsx`
- `client/src/components/Projects/ProjectChatsPanel.tsx`
- `client/src/components/Projects/ProjectsLibraryDialog.tsx`

Fix direction:

- Consolidate project conversation fetching.
- Keep the existing layout, but standardize tab semantics.

## Files And SharePoint

What works:

- File panel and file list components are present with table/pagination structure.
- SharePoint picker/download hooks exist for integrated file workflows.

Findings:

- P1: Files are fetched globally and again inside file panels.
- P1: Column files disable `react-hooks/rules-of-hooks`.
- P1: Delete flows have stubbed or incomplete behavior in side panels.
- P2: Upload modal copy is hard-coded.
- P2: SharePoint hooks contain console logging and hard-coded toast/error strings.

Evidence:

- `client/src/components/SidePanel/Files/Panel.tsx`
- `client/src/components/SidePanel/Files/PanelTable.tsx`
- `client/src/components/SidePanel/Files/PanelColumns.tsx`
- `client/src/components/Files/FileList/FileTableColumns.tsx`
- `client/src/components/Files/FileList/UploadFileModal.tsx`
- `client/src/components/Files/FileList/FileSidePanel.tsx`
- `client/src/components/Files/FileList/VectorStoreSidePanel.tsx`
- `client/src/hooks/Files/useSharePointPicker.ts`
- `client/src/hooks/Files/useSharePointDownload.ts`

Fix direction:

- Remove hook-rule disables by moving localization into component scope or factory hooks.
- Scope file queries to file surfaces.
- Complete delete UX with confirmation, loading, success, and error states.
- Remove logs and localize toasts.

## MCP And Agent Builder

What works:

- MCP server management, tool status, OAuth/action auth, and builder surfaces are present.
- Agent builder has versioning and configuration paths.

Findings:

- P1: Secret inputs are inconsistent and should use shared reveal/hide behavior.
- P1: `MCPServerStatusIcon` uses module-level localization state, which is brittle.
- P1: MCP server manager invalidates/refetches several queries repeatedly after operations.
- P1: Agent version actions use native `window.confirm`.
- P2: Dialog stack/focus should be tested with nested MCP auth and tool settings flows.

Evidence:

- `client/src/components/SidePanel/Builder/ActionsAuth.tsx`
- `client/src/components/MCP/MCPServerStatusIcon.tsx`
- `client/src/hooks/MCP/useMCPServerManager.ts`
- `client/src/components/SidePanel/Agents/Version/VersionItem.tsx`

Fix direction:

- Use shared secret input.
- Replace module-level localization with local hook usage.
- Batch query invalidation where possible.
- Replace native confirm with app modal.

## Messages And Artifacts

What works:

- Markdown, code blocks, and Mermaid artifact support are wired into chat rendering.
- Reduced-motion handling exists in the animated background.

Findings:

- P0: Mermaid, code rendering, and artifact-related code should be lazy-loaded by actual message content.
- P1: Animated background uses GSAP and pointer tracking; it should be checked for CPU cost on slower devices.
- P2: Markdown rendering should be tested with long code blocks, tables, Mermaid, malformed markdown, and streaming updates.

Evidence:

- `client/src/components/Chat/Messages/Content/MarkdownComponents.tsx`
- `client/src/components/Artifacts/Mermaid.tsx`
- `client/src/components/Chat/ChatBackgroundLights.tsx`

Fix direction:

- Lazy-load heavyweight renderers.
- Memoize stable markdown component maps.
- Respect reduced motion and consider disabling background animation during heavy interactions.

## Immediate Fix Order

1. Clear `agent_id` modal state correctly and consolidate agent detail behavior.
2. Standardize password/secret input reveal/hide across auth, admin, builder, MCP, and agent config.
3. Lazy-load heavy routes from `client/src/routes/index.tsx`.
4. Scope global authenticated queries and sidebar/panel queries to visible surfaces.
5. Reduce `/agents` render work: avoid double grid rendering, use virtualization/pagination, and trim animation cost.
6. Replace native confirms with app dialogs in Cowork and Agent Builder.
7. Add modal, menu, and tab accessibility semantics.
8. Localize hard-coded strings in Admin, Cowork, Files, and Chat tool controls.
9. Lazy-load locales, HEIC conversion, Mermaid, and heavy message renderers.
10. Add route-level Playwright smoke tests for `/login`, `/register`, `/c/new`, `/agents`, `/admin`, `/cowork`, `/projects/:projectId`, and `/search`.

## Suggested Test Matrix

| Area | Desktop | Mobile | Keyboard | Data State |
|---|---|---|---|---|
| Login/Register/Reset | Required | Required | Tab, reveal, submit | Empty, invalid, valid |
| Chat composer/tools | Required | Required | Tool menu, upload, send | No files, files, MCP enabled |
| Toolkit cards/detail | Required | Required | Open/close, escape, focus restore | No agents, many agents, filtered |
| Control panel | Required | Required | Open/close, panel navigation | User/admin permissions |
| Cowork | Required | Required | Tour, tabs, dialogs | No projects, many projects |
| Admin | Required | Mobile sanity | Tabs, forms, dialogs | SSO on/off, invites |
| Files | Required | Required | Table, upload, delete | Empty, many files, errors |
| MCP/Builder | Required | Required | Auth dialogs, secrets | Connected, disconnected, error |

## Notes For The Fix Pass

- Preserve the current visual design unless a visual element directly causes the bug.
- Prefer shared primitives for dialogs, secret inputs, tabs, menus, and icon buttons.
- Keep user-facing copy localized.
- Add performance measurement before and after each major fix so improvement is visible.
- Avoid backend changes unless a frontend issue is caused by an API contract or missing pagination.
