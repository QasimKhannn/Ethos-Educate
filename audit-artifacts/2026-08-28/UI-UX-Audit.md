# Ethos Educate UI/UX Audit

**Audit date:** 2026-08-28  
**Mode:** Combined UX and accessibility audit; no product source was changed.

## Executive summary

Ethos Educate already has a strong, recognizable educator-focused UI. The biggest opportunity is not a visual redesign; it is making transitions between the Toolkit, task-specific AI flows, and the main chat more explicit. The five highest-impact improvements are:

1. Confirm the selected agent/tool when a Toolkit card opens chat, and show a clear unavailable/retry state when a specialized workflow cannot initialize.
2. Correct the Toolkit's intermediate-width grid so cards move to two columns before titles and descriptions become hard to scan.
3. Retain a concise visible label or selected-count on the mobile AI-tools control.
4. Give an empty new-chat screen a small set of existing educator workflows (for example, Lesson Plan Builder, Essay Grader, and Toolkit) rather than only a greeting and composer.
5. Localize the lesson-planning wizard and standardize its status, loading, retry, and completion states with the rest of the application.

## Scope and evidence

The local frontend and existing local backend were running successfully. Captures were made in Chrome at desktop, tablet-like (1024 CSS px), and phone-like (520 CSS px; the browser’s minimum viewport prevented a true 390 px capture). Files are in this directory.

Visual flows captured:

| Step | Route / state | Health |
| --- | --- | --- |
| 1 | `/c/new`, desktop main workspace | Needs stronger task entry guidance |
| 2 | `/c/new`, AI tools menu | Functional; more-content cue would help |
| 3 | `/agents`, desktop Toolkit | Healthy hierarchy and search/filter entry |
| 4 | Toolkit Lesson Plan Builder card -> `/c/new` | Needs explicit selected-tool confirmation |
| 5 | `/tools/essay-grader`, rubric step | Strong, clear guided workflow |
| 6 | Essay Grader, add-writing step | Strong hierarchy; upload/paste choice is clear |
| 7 | `/cowork`, empty project workspace | Strong empty state; project retrieval will need scaling support |
| 8 | Settings dialog | Healthy dialog, tabs, labels, and focus-oriented structure |
| 9 | `/agents`, tablet-like width | Card content is over-compressed |
| 10 | `/c/new`, phone-like width | Core task works; AI-tools label disappears |
| 11 | `/agents`, phone-like width | Healthy single-column adaptation |
| 12 | Essay Grader, phone-like width | Healthy reflow and readable form controls |

Not directly exercised: sign-in/onboarding (the available browser already had an authenticated session), real document upload (would require selecting a local file), AI generation/submission, live error/retry, permissions denied, and offline behavior. Those need a non-production test account and controlled fixtures before release sign-off.

## Design language to preserve

- Poppins for UI text and IBM Plex Mono for code-like content.
- Ethos navy (`#13264c`) as the foundational shell and primary action color; warm gold sunburst accents; white/soft-blue surfaces; slate text.
- Rounded `xl`/`2xl` cards, light outlines, restrained shadows, compact Lucide-style icons, and colorful functional tool artwork.
- A calm, spacious content canvas paired with a durable navy navigation system.
- Light and dark themes driven by existing CSS variables and Tailwind token aliases.

The implementation is React 18 + React Router + Vite, Tailwind CSS and global token CSS, with Headless UI, Radix/Ariakit, `@librechat/client`, and Lucide. Primary token and theme definitions live in `client/src/style.css`; Tailwind configuration is in `client/tailwind.config.cjs`; responsive rules span Tailwind variants plus `client/src/mobile.css` and media blocks in `style.css`.

## Findings

### Critical

No critical defect was confirmed in the captured flows.

### High — H1: Toolkit-to-lesson-plan entry does not visibly confirm the specialized workflow

- **Affected journey:** Toolkit -> Lesson Plan Builder -> create lesson content.
- **Evidence:** The Toolkit card clearly promises “Build a full lesson plan from scratch, start to finish” in `04-desktop-ethos-toolkit.png`. Selecting it resulted in the generic `/c/new` canvas in `05-desktop-lesson-plan-entry.png`, still headed by the broad “Ethos-Pro” model control and without a visible Lesson Plan Builder title, form, loading state, or unavailable explanation. `client/src/components/Chat/Input/LessonPlanningLauncher.tsx` intentionally returns `null` unless the selected conversation has the required agent/MCP identity and permission (around lines 549-554 and 1035).
- **Why it matters:** Teachers cannot tell whether the click succeeded, whether the tool is preparing, or whether they must begin an unstructured chat. This adds uncertainty at the highest-value workflow transition.
- **Minimal improvement:** Immediately render a compact pinned agent/tool identity in the chat header or above the composer. If the planner is not ready, show an inline Ethos-styled status card: “Lesson Plan Builder is unavailable for this chat” with a specific remediation action (retry, reconnect, or choose another tool). When it is ready, open the existing embedded wizard or show a “Start lesson plan” button.
- **Style preserved:** Reuse existing navy badges, sunburst/BookOpen icon treatment, rounded cards, and the existing wizard component; do not introduce a new planner visual system.
- **Effort / regression risk:** Medium / Medium (conversation, MCP, and permission state must remain correct).
- **Acceptance criteria:** Selecting the card announces and visibly names “Lesson Plan Builder” within one second. Every outcome is explicit: wizard ready, loading, unavailable, or recoverable error. Keyboard and screen-reader users receive the same state change through an `aria-live` message.

### High — H2: Toolkit cards are too dense at intermediate widths

- **Affected journey:** Browse and choose a tool on a tablet or narrowed desktop window.
- **Evidence:** `10-tablet-ethos-toolkit.png` shows three columns at 1024 CSS px. Multi-word titles and descriptions are heavily wrapped or truncated (for example, Lesson Plan Builder and PowerPoint Presentation Creator). The responsive storefront rules in `client/src/style.css` contain a two-column rule at line 15713, followed by a later auto-fit declaration at line 15755 that can reintroduce three columns.
- **Why it matters:** Users must scan a large library primarily by title and description; cutting those cues makes it slower to distinguish similar tools.
- **Minimal improvement:** Make the two-column rule win through the intermediate range (for example, until the layout has room for three 19rem cards plus gaps), then keep the current three-column desktop layout. Do not reduce the type below the current scale.
- **Style preserved:** The same cards, icons, colors, outlines, and spacing remain; only the grid breakpoint changes.
- **Effort / regression risk:** Small / Low.
- **Acceptance criteria:** At 960, 1024, 1100, 1280, and 1440 CSS px, titles remain readable without accidental three-line compression, descriptions retain at least two meaningful lines, and no horizontal scrolling appears.

### Medium — M1: Mobile removes the visible AI-tools label

- **Affected journey:** Starting an AI-assisted task on a phone.
- **Evidence:** The desktop composer names the control “AI Tools” (`01-desktop-main-workspace.png`); the phone-like capture leaves an unlabeled icon between tool settings and the microphone (`09-mobile-main-workspace.png`). `client/src/components/Chat/Input/MCPSelect.tsx` hides the visible label below `md`.
- **Why it matters:** A first-time user has little visual evidence that integrations/tools exist, particularly when the icon resembles the attachment affordance beside it.
- **Minimal improvement:** Keep the existing compact pill, but show “Tools” or a selected-count when services are available/selected. Retain icon-only mode only when width is genuinely constrained and a distinct selected state is visible.
- **Style preserved:** This extends the existing composer pill; no new color, icon set, or control shape is needed.
- **Effort / regression risk:** Small / Low.
- **Acceptance criteria:** At 520 px and 375 px validation widths, users can distinguish Attach, settings/options, AI tools, voice, and Send without relying on a tooltip. The accessible name remains accurate.

### Medium — M2: The empty new-chat canvas does not direct users to Ethos’s educator workflows

- **Affected journey:** First chat / return to a blank workspace.
- **Evidence:** `01-desktop-main-workspace.png` and `09-mobile-main-workspace.png` show a very large greeting and a composer, but no visible first actions or path to Lesson Plan Builder, Essay Grader, or the Toolkit. The same app already has an accessible `ConversationStarters` pattern in `client/src/components/Chat/Input/ConversationStarters.tsx`.
- **Why it matters:** The product’s differentiated tools are one navigation discovery step away from the most common entry point; a generic empty chat creates unnecessary choice paralysis.
- **Minimal improvement:** Add 2–3 optional, role-aware starter actions below the greeting using the existing starter-card language: “Build a lesson plan,” “Grade an essay,” and “Browse Toolkit.” This needs product approval for defaults/copy, not a visual redesign.
- **Style preserved:** Reuse the existing small starter-card components, navy type, soft surfaces, and current composition.
- **Effort / regression risk:** Medium / Low.
- **Acceptance criteria:** A new user can reach each primary educator workflow in one visible click from `/c/new`; returning users can dismiss or ignore starters; no default prompt is sent automatically.

### Medium — M3: Lesson-planning UI is not localized consistently with the rest of the app

- **Affected journey:** Lesson Plan Builder setup, choices, generation, and completion.
- **Evidence:** `client/src/components/Chat/Input/LessonPlanningLauncher.tsx` disables the i18n literal rule and contains user-facing English strings such as step labels, errors, loading messages, and download instructions. Other captured surfaces use `useLocalize()` and translation keys.
- **Why it matters:** A user who selects a non-English application language receives a mixed-language high-stakes lesson workflow, reducing comprehension and trust.
- **Minimal improvement:** Move the wizard’s user-facing strings to the existing English translation file and use `useLocalize()`; preserve dynamic state/subject/grade labels.
- **Style preserved:** Text changes only; no appearance change.
- **Effort / regression risk:** Medium / Low.
- **Acceptance criteria:** Changing the app language translates all planner controls, status text, errors, buttons, and download guidance; no English literals remain except names/data supplied by the service.

### Medium — M4: Long AI-tools menu has no visible cue that more services are below

- **Affected journey:** Discovering integrations from the composer.
- **Evidence:** `02-desktop-ai-tools-menu.png` visibly shows only the first portion of the menu. The inner list is deliberately scrollable (320 px viewport, 668 px content) in `client/src/components/Chat/Input/MCPSelect.tsx`, so services such as Document Workflow and Web Search sit below the initial view.
- **Why it matters:** Users may believe the first six services are the entire catalog, especially because the scroll bar is not visually obvious in the capture.
- **Minimal improvement:** Add a subtle bottom fade/continuation affordance only when overflow exists, or place connected services first and group “Needs auth” beneath an explicit section label.
- **Style preserved:** Keep the same Ariakit menu, service icons, list row style, and compact rounded panel.
- **Effort / regression risk:** Small / Low.
- **Acceptance criteria:** When a menu has overflow, a user can visually tell that more options follow; mouse, keyboard, and touch scrolling reach every service; focused options auto-scroll into view.

### Low — L1: Cowork project retrieval will become difficult as project count grows

- **Affected journey:** Return to an existing Cowork project.
- **Evidence:** `12-desktop-cowork.png` shows a clear empty state and CTA, but the left project list is a flat, unfiltered list with similar/duplicate names. `client/src/components/Cowork/CoworkHome.tsx` provides a good empty state; retrieval controls are not apparent in the sidebar capture.
- **Why it matters:** The list works for a few projects but will not scale to active staff members who maintain many courses/workspaces.
- **Minimal improvement:** Add a lightweight “recent projects” treatment and a search/filter trigger once the list exceeds a defined threshold. This is a workflow/product decision, not an immediate visual patch.
- **Style preserved:** Extend the existing sidebar controls and project-row treatment.
- **Effort / regression risk:** Medium / Medium.
- **Acceptance criteria:** With 20+ projects, a user can open a known project in under ten seconds via search or recency; keyboard navigation and focus stay within the sidebar correctly.

## Confirmed strengths

- The Essay Grader is the most polished end-to-end captured flow. Its three-step structure, rubric selection, optional assignment context, paste/upload choice, batch option, primary/secondary actions, and phone reflow are clear (`06-desktop-essay-grader.png`, `07-desktop-essay-input.png`, `08-mobile-essay-input.png`).
- The Toolkit establishes a strong product identity while maintaining high scanability at desktop and phone widths (`04-desktop-ethos-toolkit.png`, `11-mobile-ethos-toolkit.png`).
- Cowork’s empty state explains the value of projects and provides a single clear next step (`12-desktop-cowork.png`).
- Settings is a semantically structured dialog with tab navigation, labeled controls, a close control, and a readable visual hierarchy (`17-desktop-settings-general.png`, `client/src/components/Nav/Settings.tsx`).
- The inspected DOM and source show many strong accessibility foundations: native buttons, labeled icon controls, menu roles, dialog/tabs, visible focus styles in many components, live regions for marketplace loading/results, and reduced-motion handling.

## Prioritized roadmap

### Quick UX fixes (small, reversible)

1. Fix the Toolkit intermediate-width grid cascade and test 960–1440 px.
2. Restore a concise mobile label/count for AI tools.
3. Add an overflow cue to long AI-tools lists.
4. Add visible selected-agent identity to the chat entry shell.

### Consistency and accessibility improvements

1. Localize LessonPlanningLauncher via the existing English translation source and `useLocalize()`.
2. Standardize planner state feedback: initial loading, dependent-choice loading, long generation, recoverable error, retry, and completion should each have a visible and announced state.
3. Run keyboard-only and screen-reader checks across Toolkit cards, composer menus, Essay Grader upload/paste, Settings tabs, and Cowork sidebar.
4. Validate touch targets and no-horizontal-overflow at 375, 390, 520, 768, 1024, 1280, and 1440 px in a device-capable runner.

### Larger workflow improvements requiring product decisions

1. Define the first-chat recommendations and whether they vary by educator role, recent work, or permissions.
2. Decide whether completed lesson plans need a first-class library/recent list rather than only chat-history retrieval.
3. Define Cowork project organization (recent, pinned, archived, search, and project metadata) before project volume grows.

## Reusable UI consistency checklist

- Does the change reuse Ethos tokens, Poppins/IBM Plex Mono, navy shell, warm accent, rounded cards, existing icons, and existing components?
- Is the primary action explicit and visually dominant without adding a competing CTA?
- At each transition, does the UI name the selected tool/agent and state whether it is ready, loading, unavailable, complete, or failed?
- Are empty states task-oriented and connected to an obvious next action?
- Does every form field have a visible label, helpful example/instruction, inline error, and recoverable validation message?
- Are loading and async results announced to assistive technology and visually distinguishable without color alone?
- Do icon-only controls have an accessible name and, where discoverability matters, a visible short label or selected state?
- Does the layout hold at 375/390/520/768/1024/1280/1440 px with no clipping, accidental three-column compression, or horizontal scrolling?
- Can a keyboard user reach, operate, and exit menus, dialogs, tabs, cards, file pickers, and sidebars with a visible focus indicator?
- Are all new user-facing strings localized through the existing localization system?
- Are destructive, permission, limit, and offline states explicit, reversible where possible, and tested before merge?

## Implementation guardrails

Keep changes in small batches. Reuse existing components and tokens, preserve routes and behavior, and capture desktop/tablet/mobile states after each batch. Do not treat this report as approval to redesign or refactor the UI wholesale.
