# Ethos Educate production-readiness and performance audit

**Audit date:** 2026-08-28  
**Scope:** repository inspection plus read-only measurements against the configured MongoDB instance. Application-code performance, reliability, security, and regression protection are in scope. Production deployment, CI/CD operation, infrastructure configuration, environment/secrets, and releases are owned by a separate developer and are explicitly excluded from implementation scope.

No source, configuration, database record, file, or external AI content was changed. Existing uncommitted user work was preserved.

## Executive summary

**Current maturity: 2.5 / 5 — staging-capable, but not yet production-grade for a multi-user education workload.**

Ethos has a substantial functional foundation: authenticated React routes, JWT/OpenID support, schema indexes and TTLs, private Azure Blob storage, route validation, rate limiters, streamed agent runs, MCP recovery code, a deployment pipeline, and 384 test files. The application should not be scaled or treated as a fully hardened production service until the findings below are addressed.

The five highest-impact application issues are:

1. **High — login loads the whole feature graph.** Generated HTML references 32 JS/CSS assets totaling **12.79 MB raw, 3.40 MB gzip, and 2.50 MB Brotli** before authentication. It includes HEIC conversion, Sandpack, Monaco/CodeMirror, full locales, and other non-login capabilities.
2. **High — React Query cache is recreated during application rendering.** This can discard cache state and contributes to duplicate startup configuration/banner calls.
3. **Critical — RAG contains fail-open auth and isolation/path safety risks if reachable.** A missing JWT secret permits requests, a caller can supply another entity namespace, and raw upload names are used in filesystem paths.
4. **Medium — Azure Blob signed-link renewal uses unbounded parallel work.** A user with many expired files can cause a burst of storage calls and metadata writes on a list request.
5. **Medium — the conversation-list index does not yet match the normal history query shape.** Redacted timing telemetry is now in source; collect actual usage data before deciding whether an index is justified.

The recommended response is not a rewrite. First close the contained application security and performance gaps, then instrument, test, and optimize in reversible batches. No user-facing workflow needs to be removed or redesigned.

## Scope boundary: deployment is excluded

No deployment, CI/CD, infrastructure, production environment, secret, scaling, Azure, Helm, Docker, or release change is proposed in this audit's implementation plan. Those observations remain repository evidence only and can be handed to the deployment owner if they request them. Application work will preserve the existing deployment contract and require no secret values from the product team.

## Audit method and confidence

| Category | Method | Result |
|---|---|---|
| Architecture, dependencies, flows | Read manifests, source, schemas, local YAML, Docker, Compose, Helm, Bicep, and CI | Complete for repository state |
| Local runtime | Used configured MongoDB with LOCAL_USE_CONFIGURED_MONGO true; did not substitute ephemeral Mongo | Existing API already ran on port 3080 |
| Database | Read-only collection statistics, indexes, and explain plans; no document content printed | Measured |
| Browser and network | Headless Chrome against fresh local Vite and existing API | Anonymous login measured |
| Accessibility | Axe scan against anonymous login | Measured |
| Load | 100 read-only configuration requests at concurrency 10 | Measured |
| AI, authenticated use, upload/OCR/RAG, lesson generation | Not run | Would create data, incur paid external work, or require an approved test identity |

Measured statements use observed values. Static statements are direct source/configuration evidence. Hypotheses are explicitly labeled and should not be implemented without instrumentation.

## Implementation progress

The following small, reversible source-level fixes are complete. Deployment configuration, infrastructure, CI/CD, and deployment secrets were not changed.

* **P0 stable React Query client:** completed previously with a re-render regression test.
* **P0 RAG authentication, ownership, and upload-path safety:** completed in the current source. RAG now refuses to start without `JWT_SECRET`, except when both `NODE_ENV=development` and `RAG_ALLOW_UNAUTHENTICATED_DEVELOPMENT=true` are explicitly set. This opt-in bypass is for isolated local development only and defaults to disabled.
* RAG derives document ownership only from the signed JWT `id` claim. Existing endpoint URLs and payload fields, including `entity_id`, remain accepted, but `entity_id` can no longer select another user's namespace.
* Document IDs, reads, search, context retrieval, deletion, rollback, and uploads are filtered by the authenticated user. New uploads use generated filenames under a resolved, hashed per-user temporary root; displayed filenames and file-processing behavior remain unchanged.
* Focused RAG security tests cover missing-secret rejection, development-only bypass, signed user identity, owner filters, safe upload paths, traversal rejection, and valid bearer tokens.
* **P1 Azure Blob signed-link renewal:** completed in the current source. A file-list request renews at most four expired Blob links concurrently, preserves list order and response shape, and retains the existing single batch Mongo update.
* Azure Blob and concurrency tests plus focused ESLint checks pass. The repository-wide `packages/api` TypeScript check remains blocked by pre-existing errors in unrelated cache, MCP, OIDC, and utility test files.
* **P1 conversation-history query telemetry:** completed in the current source. `getConvosByCursor` now records its Mongo execution time, fetched/returned counts, pagination state, requested limit, and a redacted query shape. It never logs a user ID, project ID, tag, search text, cursor, title, or conversation ID. No index or response behavior changed.
* **Release-gate resolution (2026-08-31) — production startup and PWA:** the sandbox's `createContext`/blank-page outage was caused by an unsafe Vite manual-chunk graph, not by the backend or deployment environment. The forced chunks created React dependency cycles (`react-vendor -> vendor -> react-vendor`), so a React-dependent chunk could execute before its React export was initialized. The custom `manualChunks` and `onlyExplicitManualChunks` overrides were removed; Vite/Rollup now creates its dependency-safe default graph while retaining the existing filenames, routes, APIs, build command, and deployment contract. A fresh local production browser load of `/c/new` and a reload both mount successfully, redirect an anonymous visitor to login as before, and produce no console errors.
* **PWA release hygiene:** the five existing logo PNGs were mechanically regenerated from the existing SVG at their manifest-declared dimensions (16×16, 32×32, 180×180, 192×192, and 512×512). The existing public directory is now available when Workbox creates the precache. The final service worker precaches `index.html` and all five icons, preventing the observed `non-precached-url: index.html` reload error. The post-build copy remains unchanged, so deployment uses the same command and artifact contract. This changes only PWA/icon artifacts; routes, application behavior, API behavior, and service-worker navigation behavior are preserved.
* **Final release validation (2026-08-31):** the exact client production build succeeds (9,576 transformed modules; Workbox precache: 230 entries / 15,282.88 KiB). Its initial entry graph is two emitted assets totaling 4.02 MiB raw, 1.03 MiB gzip, and 745 KiB Brotli. A fresh Vite preview browser session and an immediate reload were both verified with no console errors. `client` passes 112 suites / 1,247 tests; `packages/api` passes 113 suites / 2,804 tests with one intentionally skipped test; `packages/data-provider` passes 14 suites / 828 tests (one skipped); and `packages/data-schemas` passes 13 suites / 373 tests (three skipped). The legacy `api` run passed 92 suites with two skipped; its only full-run gap was a resource-exhausted worker for `loadConfigModels`, whose 9 tests pass when run in isolation.
* The complete `api/models/Conversation.spec.js` suite passes (44 tests), including the new telemetry redaction and unchanged-pagination regression test. Existing uncommitted user work was preserved throughout verification.

Before promoting this batch, run the existing RAG workflow with a non-production test account against the configured vector store. Documents whose stored metadata lacks `user_id` will deliberately be inaccessible until re-embedded, preventing cross-tenant fallback.

## Technology and architecture inventory

| Area | Technologies / observed versions | Purpose |
|---|---|---|
| Workspace/package manager | npm 11.11.0, root declares npm 11.10.0; root also has bun.lock; Node observed 24.14.1 | npm workspaces for api, client, packages. Duplicate npm/Bun script paths increase maintenance surface. |
| Frontend | React 18.2, React Router 6.30, Vite 7.3, TypeScript 5.3, Tailwind 3.4, React Query 4.28, Recoil 0.7, Jotai 2.12 | SPA, client state, routing, server API cache. All listed state libraries have source usage. |
| Backend | Node, Express 5.2, legacy JavaScript in api, TypeScript in packages/api, Zod 3.22 | API, auth, SSE, agents, files, MCP, sharing, cowork, admin. |
| Primary data | MongoDB, Mongoose 8.12, MongoDB driver 6.14 | Users, conversations, messages, agents, files, ACL, tokens, routines, configuration. |
| Cache/streams | Keyv, optional Redis/ioredis, optional Redis streams | Local configuration has no USE_REDIS, making state process-local. |
| AI | Azure OpenAI GPT-5.2-chat, GPT-5-chat, GPT-5-mini, GPT-5-nano; Google Gemini 3 Pro Preview and 2.5 Flash; OpenAI assistant-compatible paths; Bedrock/Anthropic/Ollama support | Chat and agent providers; GenerationJobManager handles streamed runs. |
| Integrations | MCP SDK; lesson planning, M365, GitHub, web search, document creation, image, podcast, YouTube, NetSuite, Canva | Configured as remote or local MCP servers, some with OAuth. |
| Files | Azure Blob active; optional S3/Firebase/local/OpenAI/vector; Sharp, PDF.js, Mammoth, SheetJS | Mongo metadata plus Azure Blob file storage. Private signed Blob reads default to two minutes. |
| RAG | Python 3.10, FastAPI 0.115, LangChain, sentence-transformers, pgvector/Postgres or Mongo Atlas vector mode | Optional document ingest, extraction, embeddings, retrieval. |
| Background work | GenerationJobManager, MCP initialization/reconnect, Cowork scheduler | SSE stream/resume and in-process routine execution. |
| Deployment artifacts (reference only) | Docker, Compose, Azure Container Apps/Bicep/ACR/Blob/Log Analytics, Helm | Deployment is owned externally and excluded from the implementation plan. |
| Tests/tooling | Jest 30, Playwright 1.56, Axe, ESLint 9, Prettier, Turborepo | 384 test files: API 95, client 111, packages/api 132, data-provider 14, schemas 13, E2E 7. |

### Component interactions

~~~text
Browser
  -> React/Vite SPA
      -> React Query + Recoil/Jotai
          -> Express API
              -> MongoDB
              -> Azure Blob
              -> Azure OpenAI / Google / other model providers
              -> MCP services
              -> optional Redis
              -> optional FastAPI RAG -> pgvector/Postgres or Atlas vector search
~~~

### Primary user and data flows

**Login/startup.** Browser receives SPA assets, mounts client/main.jsx and routes/index.tsx, then calls API config/banner/session-refresh endpoints. Auth routes use Passport. LoginController sets tokens; protected routes use the bearer JWT strategy. OpenID reuse is supported by requireJwtAuth middleware.

**Dashboard/chat/save/load.** Authenticated Root renders navigation, chat, dashboard, projects, agents, essay grader, admin, and Cowork. React Query hooks call routes mounted in api/server/index.js lines 149–179. Conversations are cursor-paginated in routes/convos.js and messages in routes/messages.js; both persist in Mongo.

**Lesson generation.** The agent chat route authenticates, applies ban/UA checks and configured message limiters, then hands work to GenerationJobManager. The selected lesson-planning MCP drives state/framework/subject/grade/unit/suggestions/generation and returns the DOCX link. Provider capability/model settings are in config/librechat.local.yaml lines 580–639.

**Files/RAG.** Files are validated, persisted as metadata in Mongo, and routed by services/Files/strategies.js. The configured azure_blob strategy generates private signed reads. Optional RAG loads/chunks/embeds documents to pgvector or Atlas.

**Real time.** Agent SSE supports abort, status, replay, and resume at the agents chat stream endpoint. MCP and Cowork routines initialize from the server process.

## Measured baseline

Numbers are local-to-local unless noted. Database connection is the configured remote MongoDB URI, so it includes network time.

| Measurement | Observed result | Meaning |
|---|---:|---|
| Mongo driver connect + ping | 2,844 ms | Remote DB connection materially affects cold startup. |
| Mongoose connect + ping | 2,054 ms | Mongoose itself does not explain the >60s API readiness symptom. |
| Mongo inventory + query plan collection | 6,054 ms | Includes remote connection, stats, index reads, explains. |
| API config, ten serial requests | p50 9.0 ms; min 7.9; max 291.2; 15,484 bytes | Warm public metadata path, with one cold/outlier response. |
| API endpoints, ten serial requests | p50 6.3 ms; max 7.0; 251 bytes | Warm public metadata path. |
| API root, ten serial requests | p50 9.0 ms; max 13.6; 5,223 bytes | HTML response is fast when static assets are consistent. |
| API config, 100 requests at 10 concurrency | 237.7 req/s; p50 22.9 ms; p95 84.5; p99 87.7; max 194.3; 0 errors | Only a lightweight read endpoint; not evidence of AI/upload capacity. |
| Vite dev server ready | 4,967 ms | Development-only. |
| Anonymous login, Vite browser | TTFB 49 ms; DOM interactive 748 ms; load 4,246 ms; 15.9 MB dev transfer over 250 resources | Login works in a fresh Vite session. |
| Production build | Vite reported 3m49s | Build also warned about stale Browserslist data and unmatched PWA globs. |
| Production initial asset graph | 32 JS/CSS files; 12.79 MB raw; 3.40 MB gzip; 2.50 MB Brotli | Parsed from generated client/dist/index.html. |
| PWA precache | 37 entries / 13,907 KiB | From Vite PWA output. |
| Existing API memory | 281.6 MiB working set; 418.3 MiB private | One warm local development process; not a capacity estimate. |
| Axe anonymous login | 2 moderate violations: landmark-one-main and region | 39 rules passed, 1 incomplete. |

### Database baseline

The configured database is small: 91 conversations, 621 messages, 29 files, 17 users, 41 agents, 4 Cowork routines, and 2 MCP servers. Current server-side query work is small; it does not prove history performance at real production volume.

* Conversation explain for a user filter and updatedAt sort returned 25 items, examined 25 documents and 70 keys, and included a SORT stage. Wall time was 119 ms while Mongo server execution reported 0 ms.
* Message explain for one user/conversation returned 7 items, examined 7 documents and 7 keys, and included a SORT/FETCH plan. Wall time was 127 ms; server execution reported 0 ms.
* Existing indexes cover IDs, individual user/conversation fields, TTL, and project ordering. The normal unprojected history query has broader filters and no matching compound index.

## Evidence-based findings

### Critical

#### C-1 — RAG authentication is fail-open *(implemented locally; deployment validation pending)*

* **Evidence:** rag-api/app/middleware.py lines 21–24 logs a missing JWT secret and forwards every request. rag-api/docker-compose.yml and rag-api/api-compose.yml expose port 8000.
* **Risk:** A secret provisioning failure becomes unauthenticated document ingest, retrieval, query, and delete access.
* **Fix:** Fail startup outside explicit development mode if JWT_SECRET is missing. Use a documented development-only bypass defaulting false. Restrict RAG to private ingress/network policy.
* **Preserve/verify/rollback:** Existing valid bearer-token calls and endpoint shapes remain unchanged. Test no-secret startup, valid/invalid/missing token statuses and private reachability. The local bypass remains a separately gated rollback for isolated development only.

#### C-2 — RAG user namespace and upload path are caller controlled *(implemented locally; deployment validation pending)*

* **Evidence:** rag-api/app/routes/document_routes.py lines 73–77 prefers supplied entity_id over the authenticated subject. Upload handlers near lines 885, 1025, and 1148 join file.filename directly into filesystem paths.
* **Risk:** Cross-tenant vector namespace access and path traversal/file overwrite opportunities if RAG is reachable.
* **Fix:** Derive namespace exclusively from validated JWT claims; isolate any service impersonation into a separately authenticated/audited route. Reject unsafe file names and write generated UUID filenames under resolved per-user roots.
* **Preserve/verify/rollback:** Upload/download semantics and user-visible names stay unchanged. Add tests for cross-user entity IDs, ../ and Windows separators, collisions, and existing-key read compatibility before changing storage paths.

### High

#### H-1 — Entire feature graph is loaded before login

* **Evidence:** client/src/routes/index.tsx statically imports marketplace, essay grader, OAuth, dashboard, chat, projects, admin, Cowork and auth modules. client/dist/index.html references 32 module assets.
* **Measured impact:** The initial graph is 12.79 MB raw and 3.40 MB gzip. It includes 3.57 MB vendor, 2.19 MB HEIC conversion, 2.18 MB locales, 2.13 MB main index, Sandpack, CodeMirror, KaTeX, and additional libraries.
* **Root cause:** Manual chunks split code but do not defer statically imported dependencies; Vite emits all entry dependencies.
* **Fix:** Use route-level React.lazy and Suspense. First defer marketplace, essay grader, admin, dashboard, Cowork, code/artifact editors, Sandpack, HEIC conversion, Mermaid, and non-default locales. Set a measured login gzip budget.
* **Preserve/verify/rollback:** Retain all URLs, components, keyboard behavior, prompts, and loading affordances. Playwright smoke every route, mobile login visual, PWA/offline check, and bundle budget. Revert each lazy import independently if a chunk cycle appears.

**Approved implementation update (2026-08-28):** Route-level modules and the Mermaid renderer now load on demand. Mermaid source remains visible while its renderer downloads, and the existing error boundary still handles render or chunk failures. The artifact renderer now imports Mermaid only when it mounts and ignores an already-unmounted render. Vite's manual chunk output now uses explicit chunk boundaries so its shared preload helper does not make the Mermaid chunk an entry dependency. A production build measured the entry graph at 8.48 MB raw / 2.28 MB gzip across 23 assets: 4.31 MB raw / 1.12 MB gzip (about 33%) below the audit baseline. Mermaid is absent from `client/dist/index.html` but remains emitted for on-demand use (1.47 MB raw / 370 KB gzip). Risk is limited to async chunk loading; the focused test suite and production build pass. Roll back the three lazy imports or `onlyExplicitManualChunks` independently if a route-specific chunk issue appears; complete authenticated browser smoke coverage before release.

**Approved implementation update (2026-08-30):** English remains embedded for immediate fallback. The other 40 language resources are now cached dynamic imports, loaded before React renders when a stored browser/cookie language requires them and loaded on selection thereafter. The existing `zh-TW`/`zh-HK` Traditional Chinese and `zh` Simplified Chinese fallbacks remain explicit. The locale-wide Vite manual chunk was removed so one language selection does not fetch every translation. A production build measured 22 entry assets totaling 6.45 MB raw / 1.73 MB gzip: a further 2.03 MB raw / 547 KB gzip (about 24%) smaller than the preceding build and about 49% below the original audit baseline. All 40 non-English files are emitted as separate deferred chunks (838 KB gzip combined), and no locale chunk appears in `client/dist/index.html`. Risk is a delayed language switch if the chunk cannot be retrieved; the loader deduplicates concurrent requests, retains English fallback on failure, and startup waits for a saved locale to prevent an English flash. Focused lint, formatter, production-build, and seven translation tests pass. Rollback is isolated to the i18n loader, the `useLocalize` call, main initialization, and locale chunk rule; restore the former static resource imports if needed.

**Production outage correction (2026-08-31):** The sandbox blank page exposed `Cannot read properties of undefined (reading 'createContext')` from the emitted `i18n.*.js` file. The Vite manual rule that isolated `i18next` and `react-i18next` created a separate chunk that read the React namespace from the already-cyclic vendor graph before it was initialized. The same configuration excluded `index.html` from Workbox precaching even though navigation fallback targets that file, producing `non-precached-url` on reload. The correction removes only the i18n manual-chunk rule and allows `index.html` into the existing precache; it does not change deployment, infrastructure, CI/CD, secrets, or environment values. The corrected production build emits no separate i18n chunk, contains `index.html` in the Workbox precache and fallback, and measures 6.46 MB raw / 1.73 MB gzip across 21 initial assets. The seven localization tests and the full production build pass. Verify by deploying through the unchanged normal process, then test `/c/new` in a clean browser profile and on refresh; rollback is the two-line Vite configuration change.

**KaTeX deferral investigation (2026-08-30, not applied):** A focused conditional renderer was implemented and verified by 45 math/Markdown tests, then evaluated through production builds. With the existing `onlyExplicitManualChunks: true`, Rollup still emitted the 268 KB / 77 KB-gzip KaTeX script as an initial HTML module because the shared Markdown dependencies form a chunk cycle; the normal entry remained 6.43 MB raw / 1.73 MB gzip. A local-only experiment using implicit manual-chunk dependencies removed the named KaTeX entry but moved its code into the initial vendor graph and made Mermaid initial again, increasing the entry to 7.93 MB raw / 2.10 MB gzip. The conditional renderer was fully reverted because it would add an async render delay without a production payload benefit. A future change must first map and break the Markdown/manual-chunk cycle, then verify both non-math startup and Mermaid remain deferred before it is accepted.

#### H-2 — React Query cache is recreated on every App render

* **Evidence:** client/src/App.jsx lines 19–38 constructs QueryClient and QueryCache inside the App function. Browser startup observed duplicate API config and banner requests.
* **Risk:** Re-renders can discard cache, disable deduplication, lose optimistic state, cause refetches, and make errors unpredictable.
* **Fix:** Create the client once via useState initializer or module scope while retaining current QueryCache error behavior.
* **Preserve/verify/rollback:** Query keys/refetch/stale settings and API shapes do not change. Add a re-render identity/cache test and browser assertion of one startup request per key. One-file rollback.

#### H-3 — Single replica plus no shared cache blocks safe scale-out *(deployment-owner handoff; excluded from this plan)*

* **Evidence:** GitHub workflow defaults min/max replicas to 1, CPU 1.0, memory 2 GiB at lines 31–34; USE_REDIS defaults false at lines 195–197. packages/api/src/cache/cacheConfig.ts makes cache/stream state local when Redis is absent.
* **Risk:** One instance is an availability/throughput ceiling. Adding replicas later without shared state risks lost stream resumes, inconsistent limits, cache divergence, and duplicate Cowork work.
* **Fix:** Provision TLS Redis, set an environment deployment prefix, enable Redis streams, validate stream resume/abort across two replicas, then raise replica limits using measured concurrency.
* **Preserve/verify/rollback:** Existing agent and SSE endpoints stay the same. Canary a two-replica generation/resume/abort flow, verify exactly one persisted/billed outcome, and retain a one-replica fallback profile.

#### H-4 — API has no graceful shutdown and Azure has no explicit probes *(deployment-owner handoff; excluded from this plan)*

* **Evidence:** api/server/index.js starts listening at line 203 and has no SIGTERM/SIGINT teardown. Docker runs normal backend. deploy/azure/main.bicep lines 265–314 has no startup/readiness/liveness probe and uses activeRevisionsMode Single.
* **Measured symptom:** Two audit-only normal API instances using real configured Mongo did not bind within 60 seconds. Direct driver/Mongoose pings were 2.84s/2.05s. A subsequent instrumented local run identified about 90 seconds loading backend modules before Mongo connection begins, about 2.8 seconds connecting to MongoDB, and about 41 seconds initializing configured MCP services after the HTTP listener is ready. One configured MCP reported a 30.2-second initialization timeout. The server remained responsive at `/health` and `/api/config` while MCP initialization continued.
* **Fix:** Add live and ready endpoints, structured timing for config/Mongo/storage/MCP/migrations/streams, reject new work while draining, then close HTTP/SSE/jobs/Mongo/Redis/MCP within a grace deadline. Keep existing health path as a compatibility alias.
* **Preserve/verify/rollback:** Run SIGTERM during an active stream and cold-start distribution tests. Do not make optional MCP availability block normal chat unless product owners decide so.

**Implemented local diagnostic (2026-08-31):** `npm run backend:local` now prints elapsed-time milestones while it prepares local configuration, loads backend modules, connects MongoDB, applies SSO/configuration, registers file routes, opens the HTTP listener, initializes MCP/OAuth/migration/generation services, and completes startup. The initialization order, Mongo connection, configured integrations, endpoints, and deployment flow are unchanged. This exposes the exact slow phase on every local run; it does not itself reduce startup time. Syntax checks passed, and a run against the configured MongoDB returned HTTP 200 from both `/health` and `/api/config`. Rollback is limited to removing the 54 diagnostic log lines from `config/local-backend.js` and `api/server/index.js`.

#### H-5 — CI quality gate is too narrow *(deployment-owner handoff; excluded from this plan)*

* **Evidence:** workflow lines 81–98 runs four package tests and three client tests, then all pushes deploy. It lacks lint, typecheck, full workspace tests, E2E, a11y, dependency/image scans, and migration validation.
* **Risk:** Regressions across the large API/route/UI/integration surface can deploy.
* **Fix:** Separate fast PR gates from staging/production gates. Add lint, typecheck, affected/full tests, critical Playwright flows, Axe, bundle budgets, SBOM/audit/license/image scans, and deployment smoke checks. Require promotion approval and health gates.
* **Preserve/verify/rollback:** Runtime is unchanged. Seed temporary failing lint/type/test examples to verify blocking; retain current focused suite as a fast lane.

#### H-6 — RAG deployment/resource/logging defaults are unsuitable for sensitive document production *(deployment-owner handoff; excluded from this plan)*

* **Evidence:** rag-api/main.py has wildcard CORS with credentials and returns raw validation bodies. rag-api/app/config.py has default Postgres credentials and EMBEDDING_BATCH_SIZE 0. Helm values use image tag latest, no resource limits, and no probes. Middleware debug logging includes JWT payload.
* **Risk:** Data disclosure, unpredictable memory/cpu use, irreproducible images, and weak operational control.
* **Fix:** Exact private origins, redacted validation/log output, pinned image digest, fail-closed secrets, resource requests/limits/probes, bounded embedding batch/queue, request/file limits.
* **Preserve/verify/rollback:** Supported document types and response formats remain. Test 20 MB processing, 413/429 behavior, memory/batch limits, log redaction, and private ingress.

### Medium

#### M-1 — Conversation-history telemetry implemented; index decision pending observation

* **Evidence:** api/models/Conversation.js lines 217–367 filters user, archive state, Cowork, project/expiry/tags/cursor then sorts. schema/convo.ts has user/projectId/updatedAt but no unprojected history compound index. Observed explain includes SORT.
* **Impact:** Negligible today but can become a history-list latency/CPU hotspot.
* **Fix:** The normal history path now emits redacted execution timing, fetched/returned counts, pagination state, requested limit, and query-shape flags. Observe these logs for representative usage, then run targeted `explain` plans only for demonstrated slow shapes. Add only an evidence-backed compound index beginning with user and relevant state/order fields; build online.
* **Preserve/verify/rollback:** Pagination result/order and endpoint payload are unchanged. The new log contains no raw identifiers or content. Review the added redaction/pagination test, then shadow explains and index monitoring before any index rollout; remove any later index only after an observation window.

#### M-2 — Azure Blob refresh is unbounded per file-list request *(implemented locally; release validation pending)*

* **Evidence:** packages/api/src/cdn/azure.ts lines 181–211 uses Promise.all for every file; routes/files/files.js lines 42–70 invokes it after cache expiry.
* **Impact:** Users with many expired files can burst Azure calls and database writes on a list endpoint.
* **Fix:** Bound concurrency, refresh only paginated/visible files, and consider background renewal/short response caching.
* **Preserve/verify/rollback:** Links remain fresh and file metadata unchanged. Test 1,000-file fixture, request count, and metadata parity.

#### M-3 — CORS and proxy trust are broad/defaulted

* **Evidence:** api/server/index.js defaults TRUST_PROXY to 1 and calls cors without an allowlist. SSE header middleware uses wildcard CORS.
* **Risk:** Incorrect client IP/rate-limit decisions if proxy topology changes; wider browser attack surface.
* **Fix:** Configure exact trusted proxy topology and environment-specific origins. Emit allowed origin for SSE and credentials only where required.
* **Preserve/verify/rollback:** Keep known Ethos and development origins. Add allowed/disallowed CORS and spoofed-forwarded-header tests.

#### M-4 — Registration, verification, moderation, and per-user limits need policy approval

* **Evidence:** local environment enables registration and unverified login. Azure parameter script defaults the same and defaults moderation off and per-user message limits off.
* **Risk:** If these defaults reach production, account abuse and AI cost exposure rise.
* **Fix:** Establish closed production versus open demo/staging policy matrix and reject unsafe config in deployment validation.
* **Preserve/verify/rollback:** Do not alter policy without product/security decision. Verify each environment auth flow via configuration contracts.

#### M-5 — Logs exist but metrics/traces/SLOs are absent

* **Evidence:** over 1,100 logging calls and Azure Log Analytics are present, but no application metrics/traces, request IDs, provider cost metric, stream depth metric, or alert definitions are checked in.
* **Fix:** Add redacted structured request IDs and OpenTelemetry-compatible spans/metrics for route/Mongo/Blob/provider/MCP/RAG/SSE. Track latency, errors, token cost, active streams, aborts, queue depth, and RAG duration.
* **Preserve/verify/rollback:** Additive only. Test prompt/PII redaction and disable exporters independently if overhead is unacceptable.

#### M-6 — ACR admin credentials and single revision reduce release safety

* **Evidence:** workflow lines 155–166 enables ACR admin and retrieves a password; Bicep uses one active revision.
* **Fix:** Use managed identity AcrPull, revision canary/traffic shifting, SLO-based automated rollback.
* **Preserve/verify/rollback:** Service URL/image naming stay unchanged. Start no-traffic revision, smoke, shift traffic gradually, restore prior revision on regression.

#### M-7 — Login lacks landmark semantics

* **Evidence:** Axe found landmark-one-main and region moderate violations.
* **Fix:** Use one semantic main landmark and named regions around auth content, without visual redesign.
* **Preserve/verify/rollback:** Auth fields, focus, SSO and layout unchanged. Add desktop/mobile Axe and keyboard tests.

### Low / maintenance

| Finding | Evidence | Recommendation |
|---|---|---|
| Package-manager divergence | npm package manager declaration plus bun.lock and duplicate scripts | Choose one production lock/toolchain only after reproducible builds pass. |
| Browser data stale | Vite warns caniuse-lite is six months old | Automate Browserslist refresh. |
| PWA icon/precache mismatch | **Resolved in source.** Public icons are available during Workbox generation; the final precache contains `index.html` and all declared icons | Run one clean-browser install/offline acceptance check after the normal sandbox deployment. |
| Dependency risk status unproven | Audit command did not return parsable advisory output in this runner | Require npm audit JSON, Python audit, SBOM, license policy, and image scan artifacts in CI; do not claim clean status before that. |
| Multiple client state libraries | Recoil, Jotai, React Query, SWR all have source usage | Do not consolidate first; define boundaries and remove only after usage tracing/tests. |
| Local debug logging | DEBUG_LOGGING is true locally | Enforce production/staging log policy and PII/prompt redaction. |

## Functionality-preserving regression checklist

| Surface | Required checks |
|---|---|
| Authentication | Email login, SSO/OpenID callback, 2FA, refresh/logout, registration policy, password reset, disabled user |
| UI | Desktop/tablet/mobile login, chat, dashboard, search, projects, agents, essay grader, admin, settings, Cowork, error boundary, keyboard/screen reader |
| Chat | New/load/edit/delete/branch conversation, streaming, abort, reconnect/resume, title, citations, attachments, temporary chat, share links |
| AI/MCP | Azure/Google selection, tool authorization, OAuth reconnect, lesson sequence and DOCX, M365, image/document/media errors, timeouts |
| Files/RAG | Azure upload/preview/download/delete, signed-link renewal, authorization, document parsing/OCR, RAG embed/query/delete, malformed/oversized input |
| Authorization | User/admin roles, ACL/shares, project/agent/file ownership, API keys |
| Operations | cold start, SIGTERM, readiness, index/migration, Mongo/Redis/MCP/RAG outage, log redaction, backup/restore |

### Tests to add first

1. RAG auth fail-closed, subject binding, entity ID abuse, unsafe filename, and endpoint exposure tests.
2. App re-render keeps one QueryClient and does not refetch startup config/banner.
3. Route-level browser smoke tests for login, chat, lesson entry, essay grader, files, agents, Cowork, admin role boundary.
4. API graceful shutdown with active SSE stream plus ready/live state transitions.
5. Two-replica Redis stream resume/abort/idempotent accounting test.
6. Bundle-size/request-count budget test for anonymous login.
7. Mongo cursor pagination order test and representative explain-plan alert.

## Prioritized roadmap

### Quick wins: 1–3 days

| Priority | Work | Impact | Effort/risk/dependency | Preservation and verification |
|---|---|---|---|---|
| P0 | Stable QueryClient | Reduces duplicate requests/cache loss | <1 day; low | Unit + browser request-count test; isolated rollback |
| P0 | RAG subject namespace and filename safety | **Complete in source.** Removes cross-tenant/file-write risk without changing endpoint contracts | 1–2 days; medium compatibility | Focused unit tests pass; validate an authenticated synthetic RAG workflow before release |
| P1 | Login landmarks and final PWA acceptance | Accessibility/release hygiene | <1 day; low | PWA artifact defect is complete; run Axe plus one clean-browser install/offline check after normal sandbox deployment |
| P1 | Conversation-query telemetry | **Complete in source.** Confirms the exact index need before a schema change | 1–2 days; low | Capture only aggregate timings and plan shape; no index change |

### Stabilization: 1–2 weeks

| Priority | Work | Impact | Effort/risk/dependency | Preservation and verification |
|---|---|---|---|---|
| P1 | Route lazy loading | Largest client performance win | 4–7 days; chunk-cycle risk | Per-route smoke, PWA/mobile, bundle budget; incremental revert |
| P1 | Bounded Azure Blob renewal | **Complete in source.** Caps expired-link renewals at four concurrent Azure calls and keeps one batch metadata update | 1–2 days; low | Utility and Azure module tests pass; verify a large synthetic list before release |
| P1 | Application request/provider timing | Identifies slow AI and document paths without a telemetry-platform change | 2–4 days; low | Redacted structured timings; overhead test |
| P2 | Query telemetry/index analysis | Avoids premature indexes | 2–3 days after a representative observation window; low | Review redacted timings, shadow explain demonstrated slow shapes, then use an online index rollout only if justified |

### Production-grade: 2–6 weeks

| Priority | Work | Impact | Effort/risk/dependency | Preservation and verification |
|---|---|---|---|---|
| P1 | Full E2E critical journeys | Protects all important workflows | 2–3 weeks; isolated test tenant | Fixture cleanup, no production data |
| P1 | AI/MCP cost and reliability controls | Provider isolation/cost guardrails | 2–4 weeks; product limits | Timeout/retry/idempotency matrix, TTFT/cost comparison |
| P1 | Bounded file/RAG processing design | Protects API responsiveness; implementation awaits an existing approved runtime | 2–4 weeks; product/runtime decision | Job/progress semantics and idempotency contract tests |

## Recommended target application architecture

This is an incremental evolution, not a rewrite:

~~~text
React SPA
  -> Express API
      -> MongoDB: bounded pools and query telemetry
      -> Azure Blob: bounded signed-link renewal
      -> AI adapters: application-level timeouts, idempotency, and token/cost timing
      -> MCP services: per-server application isolation
      -> RAG: validated identity, subject-bound namespaces, safe file paths, bounded work
          -> existing vector store
~~~

React, Express, MongoDB, MCP, Azure Blob, and current AI providers remain in place.

## Do not change yet

* Do not add Mongo indexes before production query/cardinality telemetry proves the exact winning shape.
* Do not mechanically split every vendor chunk; lazy-load route features first, then measure login/chat/PWA.
* Do not reintroduce custom Vite manual-chunk rules without a fresh production build and clean-browser load/reload check; the previous rules caused the sandbox outage.
* Do not change deployment, CI/CD, infrastructure, environment values, secrets, scaling, or release processes; they are owned by the deployment developer.
* Do not change registration, sharing, moderation, user limits, provider models, MCP scope, lesson prompts, file retention, or SAS lifetime without owner decisions.
* Do not perform AI/RAG/upload/lesson load testing against the configured tenant until a synthetic account, budget, cleanup process, and data classification are approved.

## Limitations and local operational note

* The fresh API readiness symptom is now attributed primarily to backend module loading (about 90 seconds locally), with configured MCP initialization adding about 41 seconds after the listener begins serving. Per-module profiling is still required before attempting to reduce the 90-second import/initialization cost.
* Authenticated browser, actual AI latency/cost, file upload/OCR, RAG processing, and MCP availability were intentionally not executed to avoid user-data changes and paid external work. Cloud/deployment metrics are outside scope.
* The audit ran shared-data-provider and frontend builds. Generated ignored client/dist assets changed while the pre-existing API process still held old index HTML in memory, so it returned SPA HTML for removed old asset hashes. I did not restart that process because it was not created by this audit. Restart it through the approved local-run procedure when convenient to restore static hash consistency.

## Approval gate

No broad refactoring is authorized. Completed reversible application batches are the stable React Query client, RAG subject/path safety, bounded Azure Blob renewal, conversation-history timing telemetry, and the PWA/production-startup release correction. The next unimplemented batch is:

1. Redacted API, AI, MCP, document, and file-operation timings, followed by backend module-load profiling.
2. Login accessibility checks and a bundle/request measurement guard.
3. Aggregate conversation-query timing to decide whether an index is justified.

Approve this order, or specify another, before implementation begins.
