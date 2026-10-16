# Ethos Educate: portfolio demo

## One-line description

Ethos Educate is an education-focused AI workspace that gives teachers a governed chat experience alongside purpose-built workflows for lesson planning, essay feedback, AI-writing-pattern review, and classroom-ready document creation.

It is a customized LibreChat-based platform, not a model trained from scratch. The product work is in the educator workflows, the model/tool experience, MCP integrations, and the reliability and deployment work around them.

## What a reviewer can see in a three-minute demo

1. Start in the educator chat and explain that the model is scoped to teaching, learning, school operations, and family communication.
2. Open **Essay Grader** and select a rubric. Paste a short, fictional student essay, or upload a sample document. Show the structured rubric feedback, inline highlights, and the separate proofreading and improvement passes.
3. Switch to **AI Detection**. Explain that it is presented as a writing-pattern signal for educator review, not as a definitive accusation. Show the result and its evidence-oriented feedback.
4. Return to chat and launch **Lesson Planning**. Select the state, subject, grade, duration, and scope. The app validates the choices through the lesson-planning MCP before asking for a unit and generating a plan.
5. Enable one AI Tool below the message box and make a practical request such as a worksheet, an assessment, a classroom visual, or a downloadable document. Explain that tools are opt-in per chat and that generated documents are stored behind authenticated download links for 24 hours.
6. End on the engineering view: the React client streams agent responses from an Express API, the API routes model/tool calls through the existing agent engine, and MCP servers provide specialised services such as lesson planning and document generation.

Use only fictional student work or material you have permission to show. Do not put real student names, school records, API keys, or internal URLs in the recording.

## Recording outline

| Time | On screen | What to say |
| --- | --- | --- |
| 0:00–0:20 | Chat home | “This is Ethos Educate, an AI workspace designed around educator workflows rather than generic chat.” |
| 0:20–1:15 | Essay Grader | “A teacher can use a shared or custom rubric, receive criterion-level feedback, and move between scoring, feedback, improvement, and proofreading without losing the submission context.” |
| 1:15–1:40 | AI Detection | “This is a separate writing-pattern review workflow. The interface is designed to support teacher judgement, not to make an automated disciplinary decision.” |
| 1:40–2:15 | Lesson Planning chat | “The launch form supplies structured classroom context. The agent verifies the available state, subject, grade, and unit data through an MCP service before it creates the lesson.” |
| 2:15–2:40 | AI Tools or generated document | “Specialised tools are explicitly enabled for the conversation, so educators can see which capability is being used.” |
| 2:40–3:10 | Code/editor or architecture slide | “The frontend is React/TypeScript; the server is Node/Express; MongoDB holds product state; the AI layer uses provider models and MCP integrations. I focused on the product integration and the reliability details that make these workflows usable.” |

Keep the final video between 2.5 and 3.5 minutes. Record it locally, upload it as an unlisted YouTube video or a view-only Drive file, and send that URL plus the repository only if the repository is safe to share.

## Architecture, in plain English

```text
Teacher
  -> React/TypeScript interface
  -> Express API and agent runtime
  -> model provider for reasoning and streaming
  -> MCP services for specialist actions
     -> lesson planning data and plan generation
     -> document generation
     -> optional search, images, audio, and video discovery
  -> MongoDB and per-user file/workspace storage
```

The essay grader is a distinct React workflow at `/tools/essay-grader`. It talks to the separately configured Co-grader API, which provides published rubrics, document extraction, single and batch grading, and a separate detection endpoint. Keep that service available during a live demo; the front-end defaults to `http://localhost:4000/api` when `VITE_COGRADER_API_BASE_URL` is not configured.

The lesson-planning workflow starts from structured classroom context. It directs the agent to validate options using the lesson-planning MCP, retrieve units for the selected state/subject/grade, and only then produce the plan. That is stronger than simply placing a generic “make a lesson” prompt in a chat box.

## Honest application response draft

Replace the bracketed wording with your exact role and only state that people used it if that is true and you can describe the audience without exposing confidential information.

> **1. What did you build, and what did you personally own?**
>
> I built and maintained Ethos Educate, an education-focused AI workspace built on a customized LibreChat foundation. It gives educators a governed AI chat experience plus targeted workflows for lesson planning, rubric-based essay feedback, writing-pattern review, and classroom-ready content generation. I personally owned the educator-facing integration work: the essay-grader product route and its connection to the grading service, the guided lesson-planning launch flow, model/MCP capability presentation, and the reliability fixes around agents, generated artifacts, and tool availability. [Add one sentence describing your exact deployment/release responsibility.]
>
> **2. What did not work as expected once it was used?**
>
> A production-like sandbox build exposed a blank page on startup and refresh. The underlying problem was a Vite manual-chunk configuration that separated i18n code into a cyclic chunk graph; that chunk reached React before its namespace was initialized. The PWA precache configuration also omitted `index.html`, which made reload behaviour worse.
>
> **3. How did you solve it?**
>
> I traced the emitted chunks and the browser error, removed the unsafe i18n manual-chunk split, restored `index.html` to the Workbox precache, then verified the corrected production output and focused localization tests. I also kept route-level lazy loading, which preserved the earlier reduction in initial client payload without reintroducing the startup cycle.
>
> **4. What would you do differently today?**
>
> I would define service contracts, health checks, observability, and release gates earlier—especially for the separate grading service and MCP dependencies. I would also add authenticated end-to-end tests for the highest-value flows, enforce bundle and PWA smoke checks in CI, and expose a small demo-safe environment so product validation does not depend on a local multi-service setup.

## Before sending a link

- Confirm the app starts from a clean browser profile and works after a hard refresh.
- Confirm the Co-grader API, MongoDB, model credentials, and any MCP service used in the recording are live.
- Prepare one fictional essay and one deterministic lesson-planning prompt.
- Remove browser bookmarks, terminal panes, notifications, internal domains, account email, and secrets from the video.
- Include one link that works without a company login: an unlisted video is the safest option.
- If the code repository is private, send the video and offer a short live walkthrough instead of sharing source code.
