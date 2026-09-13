# PLAN-0007: Project and Overview Integration

Status: `completed`

## Goal

Integrate the existing Project and Overview APIs into the authenticated frontend established by [PLAN-0006](PLAN-0006-frontend-auth-http-integration.md). Server-owned Projects become the canonical source of Project UUIDs for later features. Lists, detail, creation, editing, archive/unarchive and counters must work without reading prototype records, assuming a complete Project array, or requesting excluded business APIs.

Approved for execution on 2026-09-13, including the integration contract and every explicit approval candidate. All six sessions are authorized in order under the self-recovery policy.

## Scope

- Frontend-owned Plan and implementation. Follow the [runtime template](PLAN-TEMPLATE-RUNTIME.md), [Plan lifecycle rules](PLANS.md) and applicable source/document instructions. Update the existing frontend index entry at activation/completion; do not create a backend Plan copy.
- Include the four Project operations (list, detail, create and PATCH), GET Overview, authenticated composition, validated DTO adapters, queries, forms, pagination, counters, cancellation, invalidation and frontend-owned tests/documentation.
- Reuse PLAN-0006's existing session, same-origin Vite/Nginx transport, in-memory CSRF, errors, generation control and local OIDC/PostgreSQL acceptance topology. Expose its transport/lifecycle through narrow app composition; do not create a second independent session/client for Projects.
- Preserve prototype implementation/regressions behind the separate legacy entry and preserve all legacy localStorage values. `devspace.projects.v1` is never authenticated authority or an automatic import source.
- Use installed React/TypeScript/Vite/Vitest/Playwright and native APIs. No new runtime HTTP, router, state-management, query-cache or decimal dependency. No new environment variable is anticipated; if execution introduces one, update both frontend root `.env` and `.env.example` with safe values/examples without replacing existing secrets.
- Exclude Task (including stats), Journal, Milestone, Link and Dashboard APIs and their authenticated providers/editors/fixtures; exclude Dashboard/Home defaults and writes. Aggregate task counts returned by Overview are explicitly in scope and do not authorize Task API integration.
- Also exclude Project deletion (no DELETE contract), Workspace editing, automatic local import/deletion/ownership assignment, monitoring, backend implementation/test-support/security changes, live deployment, real Google rollout and unrelated stabilization.

### Inspection baseline and authority

Planning inspection on 2026-09-13 used frontend HEAD `75e679358e482c64f5e79ac7699948029ae3d6d2` plus the completed, currently uncommitted PLAN-0006 implementation. Backend HEAD is `cdd4bf01aaa3ff7e7a68802e74a88a93b1938379`, with pre-existing contract-review/business changes. Recheck both working trees before execution; preserve unrelated changes. HEAD alone does not describe the inspected working trees.

The implemented source and reviewed generated `.gradle/backend-openapi-review/after.json` in the sibling backend checkout are authoritative, rather than historical frontend API proposals. Evidence:

- [Implemented contract review](../../../dev-back/devspace/docs/reviews/2026-09-13-backend-openapi-contract-review.md).
- [Project controller](../../../dev-back/devspace/src/main/java/com/kopite/devspace/project/presentation/ProjectController.java), [response DTO](../../../dev-back/devspace/src/main/java/com/kopite/devspace/project/presentation/dto/ProjectResponse.java), [create DTO](../../../dev-back/devspace/src/main/java/com/kopite/devspace/project/presentation/dto/CreateProjectRequest.java), [update DTO](../../../dev-back/devspace/src/main/java/com/kopite/devspace/project/presentation/dto/UpdateProjectRequest.java).
- [Project query service](../../../dev-back/devspace/src/main/java/com/kopite/devspace/project/application/query/ProjectQueryService.java), [command service](../../../dev-back/devspace/src/main/java/com/kopite/devspace/project/application/command/ProjectCommandService.java), [creation fingerprint](../../../dev-back/devspace/src/main/java/com/kopite/devspace/project/application/command/ProjectRequestHash.java).
- [Overview controller](../../../dev-back/devspace/src/main/java/com/kopite/devspace/overview/presentation/OverviewController.java), [response DTO](../../../dev-back/devspace/src/main/java/com/kopite/devspace/overview/presentation/dto/OverviewResponse.java), [query service](../../../dev-back/devspace/src/main/java/com/kopite/devspace/overview/application/OverviewQueryService.java).
- [Project API tests](../../../dev-back/devspace/src/test/java/com/kopite/devspace/ProjectApiTests.java), [Project OpenAPI tests](../../../dev-back/devspace/src/test/java/com/kopite/devspace/ProjectOpenApiTests.java), [Overview API tests](../../../dev-back/devspace/src/test/java/com/kopite/devspace/DashboardOverviewApiTests.java).

Current [AuthApp](../../src/app/auth/AuthApp.tsx) mounts no business providers. [AuthSession](../../src/app/auth/session.ts) retires generation on revalidation; bounded CSRF recovery currently exists specifically for logout. Its shared client already injects mutation CSRF, preserves explicit headers/field omission and handles cancellation/auth errors.

The legacy Project [model](../../src/features/projects/model.ts) imports fixture identity lookup; its [provider](../../src/features/projects/ProjectsProvider.tsx) exposes complete local arrays and boolean saves. The [editor](../../src/features/projects/ProjectEditor.tsx) generates IDs, and [detail](../../src/pages/ProjectDetailPage.tsx) resolves from that array and imports Tasks/Journals/Milestones. These are legacy assumptions to isolate, not reuse as API authority. The existing `ProjectOverview` component is a local Project-list view, not an Overview API client.

## Changes

1. Add server-owned Project models and explicit adapters, isolated from legacy types/fixture lookup.
2. Add authenticated Project list/detail and async create/edit/archive workflows with cursor, idempotency and revision handling.
3. Add independent Overview queries/counters without loading excluded features or deriving totals from Project pages.
4. Add identity/generation-owned caches, request sequencing, invalidation and safe draft/intent handling through app composition.
5. Extend frontend/browser/real-backend acceptance and document the resulting boundary after validation.

## Proposed API and model mapping

### Operations

All browser calls remain relative and same-origin. These are the only new production requests proposed:

| Operation                     | Request                                                                                                                      | Success / relevant errors                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| GET `/api/v1/projects`        | scope all/unity/server; status active/archived/all; query; limit 1–100; optional opaque cursor. Defaults all/active/empty/20 | 200 `{items,total,nextCursor}`; 400 VALIDATION_ERROR or INVALID_CURSOR                                 |
| GET `/api/v1/projects/{id}`   | Canonical UUID, independent of list status                                                                                   | 200 full Project including archived; 400 invalid UUID; 404 RESOURCE_NOT_FOUND for missing/inaccessible |
| POST `/api/v1/projects`       | Writable create fields; required Idempotency-Key and current X-CSRF-Token                                                    | 201 full creation response, including replay; 400 VALIDATION_ERROR; 409 IDEMPOTENCY_KEY_REUSED         |
| PATCH `/api/v1/projects/{id}` | Required expected revision and supplied editable fields/status; current CSRF                                                 | 200 full Project; 400 VALIDATION_ERROR; 404 RESOURCE_NOT_FOUND; 409 REVISION_CONFLICT                  |
| GET `/api/v1/overview`        | Only optional scope and projectId; no repeated parameters                                                                    | 200 complete aggregate snapshot; 400 VALIDATION_ERROR; 404 missing/inaccessible selected Project       |

All retain existing 401 AUTH_REQUIRED, typed 403 ACCOUNT_DISABLED and applicable server errors. Mutations may return CSRF_INVALID; unknown 403 is not session expiration. Existing auth endpoints remain available for established lifecycle/security recovery.

### Project DTO, API model and draft

Introduce an API-only model such as `ApiProject` within Projects. Do not use the fixture-bearing legacy model as its runtime validator. Keep validated canonical server fields; derive presentation aliases rather than maintaining independently writable duplicates.

| Backend field                                   | Frontend representation                                                                                                               | Write policy                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                                              | Validated canonical UUID, preferably opaque feature-owned `ServerProjectId`; identity for detail, selections and later feature inputs | Never generate a Project ID, infer it from names/colors or send it in the body                                                                             |
| revision                                        | Positive safe integer, distinct from session generation and Workspace revision                                                        | Server result; send captured expected revision on PATCH only                                                                                               |
| createdAt / updatedAt                           | Validated server timestamp strings retained as audit metadata, formatted only for display                                             | Never synthesize with browser time or write back                                                                                                           |
| name / subtitle / scope / stack / repositoryUrl | Corresponding fields; a Project scope is unity/server, never all                                                                      | Explicit writable allowlist with contract validation                                                                                                       |
| progress                                        | Finite manual percentage 0–100, decimals allowed                                                                                      | Never derive from task totals or truncate to integer; PATCH only when edited                                                                               |
| currentMilestone                                | Authoritative memo string; adapt to presentation/draft `milestone` where useful                                                       | Map milestone → currentMilestone; never send milestone or create/infer a Milestone resource                                                                |
| status                                          | Authoritative active/archived; derive `archived = status === 'archived'`                                                              | Archive/unarchive maps to PATCH status; POST does not accept status                                                                                        |
| colorToken                                      | Server unity/server token; explicit `unity → forest`, `server → api` presentation classes/icons                                       | Never send color/colorToken or use fixture-ID icon lookup; unknown nonempty tokens may use a neutral presentation fallback without changing identity/scope |

- Validate required response fields, UUIDs, safe revisions, scope/status, finite progress and timestamps. Missing/malformed data is a protocol error, never a fixture fallback. Additional response metadata can be ignored but never serialized back. Validate page totals and Overview counters as nonnegative safely representable integers; do not silently round unsafe counters.
- Creation/edit drafts are separate from persisted Projects. A local form/intent identifier is not a server Project ID and cannot enter an entity map, URL or later feature projectId. A UUID-shaped legacy record is still not trusted server data.
- POST allowlist: name, subtitle, scope, stack, progress, currentMilestone, repositoryUrl. Name/scope/stack required; omitted optional text defaults empty, progress zero. Propose a consistent serializer including the form's optional strings and numeric progress explicitly, then freeze that exact request for retries.
- PATCH allowlist: those editable fields, status and required revision. Unknown fields and explicit nulls are rejected. Omitted means unchanged; empty optional text means clear; zero remains meaningful. Use dirty fields, never spread the response/form wholesale. Do not write back a browser-number approximation of unchanged high-precision server progress during another edit. No arbitrary-precision dependency or exact-decimal round-trip promise.
- Mirror UTF-16 limits: trimmed nonblank name 100, stack 200; subtitle 4000 and memo 200 without blanket trimming; trimmed repository URL 2000, empty or absolute http/https with host. Backend validation remains authoritative. Map fieldErrors.currentMilestone to the memo control; display revision/idempotency errors at form level with safe requestId where available.

### Canonical server IDs and feature boundaries

Projects owns server Project lookup/selection. Its canonical contract is a validated Project/UUID plus explicit direct/paged lookup, not a complete workspace `projects[]`. Later features must use this server boundary or validated routes confirmed through detail, never `legacyProjectId`, name matching or fixture IDs such as forest/orbit/api/web.

Keep Project models/stores/API logic in `features/projects`, Overview DTOs/queries in `features/overview`, and their composition under pages/app. Inject the existing session's transport/lifecycle; features must not import app hooks and shared must not import domains. Overview owns its aggregate task DTO without importing the Task feature. App/pages pass the selected validated ID to Overview; no direct Project↔Overview feature dependency.

The [existing dependency decision](../decisions/feature-dependencies.md) names legacy Project modules as cross-feature contracts. Do not silently broaden its allowlist or reinterpret those contracts for existing local Task/Journal/Milestone consumers. Keep API-only modules consumed by pages/app for now; later features adopt server IDs through composition or a separately reviewed public-contract update. No runtime fixture import may be reachable through authenticated API models.

## Proposed screens and Project queries

### Authenticated composition

- `/me` continues to gate every business read/provider. Only the authenticated User/Workspace/current generation owns data or dispatches requests.
- `/projects` becomes the API list/editor. `/projects/:id` becomes direct server detail/editor with archive badge, audit metadata, memo and project counters. Reuse pure controls/presentation or focused API pages; do not mount the old detail page and its excluded providers for visual reuse.
- Root `/` may display a small global/scope Overview summary and link to Projects, without Dashboard/widgets/Home writes. Any global shell business counter comes from Overview. Do not restore local-store-dependent Sidebar/Topbar/WorkspaceProvider merely for layout.
- `/tasks`, `/journals`, `/library` stay integration-pending. Linked-feature sections on Project detail stay explicitly pending, with no fixtures, excluded CRUD or invented journal/milestone counts. Overview task counts are aggregate display only.
- Preserve auth screens, explicit login/logout, safe deep links and mobile/keyboard behavior. Ordinary authenticated Project navigation should preserve route/filter context without forced document reload; use focused app routing/pure helpers without the old Dashboard/provider dependencies.

### List and cursor pagination

1. URL scope stays all/unity/server; URL q maps to API query; archived=true selects status=archived, otherwise active. Propose active/archived tabs, not a new combined tab. Adapter support for status=all does not authorize loading all Projects silently.
2. Fixed 20-row page size with explicit **Load more**; send limit=20 on every page. No automatic crawl, unbounded prefetch, offset conversion or client-side replacement of search. Backend search is a case-insensitive literal substring of name **or** stack. Preserve the exact server query in cache keys, including spaces/punctuation; `%` and `_` are not client wildcards. Propose 250 ms debounce and cancellation/request sequencing on edits.
3. Query identity: session partition + scope/status/exact query/limit. Cursors bind workspace and all filters/limit; keep opaque cursors with their query and encode using URLSearchParams. Omit the initial cursor; never send empty string. Reset accumulated pages, cursor and pending work on any filter/limit/generation change.
4. Render server order createdAt DESC, id DESC. Append pages with UUID deduplication and revision-aware entity merging. Only nextCursor=null establishes the final page; neither loaded length nor total is a termination rule. List total means all matches for that list query, not Overview/global totals.
5. Single-flight per query/cursor; disable duplicate Load more. Later-page failure retains loaded rows and retries that cursor explicitly. Distinguish first load/error, refresh, empty dataset, empty search, loading more and partial-page failure. A refresh error is not a confirmed empty result.
6. INVALID_CURSOR offers explicit first-page restart with current filters and discards the invalid chain; no refresh loop or cursor transplant. Repeated cursor/malformed-page behavior is a protocol error. There is no cross-page snapshot guarantee: concurrent changes alter membership/totals; deduplication does not prove completeness. Refresh and mutation invalidation restart the chain.
7. Preserve scope/q/archived intent through list→detail→Back. Cursors stay out of URLs and browser storage. Return may refetch the first page with preserved filters; restoring every prior page/scroll offset is not promised.

### Direct and archived detail

- Always support direct GET by UUID independent of list membership. Absence beyond page one, under search/scope or from active lists does not imply missing Project. A cached page entity may be provisional display, but direct detail is verified before enabling editing.
- Malformed/noncanonical route IDs show invalid-address state without fixture lookup/ID guessing. Only current direct 404 establishes missing/inaccessible detail; do not distinguish another user's resource from absence.
- Archived Projects remain directly accessible/editable. Archive from detail keeps that same resource visible with updated badge; unarchive uses the same UUID. Leaving an active list cannot cause detail not-found. Back preserves prior list filters rather than silently selecting archived.
- Detail lookup ignores preserved list search/scope. Propose Overview `scope=all&projectId={id}` for entire selected-Project counters; preserve list filters only as navigation context. The adapter still supports/tests backend scope/project intersection: a mismatch means zero aggregates, not missing detail.
- Confirmed loss of detail access removes edit actions and selected counters, not the authenticated session. An Overview failure alone does not prove a loaded Project is missing; recheck direct detail before replacing it with not-found if necessary.

## Proposed mutation strategy

### Create and Idempotency-Key

- Creation requires explicit submit: validate, freeze the allowlisted JSON payload, capture confirmed identity/generation, then generate a cryptographically random operation key such as crypto.randomUUID(). This is an **idempotency key**, never a Project ID. Backend keys require 1–128 visible ASCII characters. Keep key, frozen payload, first-dispatch time and owning identity in one memory-only intent record.
- Disable duplicate submits/conflicting actions while pending. Use existing current CSRF and preserve the explicit Idempotency-Key header. No effect-based creation, implicit seed or generic automatic mutation retry.
- Within 24 hours the same key/body replays the original 201. Fingerprints ignore JSON property order but preserve supplied values and omission; trimming/default substitution or adding omitted fields can change the fingerprint. Retry the frozen request, not a newly normalized form. Corrected payloads after definitive validation rejection are new intents/keys.
- Network/timeout/5xx or malformed-success outcomes after possible dispatch are ambiguous. Retain the same key/body and offer **Retry this creation** within the replay window. Do not create another intent automatically. Freeze edits to the unresolved submitted intent; abandoning it must clearly state that the Project may already exist. Name/search matches cannot prove creation identity.
- IDEMPOTENCY_KEY_REUSED is distinct from REVISION_CONFLICT. Do not rotate a key and silently resubmit. Preserve the draft and explain that the recorded request/key cannot be reused for different data; reconciliation/abandonment precedes an explicitly new creation.
- After 24 hours, do not claim guaranteed deduplication or automatically retry an ambiguous intent. Require explicit reconciliation and a consciously new create action if needed. No persisted recovery across reload/logout/account change is proposed. Warn before ordinary unload/navigation with an unresolved dispatched creation; if memory is lost, explain that creation may have succeeded and require review, not an automatic new POST.
- A valid 201 supplies the only Project UUID and server metadata. Invalidate lists/Overview, navigate to that UUID and verify direct detail. A replay may return revision 1 even after later PATCHes: do not replace a newer known entity, assume the replay is current or increment counters locally.

### Update, archive and conflicts

- Capture loaded server revision and editable baseline. Submit dirty fields plus that revision. A no-change save is a UI no-op; backend revision-only and same-value PATCHes increment revision once, so they are not refresh/idempotency tools.
- Archive/unarchive is a confirmed PATCH `{revision,status:'archived'|'active'}`. It is not deletion and must not erase/mutate related resources. An archive click must not silently include unrelated unsaved edits: require save/discard first or keep archive unavailable until resolved.
- Await validated full 200 before success, closing the successful form, replacing canonical data or changing the archive badge. Per-Project pending state prevents concurrent edit/archive in one scope. Preserve drafts for validation, ordinary forbidden and network errors. Do not optimistic-increment revisions/audit timestamps/counters.
- On 409 REVISION_CONFLICT, retain baseline/draft, fetch current direct detail and show the concurrent change. Offer explicit reload/discard or reviewed reapplication of selected dirty fields against the fresh revision. No silent merge/overwrite or retry with revision+1. Repeated conflict repeats the visible workflow, not an automatic write loop. Reload 404 disables mutation; failed reload retains conflict/draft with read retry.
- An ambiguous PATCH/archive triggers direct reconciliation and read invalidation without automatic replay. Show latest confirmed Project plus unconfirmed-operation notice; equal field values alone do not prove that this request succeeded. The user can review and submit a fresh revision-checked intent. Reconciliation failure is not fabricated success.
- 401/ACCOUNT_DISABLED retire private state. For Project CSRF_INVALID, extend the app's bounded security recovery: one deduplicated `/me` plus fresh token confirms the same identity, then offers explicit retry, never POST/PATCH replay. Repeated failure is a token/Origin configuration error. Account change discards old intent; same-identity manual retry preserves the exact creation key/body. Keep logout behavior intact and never relax Origin checks.

## Proposed Overview integration

DTO: `{scope,projectId,projects:{total,archived,byScope:{unity:{total,archived},server:{total,archived}}},tasks:{todo,doing,done,total},asOf}`. projectId is nullable; both scope buckets/every task status are always present, including zero. Validate the complete shape and echoed filter. Keep asOf as a server observation timestamp, not a revision, global commit watermark or invalidation mechanism.

| Surface                    | Request                              | Meaning                                                                 |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| Global shell/root          | scope=all, no projectId              | Entire workspace active/archived Project and task-status counts         |
| Project list scope summary | Current scope, no projectId          | Entire scope, independent of list search, pages and active/archived tab |
| Project detail summary     | scope=all, selected server projectId | That owned Project, including archived, and its task aggregates         |

- Deduplicate global/list reads when scope=all; fetch only displayed summaries. No per-row Overview request or speculative fetch for every Project/scope combination.
- Send only scope and optional projectId, once each. Never forward query/status/projectStatus/deleted/limit/cursor; Overview rejects these. A combined scope/project filter is an intersection after ownership validation, not Project-precedence behavior.
- **projects.total counts active Projects only**; archived is separate. Per-scope buckets mean the same. Active/archived badges use the corresponding server fields. If displaying active+archived together, label that sum explicitly and derive it from Overview, not loaded arrays.
- Task counts cover non-deleted tasks in matching Projects with projectStatus=all, including archived Projects. Label this accurately beside either list tab; these are not counts restricted to visible rows. Archiving alone need not reduce task totals. No Task API/stats/local task array is used.
- Replace array-derived business counters in authenticated Project/shell surfaces. Array length can describe **loaded rows** only. Project-list total describes **search/filter matches**; Overview describes **business aggregates**. Never substitute one for another or require them to match.
- Show loading/unavailable/stale-refresh states instead of fake zero. Valid all-zero is a real empty snapshot. List/detail/Overview failures remain independent: usable Project data may remain visible when counters fail. Do not show an old scope's counts under a new scope label while its query loads.

## Session, cache and invalidation strategy

### Ownership and cancellation

- App owns the existing AuthSession and instantiates feature controllers only after `/me`. Partition data by User/Workspace; capture current generation **before** queueing or CSRF acquisition, and pass it through dispatch/publication. Never read a new generation after an await to legitimize old work.
- Combine route/query AbortControllers with lifecycle cancellation. Check generation, query identity, request sequence and invalidation epoch before publishing entities/counts/errors, closing a form or navigating. Include transports that ignore abort in tests; cancellation alone is insufficient.
- PLAN-0006 remounts private content on same-user revalidation too. Introduce an explicit app-owned draft handoff: revalidation hides private UI and aborts old work; a detached memory-only draft/immutable unresolved-create record can remain bound to its prior identity. Restore it only after `/me` confirms the identical User/Workspace. No queued dispatch is restored; a new explicit action creates a current-generation attempt. Old responses cannot settle that attempt.
- Explicit login/logout, session loss, disabled account or changed identity destroys handoff, keys, drafts, errors and caches. Verification error never exposes suspended content or enables mutation; offer session retry. Dirty-navigation confirmation cannot prevent auth teardown. Clear ordinary editor guards and retain pagehide/pageshow/focus semantics.
- Deduplicate overlapping bootstrap/security recovery; one operation's recovery cannot silently retry another. Keep existing payload-free cross-tab auth hints and `/me` verification, with no localStorage event bus or cookie-name assumption.

### Cache contents and invalidation

Use a small memory-only feature cache, not a generic query framework or offline store:

- Entities keyed by server UUID within the current partition, retained for active list/detail/workflows. Merge validated full responses by revision so older reads/replays cannot overwrite newer known entities.
- List query keys are scope/status/exact query/limit; entries hold ordered page IDs, total/cursor, read epoch and request state. Keep the current chain and release inactive pages as appropriate. Cache miss/eviction never means missing Project.
- Detail has independent per-UUID query state. Overview keys are scope + nullable Project ID, never search/cursor. Store asOf as display metadata only. Deduplicate identical reads, not different filters under one global promise.
- Confirmed create/update/archive/unarchive retires pre-mutation read work/advances invalidation epochs, then adopts the validated response without replacing a higher known revision. Invalidate **all cached Project lists and Overview filters in the partition**, including old/new scope/status membership and selected counters. This bounded first implementation favors correctness over guessing aggregate effects.
- Reset invalidated list cursors and refresh the visible first page, active detail as needed and visible Overview. Mark inactive entries stale rather than eagerly fetching every combination. Archived detail stays accessible. Creation/replay always verifies returned UUID detail.
- Also invalidate/reconcile on conflict and ambiguous mutations. A GET started before a mutation cannot restore old list membership/counters afterward merely because session generation stayed the same: use separate read/mutation epochs. Project/Overview responses are not a shared atomic snapshot; show refresh state and allow independent settlement.
- Confirmed mutation followed by refresh failure stays a confirmed save with read-refresh error, not a failed save inviting duplicate creation. Preserve its confirmed Project and explicit stale/unavailable counters with read retry.
- Manual refresh and resumption recover out-of-band writes. No live business subscription, polling or instantaneous cross-tab Project-consistency promise. Stale writes remain protected by server revisions. Rebuild read caches when session revalidation establishes a new generation.

## Legacy localStorage treatment

Preserve `devspace.projects.v1` and the other five legacy business keys byte-for-byte, including malformed values/custom IDs. No startup read, fallback, import, migration, clear, delete, owner assignment, UUID conversion or upload. Authenticated empty/error states never mount legacy providers. Fixture IDs and server UUIDs never share a cache, selector or entity union.

Keep existing providers/models/editors and their regressions in the isolated legacy harness. Even a UUID-shaped local record is not trusted as an owned server Project. An old `/projects/forest` link is an invalid/unsupported server address, not an automatic lookup/import. A future local migration requires a separate approved Plan.

## Validation

### Static

Proposal creation initially validated only Plan/index formatting, links and scope. The user subsequently approved all runtime sessions; their evidence is recorded below.

After approval: TypeScript/build, source boundaries, Markdown links, affected-file formatting, existing/new unit tests and production artifact isolation must pass. Separately record unrelated pre-existing formatting failures without broad refactoring. Adapt PLAN-0006's artifact checks to permit API Project/Overview modules while continuing to exclude fixture models, local authority and test login/provider code.

### Runtime

Required after approval, with two distinct boundaries:

1. Deterministic frontend tests intercept only existing auth, Project and Overview operations. Fail on Task (including stats), Journal, Milestone, Link, Dashboard or monitoring requests. Update auth readiness expectations for the new screens without removing auth/storage/security assertions. Retain the independent legacy CRUD suite.
2. Real local acceptance reuses `tests/real/` OIDC, unchanged backend `bootTestRun`, disposable PostgreSQL, Vite and built Nginx. Extend/add a Project/Overview runner without replacing the auth smoke. Verify actual session/CSRF/Origin/ownership and generated contracts; no backend fixture endpoint, test-support or source change.

Required cases:

- DTO/model mapping, UUID/audit ownership, memo/Milestone separation, optional omission/empty/zero/null, field errors, decimal edits and omission of unchanged high-precision progress.
- More than 20 Projects, equal-createdAt ordering, pagination/deduplication, special-character search, rapid filter changes, last-page null cursor, invalid/stale cursors, first/later-page errors and explicit refresh. Direct detail beyond page one or outside search/active list succeeds.
- Active/archived tabs, archive while viewing detail, unarchive, archived edits, Back filters, malformed/fixture IDs, genuinely missing and another user's UUID. Only owned direct-detail results determine not-found.
- Delayed/duplicate submits, dropped response after committed POST followed by same-key/body replay producing one Project; changed-body key reuse; replay after later edit; 24-hour guard; unresolved navigation and no automatic mutation replay. A real test may drop/delay delivery of an actual backend response but must still assert database counts, not substitute mocked creation.
- Two-client REVISION_CONFLICT, failed reload, reviewed reapply, repeated conflict, ambiguous PATCH/archive, server audit/revision values and confirmed-save/failed-refresh distinction.
- Global/scope/project Overview, active versus archived semantics, scope/project intersection, nonzero/all-zero status buckets, malformed/errors, totals beyond the first page and independent of search, archived selected Project, no unsupported parameters or N+1 queries.
- Current 401/disabled cleanup, bounded CSRF recovery, same-identity draft/key handoff only after verification, A→B cleanup, late A success/error/401/403, overlapping security recovery, route/query races and pre-mutation reads after a mutation in the same auth generation. Ignored-abort transports cannot publish stale data/errors or navigate.
- All six legacy keys plus unrelated sentinels (valid/malformed) remain unchanged through bootstrap, mutations, errors, logout and account switch; separately throw on storage reads/writes. No fixture ID reaches authenticated selectors/URLs/requests or production output.
- Real fixtures may explicitly SQL-seed isolated task rows to prove Overview semantics, including archived Projects and soft-deleted exclusions, using the existing disposable database capability. This is test setup, not Task API integration. Record row baselines and assert the frontend writes no Task/Journal/Milestone/Link/Home data. Memo edits create no Milestones. Only Project mutations and expected idempotency/workspace bookkeeping are driven by the frontend.
- Mobile layout, keyboard/focus, accessible loading/errors, pending forms, ordinary dirty-navigation protection versus forced auth cleanup, direct links, reload/back/forward and no horizontal overflow. Capture and inspect safe screenshots through built Nginx.

## Execution Policy: Recover Within the Approved Contract

Use the same self-recovery policy as PLAN-0006. After explicit approval, change to `active` and execute sessions in order. Do not execute any session while `proposed`.

- Diagnose, fix and revalidate recoverable implementation, TypeScript/build, fixture/server-readiness, fetch/proxy/cookie, OpenAPI assertion, concurrency/session-race and browser-harness failures within this Plan, then continue without requesting approval again for the same scope. This includes recoverable pagination, DTO, idempotency, conflict and Overview invalidation failures.
- Preserve useful failure evidence and root cause. Use controlled races/final-state assertions; a lucky rerun is not a fix. Repeat affected validation after correction and complete the final suite.
- Do not weaken assertions, skip required tests, use untyped bypasses, relax CSRF/Origin/cookie/ownership, enable production fixtures, import/delete local data, change backend contracts or integrate excluded APIs to get a pass.
- Stop only for a genuine decision-level blocker: contradictory approved requirements; necessary unapproved dependency/architecture/backend contract or security changes; data-loss/identity-isolation risk unresolvable within scope; unavailable external prerequisites after reasonable authorized recovery; or a root cause not reliably resolvable within this design.
- Missing production domain/Google credentials does not block required local-provider acceptance. Diagnose/recover local prerequisites with authorized tools first; do not substitute mocks for required real backend/proxy checks.
- If blocked, keep `active`, leave unfinished checks unchecked and record reproduction, diagnosis, attempted recovery, affected validation and the exact needed decision/prerequisite. Do not update shared guides/completed Plans to introduce this policy.
- Normal environment permissions still apply to outside-workspace writes, process launches and downloads; Plan approval is not a sandbox bypass. Ask only for an actual tool permission or genuine decision blocker.

## Execution Sessions

Execute all six sessions in order **after approval**. Complete each session's implementation and validation before the next begins. Execution began on 2026-09-13; checked items below record completed work.

### Session 1: Contracts, isolated models and composition

- [x] Recheck instructions, working-tree baselines, generated contracts and test runners. Activate only on explicit approval and update the frontend index; preserve unrelated changes/backlog statuses.
- [x] Define validated Project/Overview DTOs, canonical UUIDs, presentation/draft adapters and injected transport/lifecycle interfaces. Keep legacy contracts separate; no new cross-feature exception.
- [x] Establish private composition and app-owned same-identity draft-handoff/security-recovery interfaces without excluded providers. Preserve auth states and legacy entry.
- [x] Pass model/serialization tests, boundaries/build, auth/legacy smoke, storage non-use and artifact isolation. No business reads before `/me`, and no effect-triggered mutations.

Session 1 evidence (2026-09-13): 95 unit tests, build, artifact isolation and source boundaries passed; auth 20/20 and legacy 35/35 browser cases passed. Recovered the misplaced cross-feature test by moving it into Overview. Sandbox build-info and Playwright cleanup restrictions resolved with approved elevated commands.

### Session 2: Project list, pagination and direct detail

- [x] Implement scope/query/active-archived URL mapping, debounce, 20-row Load more, direct UUID detail and distinct loading/error/empty/refresh states.
- [x] Implement query/session cancellation, sequencing and cursor ownership; archived/beyond-first-page detail remains accessible and Back preserves filters.
- [x] Pass controlled page/query races, invalid cursors, first/later-page failures, malformed DTOs, fixture-ID isolation and direct missing/inaccessible-detail tests.
- [x] Pass real Vite/backend Project read acceptance with more than one page and archived fixtures. Use explicit isolated setup; verify ownership, no excluded requests and unchanged sentinels.

Session 2 evidence: 97 unit tests, 4 Project browser cases, build/boundaries/artifact checks and real Vite/backend read acceptance passed. Disposable setup created 23 Projects; 22 active rows traversed two pages, archived direct detail remained accessible, no excluded resource rows were created. Recovered test-only about:blank storage access by restricting sentinel initialization to the application origin.

### Session 3: Create/update/archive and recovery

- [x] Implement async drafts, dirty-field PATCHes, pending controls, field errors, archive/unarchive and server UUID/revision/audit adoption.
- [x] Implement frozen create intents/key lifecycle, explicit replay retries, replay/detail reconciliation, ambiguity and expiry guards. Implement visible conflict reload/review/reapply without automatic overwrite.
- [x] Wire Project read invalidation and bounded app-composed CSRF recovery/draft handoff; account changes/auth teardown cancel work and discard old intents.
- [x] Pass unit/browser races and real Vite/backend mutation acceptance: one row after dropped-response replay, key-reuse conflict, two-client revision conflict, archived detail continuity, 401/403 and ambiguous PATCH. Only expected Project/bookkeeping writes; no memo-generated Milestones.

Session 3 evidence: build, 98 unit tests, boundaries and 8 deterministic Project browser cases passed. Real Vite/backend acceptance verified exactly one row after committed-response loss/replay, changed-body key reuse 409, two-client revision conflict, original revision-1 replay after revision-3 edit, archive continuity and zero Milestone rows. Confirmed-save/failed-refresh handling and ambiguous PATCH reconciliation have controlled browser coverage.

### Session 4: Overview and server counters

- [x] Implement complete Overview DTOs/queries/cache states and root/global, list-scope and selected-Project counters. Replace authenticated array-derived counters and label archived-task inclusion accurately.
- [x] Deduplicate displayed filters, exclude unsupported parameters/per-row fan-out and invalidate Overview after Project mutations without optimistic arithmetic.
- [x] Pass independent list/aggregate errors, zero states, search/page independence, active/archived counts, scope changes and selected archived/intersection scenarios.
- [x] Pass real Vite/backend Overview checks beyond one Project page and with explicit SQL-seeded task counters. Preserve fixture resource rows; no excluded API requests or Home creation.

Session 4 evidence: build, 99 unit tests, boundaries and 10 Project/Overview browser cases passed. Real Vite/backend acceptance proved 22 active / 2 archived counters independent of empty search, task counts from active and archived Projects, archived selected detail and zero scope/project intersection; unsupported Overview query returned 400. Two test-only SQL task rows were preserved during UI operations and explicitly cleaned up.

### Session 5: Integrated session/cache/browser races

- [x] Complete entity revision protection, query/mutation epochs, pending navigation, resumption and identity-bound draft handoff. Separate confirmed save from failed refresh.
- [x] Pass stale pre-mutation reads, out-of-order list/detail/Overview, overlapping recovery, ignored cancellation, two-tab conflicts and late A after B. Same-identity handoff requires a new explicit attempt.
- [x] Run complete deterministic Project/Overview, updated auth and retained legacy browser suites. Verify mobile/keyboard/focus, deep links, pending controls, safe discard/teardown and storage sentinels through all transitions.
- [x] No array-completeness, fixture-ID/local counter assumption or excluded provider remains reachable in authenticated composition.

Session 5 evidence: 99 unit tests, 16 Project/Overview browser tests, updated auth 20/20 and retained legacy 35/35 passed. Controlled tests cover same-identity bootstrap-error handoff, changed identities, late success/401/403, current 401, CSRF retry bounds, stale pre-mutation reads, duplicate submissions, ambiguous PATCH and dirty Back/Forward/mobile keyboard behavior. Reviewed the real mobile detail screenshot; counters and controls fit without horizontal overflow.

### Session 6: Final proxy regression, documentation and evidence

- [x] Update frontend root development documentation/architecture for actual Project/Overview behavior, pagination/aggregate semantics, legacy preservation and deferred features. Do not update implementation guides or completed Plans without separate authorization.
- [x] Pass `npm run check:boundaries`, `npm run check:docs`, `npm test`, `npm run build`, updated artifact checks and affected-file formatting; distinguish pre-existing unrelated failures.
- [x] Run final applicable Playwright suites and real Project/Overview/auth acceptance through Vite and a fresh Nginx image using unchanged backend/local OIDC/PostgreSQL. Inspect screenshots/configuration; no live deployment.
- [x] Run unchanged backend Java 21 `./gradlew.bat clean build --no-daemon` with PostgreSQL Testcontainers, including Project/Overview/OpenAPI/security/documentation-policy regressions. Compare generated consumer contracts and verify backend source unchanged.
- [x] Record commands/counts, revisions/diffs, recovery evidence, permitted request/row assertions, storage checks, safe artifacts and owned-process cleanup. Do not record session cookies, CSRF/OIDC credentials, private payloads or creation keys in artifacts.
- [x] Only after every required check passes, mark this Plan completed and update its existing frontend index row. Genuine blockers retain active status with the exact prerequisite/decision and unchecked work.

## Completion Criteria

- [x] All sessions completed in order after explicit approval; no Plan-caused failure remains.
- [x] Project list/detail/create/edit/archive/unarchive use backend authority exclusively; UUIDs, revisions and audit metadata remain server-owned.
- [x] Memo/status/color adapters and explicit write allowlists match the contract; no fixture IDs or writable server metadata enter requests.
- [x] Direct detail resolves beyond page one and for archived selections; list absence never proves missing detail.
- [x] Cursor-bound pagination/search/filter races work without a full-array or cross-page-snapshot assumption.
- [x] Idempotency, revision conflicts, ambiguity and CSRF recovery require safe explicit intents without duplicate automatic writes.
- [x] Overview counters match global/scope/project semantics and replace authenticated array-derived totals independently of pages/search.
- [x] Session partitions, draft handoff, cancellation, read epochs and invalidation prevent stale/other-account data, errors or intents from publishing.
- [x] Legacy localStorage is unchanged/unused; no automatic import/deletion or excluded API/provider integration.
- [x] Required static, frontend/browser/legacy/auth, real Vite/Nginx/backend and artifact/security validations pass with recorded evidence.
- [x] Frontend documentation/index reflect implementation/status; backend source and unrelated Plans remain unchanged.

## Clarifications and unresolved decisions

No blocking product/backend-contract decision was identified. The user explicitly approved these choices: separate API/legacy models; 20-row Load more and 250 ms debounce; active/archived tabs; full selected-Project counters using scope=all; a small root Overview summary without Dashboard; conservative partition-wide Project/Overview invalidation; memory-only same-identity draft handoff; explicit conflict/retry workflows; and no new runtime dependency.

Deliberate limits: Overview contains Project/task aggregates, not Journal/Milestone/Link counts, and includes tasks of archived Projects. Creation deduplication depends on the backend's 24-hour replay window and the in-memory intent lifetime, with no automatic persisted recovery. Cursor pages and separate endpoints do not form one atomic traversal/shared snapshot. Out-of-band business changes become current through refresh/resumption and revision-checked writes, not live synchronization.

If implementation requires backend/security changes, a new dependency, changed cross-feature ownership rules or a different identity/intent preservation policy, report the concrete decision-level blocker before expanding scope. None of these possibilities authorizes execution during proposal creation.

## Proposal and approval history

Initially only this document and its proposed index row were authorized. The user explicitly approved activation, the integration contract, every approval candidate and sequential execution on 2026-09-13.

Proposal-only validation on 2026-09-13: Prettier formatting passed for this Plan and the index; `npm run check:docs` passed with links resolved across 27 Markdown documents. Runtime validation was deferred at proposal creation, then executed after approval.

## Final execution and validation evidence

Completed 2026-09-13. All six sessions executed under the approved contract; no decision-level blocker or unfinished recovery remains. Root development documentation, frontend/system architecture and the existing Plan index now describe the implemented boundary. PLAN-0003 remains proposed and PLAN-0006 remains completed. Existing unrelated working-tree changes were preserved; no commit or deployment was requested or performed.

| Validation                  | Final result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend unit tests         | `npm test`: 99 tests in 16 files passed. Includes Project/Overview DTOs, dirty-field serialization, memo/status/color mappings, immutable creation/replay expiry, cursor deduplication, revision adoption, retired-generation and pre-mutation read protection, and existing auth/HTTP/legacy models.                                                                                                                                                                                                                                                            |
| Project/Overview browser    | `npx playwright test --config playwright.projects.config.ts`: 21 passed. Covers cursor pages, literal search races, archived/direct/missing detail, malformed/first/later-page errors, key/body replay, validation/key reuse, CSRF recovery, repeated/two-tab conflicts, failed reconciliation, ambiguous PATCH, confirmed-save/failed-refresh, independent counters, account races, storage non-use, mobile/keyboard and draft navigation.                                                                                                                      |
| Auth browser regression     | `npx playwright test --config playwright.auth.config.ts`: 20 passed. Preserved security/storage assertions; Project and Overview reads are intercepted explicitly in the deterministic harness.                                                                                                                                                                                                                                                                                                                                                                  |
| Legacy browser regression   | `npm run test:e2e`: 35 passed through the isolated legacy entry. No legacy provider, fixture model or persistence implementation was changed. Total deterministic browser cases: 76.                                                                                                                                                                                                                                                                                                                                                                             |
| Build and static checks     | `npm run build`, `npm run check:boundaries` (104 files, 302 local imports), `npm run check:docs` (27 Markdown documents), affected-file Prettier checks and `git diff --check` passed.                                                                                                                                                                                                                                                                                                                                                                           |
| Production isolation        | `node tools/check-auth-artifact.mjs` passed for the three-file production output. Existing checks already permit API-only feature modules while rejecting legacy storage/fixture/provider and server-only configuration markers. No new exception was needed. Final local and Nginx builds both produced `index-C3HXQeDj.js` and `index-B6SdZ50g.css`.                                                                                                                                                                                                           |
| Real Vite acceptance        | `node tests/real/run.mjs --projects=final` passed with the unchanged backend, disposable PostgreSQL and local OIDC provider, including the retained auth smoke.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Real Nginx acceptance       | `node tests/real/run.mjs --projects=final --nginx` passed using a fresh image. Rendered `nginx -T` passed. Desktop Overview and mobile archived-detail screenshots were inspected; controls/counters fit without horizontal overflow.                                                                                                                                                                                                                                                                                                                            |
| Real Project evidence       | Setup created 23 Projects; 22 active Projects traversed 20+2 rows. Selected archived detail worked outside active/search results. Foreign Project detail and Overview returned 404. A committed POST response was deliberately dropped; exact key/body retry left one row. Changed-body reuse returned 409. A second client forced revision conflict; reviewed reapplication retained its subtitle. Creation replay returned original revision 1 while current detail remained revision 3; archive advanced to revision 4. Memo editing created zero Milestones. |
| Real Overview evidence      | After creation/archive: 22 active and 2 archived Projects, independent of empty search and loaded pages. Three explicitly SQL-seeded task rows included one soft-deleted row; total was 2, with active and archived Project tasks included. Archived selected detail reported 0 active / 1 archived / 1 task. Mismatched scope/Project intersection returned zero; unsupported Overview parameters returned 400. No excluded resource API or Home creation occurred. Fixture rows were explicitly cleaned up in the disposable database after assertions.        |
| Generated contracts         | Vite and Nginx generated Project/Overview path/schema snapshots matched exactly. Expected Project GET/PATCH 200, POST 201 and Overview GET 200 operations were asserted; runtime DTOs validated full responses.                                                                                                                                                                                                                                                                                                                                                  |
| Backend regression          | Java 21.0.12.1, process-only `APP_ORIGIN=http://localhost:8080`, `./gradlew.bat clean build --no-daemon`: BUILD SUCCESSFUL in 3m6s. 183 tests across 36 suites; 0 failures, errors or skips. Includes Project/Overview/OpenAPI/security and production documentation-policy regressions.                                                                                                                                                                                                                                                                         |
| Backend/source preservation | Frontend HEAD remained `75e679358e482c64f5e79ac7699948029ae3d6d2`; backend baseline remained `cdd4bf01aaa3ff7e7a68802e74a88a93b1938379` with pre-existing changes. SHA-256 comparison of all 299 backend source files before/after final regression and real runners showed no change. Backend configuration files were not edited.                                                                                                                                                                                                                              |
| Storage/environment/cleanup | Authenticated tests throw on storage reads/writes/removal and verify all six legacy keys plus an unrelated sentinel unchanged. No automatic import/delete occurred. No new frontend environment variable or dependency was introduced; root `.env` and `.env.example` required no changes. Owned validation ports 18080, 18999, 4175, 4177, 4176 and 4178 were released.                                                                                                                                                                                         |

Safe local evidence is retained under ignored `.auth-validation/`: `backend-result.json`, `backend-recovery.json`, `backend-source-before.json`, `cleanup.json`, and each of `vite/` and `nginx/` containing `result.json`, `projects-result.json`, `project-overview-contract.json`, `project-overview.png` and `project-mutations-mobile.png`. The Nginx directory also contains rendered configuration. These evidence summaries do not contain CSRF tokens, cookies, creation keys or provider credentials.

Recoveries were diagnosed and revalidated rather than accepted on a lucky rerun:

- A misplaced cross-feature test was moved into Overview; no dependency rule was weakened.
- Windows sandbox restrictions on the existing TypeScript build-info file and Playwright process cleanup were resolved with approved elevated commands.
- Test storage initialization was restricted to the application origin after `about:blank` denied storage access. The filter control test now uses its accessible combobox role.
- Confirmed mutation responses now seed direct-detail state before refresh; failed refresh cannot erase a confirmed save or invite duplicate creation. Controlled browser coverage passes.
- Confirmed filter navigation remounts the page/editor after discarding its detached draft. The dedicated filter-discard regression and Back/Forward tests pass.
- Initial backend clean build had one 403 versus expected 204 in `SecurityIntegrationTests.csrfProtectsAuthenticatedLogoutAndNoSessionLogoutIsIdempotent`. The development `.env` configured `APP_ORIGIN=http://127.0.0.1:5173`, while the existing test sends `http://localhost:8080`. A process-only override aligned the existing test environment; the complete clean build then passed without source/configuration edits or relaxed security assertions.

Approved limits remain: memory-only creation recovery with a 24-hour backend replay window; no atomic multi-page/shared-endpoint snapshot; explicit refresh/resumption for external changes; manual decimal progress; and Task, Journal, Milestone, Link and Dashboard APIs deferred.
