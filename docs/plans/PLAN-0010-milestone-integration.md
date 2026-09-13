# PLAN-0010: Milestone Integration

## Status

`completed` — explicitly approved and executed on 2026-09-13, including all candidates and the read-only unity/open/default-two Home behavior. All six sessions and required validation passed. No backend source or configuration was changed.

## Goal

Replace authenticated Milestone localStorage/fixture authority with the implemented backend API while preserving existing rows/cards, editor, Korean labels, completion interactions, navigation, responsive layout, accessibility, and successful flows wherever compatible. Adapt existing presentation boundaries rather than redesigning the screen.

## Scope

- In scope:
  - Validated Milestone list/direct-detail reads, server filters and cursor pagination.
  - Awaited creation, editing, completion/reopening, permanent deletion, revision review, creation idempotency, pending/error states, and draft preservation.
  - Canonical Project relations, including owned archived Projects, and read-only derived Project presentation.
  - API-backed Project-detail management and a bounded read-only authenticated Home composition.
  - Session/cancellation protection, cache invalidation, frontend tests, visual parity, and real Vite/Nginx/backend validation.
  - Final frontend documentation and Plan-index updates after approved execution.
- Out of scope:
  - Backend source/configuration/schema/security or contract changes; new runtime dependencies.
  - Link or Dashboard API integration, saved Dashboard layout authority, or a new standalone Milestone route/navigation redesign.
  - Persisted Milestone status/progress, trash, restore, archive, or soft deletion.
  - Importing, converting, migrating, deleting, or using legacy Milestone data as authenticated authority.

## Current baseline and contract evidence

This Plan follows `PLAN-TEMPLATE-RUNTIME.md`; its approved execution is complete. Governing documentation instructions are `AGENTS.md`, `docs/AGENTS.md`, and `docs/plans/PLANS.md`. Completed PLAN-0006 through PLAN-0009 supply reusable Auth, HTTP, Project, Overview, Task, and Journal patterns, not Milestone business restrictions.

### Frontend inspected

- `src/features/milestones/model.ts` has local `id`, `projectId`, `title`, `dueDate: string`, and `completed`. Empty date is `''`; its validator currently constructs a noon UTC `Date`. API mode must replace that date-validation boundary without converting legacy values.
- `src/features/milestones/MilestonesProvider.tsx` reads `devspace.milestones.v1`, derives initial records from local Project milestone text, and exposes synchronous `upsert`. It has no deletion operation.
- `src/features/milestones/MilestoneList.tsx` renders the Flag row, Project name, editable title, Korean completion/date/overdue text, add action, and `open|done|all` selector (default `open`). Completing/reopening a row that leaves the current filter restores focus to the status selector. Local sorting is completion first, date ascending with empty dates last, then ID.
- `src/features/milestones/MilestoneEditor.tsx` contains title (200-character limit), Project, optional date, and completion controls; it uses the shared Modal and unsaved-change guard. There is currently **no Milestone delete button or confirmation**. Permanent deletion therefore requires a small explicit addition using the existing shared destructive-confirmation pattern, not preservation of a nonexistent control.
- `src/pages/ProjectDetailPage.tsx` supplies the selected Project ID to the full Milestone list inside the `프로젝트 마일스톤` section, with `마일스톤` heading and `목표와 기한을 관리하세요.` description; no display limit is supplied.
- `src/pages/home/widgetRenderers.tsx` supplies widget scope/Project and `widget.limit ?? 2`; `src/features/dashboard/model.ts` defaults this widget to `unity`, title `다가오는 마일스톤`, size `small`, and supports explicit limits 1–20. The legacy Home list is interactive. Its conversion to a read-only authenticated surface is an explicit proposal exception below, while legacy behavior remains isolated.
- `src/app/auth/PrivateWorkspace.tsx` currently composes API Overview, Task, and Journal Home surfaces and Project detail slots, with no authenticated Milestone provider. Reuse app-owned composition/invalidation rather than importing another feature's store into Milestone feature code.

### Live and source verification (2026-09-13)

The running `http://127.0.0.1:8080/v3/api-docs` was fetched successfully and its Milestone operations, parameters, response schemas, and request schemas inspected. Its Swagger UI is at `http://127.0.0.1:8080/swagger-ui/index.html`. Runtime-generated documentation agrees with current source for the following contract.

Source references are in the sibling backend checkout, relative to the frontend root: `../backend/src/main/java/com/kopite/devspace/milestone/` (presentation controller/DTOs, command/query services, domain values, request hash, search adapter, and signed cursor codec). `../backend/src/test/java/com/kopite/devspace/MilestoneApiTests.java` and `MilestoneCommandTests.java` corroborate strict payloads, archived ownership, replay, date clearing, and permanent deletion. During proposal creation, source/tests were read only. Approved execution subsequently validated the authenticated behavior and unchanged backend regression as recorded below.

| Operation                                   | Confirmed contract                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/milestones`                    | scope: all/unity/server (default all); optional UUID projectId; projectStatus: all/active/archived (default all); status: open/done/all (default open); limit: 1–100 (default 20); optional cursor. Returns 200 `{items,total,nextCursor}` with nullable nextCursor.                       |
| List ordering                               | Fixed `completed ASC, dueDate ASC NULLS LAST, id ASC`. Overdue and undated records are included. No supported search, date-range, newest/oldest, custom sort, offset, or page-number parameter.                                                                                            |
| Cursor                                      | Signed and bound to workspace, scope, Project UUID, Project status, Milestone status, limit, and fixed ordering. Each page has matching total; no cross-page snapshot guarantee. Invalid/cross-query cursor yields `INVALID_CURSOR`.                                                       |
| `GET /api/v1/milestones/{id}`               | 200 full owned resource, independently of any list query/page. Missing/inaccessible resources yield `RESOURCE_NOT_FOUND`; scoped lists also validate Project ownership.                                                                                                                    |
| `POST /api/v1/milestones`                   | Requires CSRF and `Idempotency-Key` (1–128 visible ASCII characters). Required body: `title`, UUID `projectId`. Optional `dueDate` defaults null and optional `completed` defaults false. Explicit null is allowed only for `dueDate`. Returns 201 full resource/original replay snapshot. |
| `PATCH /api/v1/milestones/{id}`             | Requires CSRF and body `revision`; only writable fields are `title`, `projectId`, `dueDate`, `completed`. Omission preserves; `dueDate:null` clears. Same-value and revision-only updates advance revision. Returns 200 full resource.                                                     |
| `DELETE /api/v1/milestones/{id}?revision=N` | Requires CSRF and current revision as a query parameter, no JSON body. Returns **200 `{deletedId}`**, not 204 or a resource. Permanently deletes; subsequent reads/mutations return 404.                                                                                                   |
| Ownership/archive                           | Current and target Project must be owned; **active and archived Projects are valid for creation, editing, reassignment, and deletion**. No Task/Journal active-only restriction applies.                                                                                                   |
| Errors/security                             | Validation 400, `REVISION_CONFLICT`/`IDEMPOTENCY_KEY_REUSED` 409, `RESOURCE_NOT_FOUND` 404, Auth 401, disabled-account/CSRF 403, and server/network failures. Session cookie and existing shared CSRF/Origin policy apply; responses use `Cache-Control: no-store`.                        |

Requests reject unknown/duplicate fields and type coercion. Title is trimmed/nonblank with a maximum of 200 UTF-16 code units. Dates are real calendar dates in years 0001–9999. Revisions are integers 1–9007199254740991.

Creation replay is workspace-scoped for 24 hours and returns the original snapshot even after resource deletion or Project archival, subject to ownership checks. Source fingerprinting distinguishes raw title differences, omitted versus explicit-null `dueDate`, and omitted versus explicit-false `completed`; equivalent resulting resources do not imply equivalent creation requests. A reused key with different input yields `IDEMPOTENCY_KEY_REUSED`. After expiry, replay protection cannot be assumed.

## Changes

### 1. Explicit DTO, draft, and presentation boundaries

- Add a feature-owned validated `ApiMilestone` with exactly server `id`, `revision`, `createdAt`, `updatedAt`, `title`, `projectId`, `projectName`, `scope`, `dueDate: string | null`, and `completed: boolean`. Validate UUIDs, safe revision, audit timestamps, title, enums, real date-only values, list total/cursor, duplicate IDs, and response shape before publishing.
- Keep an editable draft containing only title, canonical Project ID, date-input text, and completed. Keep captured baseline/revision, mutation intent, and reconciliation metadata outside that draft. Never create a local resource UUID or fabricate revision/audit/Project display fields from fixtures.
- Map date input `''` to API null; map API null to blank input and `기한 없음`. PATCH must distinguish untouched omission from deliberate clearing. Validate leap years/month lengths as calendar arithmetic; do not use timezone conversion, parsing through `Date`, UTC/noon construction, or timestamp substitution. Today's local calendar components may be used solely for the existing overdue indicator; dueDate itself never becomes an instant.
- Derive `진행 중`/`완료` and optional transient selector values from `completed`. `status` belongs only to list query state; it is never sent in POST/PATCH or persisted as a resource field. Do not invent percent progress.
- Present `projectName` and `scope` from validated server responses as read-only fields, not a name-to-ID lookup. Audit timestamps remain server-owned metadata, never editor fields or due-date defaults. Reject malformed/mismatched success payloads into an explicit reconciliation state rather than a false success.

### 2. Preserve the existing UI through API-facing controllers

- Adapt/extract the existing list/editor presentation with injected API controller and Project-option contracts. Preserve `.milestones`, `.milestone`, `.milestone-form` structure/styles, Flag icon, content wrapping, Korean labels, optional native date input, title/Project/completion controls, modal sizing, and responsive flow.
- Preserve editor autofocus, labels, keyboard activation, focus trap/return, Escape/backdrop behavior, unsaved close/navigation guards, touch targets, scroll, and completion-to-filter focus recovery. Wait for confirmed completion before removing a row from an open/done view or moving focus.
- Await save, completion/reopen, and delete. Use per-resource pending protection and disabled affected actions to prevent double submissions. Keep draft, target, baseline, and user intent on validation/network/conflict/malformed-response/reconciliation failure. Preserve successful close behavior only after validated confirmation; a failed subsequent refresh is separate from a failed mutation.
- Add compact loading/error/retry/refresh/pagination states within existing containers. Confirmed rows remain visible with an explicit stale/error indicator when refresh or later-page loading fails; initial loading/error/unavailable must not render a genuine empty result.
- Add `영구 삭제` to the existing-record editor and reuse the shared confirmation modal pattern, naming the target and permanent consequence. Retain target/draft on cancellation/failure and return focus predictably after success. No trash/restore/archive UI or requests.

### 3. Reads, filters, cursor chains, and direct detail

- Use feature-owned stores on the existing authenticated transport/Query foundation. Normalize query keys from session identity plus scope, optional Project UUID, projectStatus, status, and limit. Default full management to server page size 20, status open, and projectStatus all; preserve the existing Korean status control and supplied scope/Project boundaries.
- Expose confirmed scope/projectStatus filters through controller contracts without adding unnecessary screen controls. Do not implement unsupported search/date/order controls or locally filter/sort a partial page as if it were the complete backend result.
- Load first page and `더 보기` with opaque nextCursor; reset the entire cursor chain on any bound-filter/limit change, invalidation, or explicit refresh. Preserve exact parameters for next-page retry; serialize duplicate Load-more requests. Use server ordering/totals, deduplicate overlapping IDs safely, and never infer a consistent snapshot across concurrent external changes. Do not let lower-revision page records overwrite newer confirmed entity state; refreshed lists are still required for membership/order/derived Project fields.
- Maintain direct-detail state keyed by UUID independently of lists. Opening/editing/reconciling a known Milestone uses `GET /milestones/{id}` even when it is filtered out, beyond loaded pages, or no cursor remains. Cached data may preview but cannot prove current availability. Only a direct authoritative 404 establishes missing/inaccessible detail; a scoped-list error is not proof of Milestone deletion.
- Retain loaded confirmed rows after a later-page error and expose retry for that page. `INVALID_CURSOR` offers a chain restart while distinguishing old displayed data from a fresh result. Empty means a successful matching result with no rows, not loading/error/absence of a Project option.

### 4. Mutation intents, conflicts, and reconciliation

- POST serializes only `{title,projectId,dueDate,completed}` with explicit null/boolean from the editor. Validate locally against the contract, then freeze that serialized body and a random valid Idempotency-Key in memory for the creation intent. A retry uses the same exact body/key, including title normalization and field presence; no retry serializer may silently change it.
- After an ambiguous POST response, retain the frozen intent and offer explicit same-intent retry within the replay window. Do not auto-generate another key or replay automatically. Edited input requires explicit resolution/abandonment of the uncertain original intent before a new creation intent; after expiry/lost intent do not claim duplicate prevention or identify a resource by title/list absence. No browser persistence of intents.
- Validate complete returned resources; update responses must match target UUID and advance the captured revision using the returned value, never local arithmetic. For first creation use only the returned UUID; any replay with a known ID must match it. Do not treat an old 201 replay snapshot as proof of current existence: direct-read/reconcile before publishing it as current or enabling mutations. A deleted replay must not resurrect a row; failed reconciliation retains draft/intent and disables another blind create.
- PATCH uses the captured current server revision and intended dirty fields only. Complete/reopen sends `{revision,completed:true|false}`. Preserve untouched dueDate by omission and clear with null. A no-op editor save may close without PATCH; if PATCH is sent, its returned revision is authoritative even for same-value writes.
- DELETE uses the captured revision query, CSRF, and no body; validate `deletedId === target.id` before confirming deletion. A missing/mismatched identifier is an uncertain outcome, not success. On confirmed deletion evict direct detail, invalidate lists, and prevent old reads from resurrecting it.
- `REVISION_CONFLICT` keeps draft/delete/completion intent and captured baseline. Fetch direct detail, show latest-versus-local review, and require an explicit choice to adopt server values or reapply intended fields using the newly read revision. Never silently replace revision and retry. Repeated conflicts and failed reconciliation retain the draft and offer retry/review. Concurrent deletion becomes an explicit unavailable state.
- Ambiguous PATCH/DELETE failures require direct read/review before another write; do not automatically replay non-idempotent mutations. A matching latest resource can support user reconciliation but is not proof that an unacknowledged operation caused it. Direct 404 after an uncertain DELETE means currently unavailable, not a fabricated `{deletedId}` acknowledgement.
- Reuse bounded Auth/CSRF recovery from completed Plans. Distinguish a definitive pre-mutation security rejection from an unknown transport outcome; existing transport recovery must not turn ambiguous writes into automatic business retries.

### 5. Project relation, Home, and Project-detail composition

- App/page composition injects Project-option summaries and direct Project lookup from the existing server Project store. Use all owned Projects (`status=all`), including archived targets; never reuse the Task/Journal active-only option eligibility rule. Show archive information without disabling otherwise valid choices.
- Paginate options and resolve the selected UUID directly, independent of the first Project page. Missing selection in loaded options is not validation failure. Project-name collisions never determine identity. Keep existing Project-detail default selection and scope behavior; support explicit reassignment to another owned active or archived target within the editor's injected eligible scope without replacing the control layout.
- Add the preserved Milestone section to `ServerProjectsPage` through a `renderMilestones(project.id)`-style slot after direct Project verification. Use selected server UUID, `scope=all`, `projectStatus=all`, and the status selector; support full paginated management for active or archived Project detail. Preserve existing Project, Task, Journal, and Overview flows.
- Proposed authenticated Home is a fixed **read-only** `다가오는 마일스톤` widget using existing frame/row presentation: default scope `unity` from the current widget baseline, projectStatus all, default status open, and default limit **2** from the existing renderer. Honor an explicitly supplied valid scope/UUID/limit (existing widget limit range 1–20) through typed composition, not legacy saved layout. Use fixed server ordering, including overdue and undated rows; do not reinterpret “upcoming” as a date exclusion or newest ordering.
- Retain the Home status filter as a read-only query control and count text using server total; changing it starts a fresh bounded read. Home never loads beyond its configured display bound. Replace editor/title mutation entry with canonical Project-detail navigation; omit create/completion/delete mutations on this explicitly read-only surface. This is the intentional compatibility exception requiring Plan approval, not an unexplained regression. Manage additional rows in Project detail with pagination.
- Reuse presentation-only widget/frame boundaries without importing Dashboard provider, saved layout, fixtures, or Dashboard endpoints. Home loading must not depend on a first-page Project-list membership test.

### 6. Session safety and invalidation

- Scope stores, caches, queries, drafts, and intents to the authenticated user/workspace and session generation. Cancel on route/filter change, disposal, logout, account switch, and security recovery. Guard commits using generation/request/query keys and invalidation epochs so abort-ignoring requests, late 200/401/403, and obsolete mutation completions cannot publish data or trigger UI/security effects in a newer session.
- Preserve drafts through recoverable same-identity revalidation using the existing Auth handoff pattern; clear on logout/account change. Verify identity before restoring. Never persist drafts/intents into legacy storage or leak them across users.
- Confirmed Milestone create/edit/completion/reopen/delete invalidates all Milestone query chains and relevant detail/Home/Project surfaces; broad feature invalidation is acceptable at this scale. Reassignment refreshes both old/new Project views. Refresh subscribed reads from page one and retain useful data visibly stale if refresh fails. Do not misreport an already confirmed save as failed or repeat it because refresh failed.
- Project create/rename/scope/archive/unarchive invalidates Milestone Project options, relevant list chains, direct detail, and widget presentation through app-owned callbacks. Derived Project fields may change without a Milestone revision change; do not suppress equal-revision direct refresh solely on revision equality. Archive changes affect projectStatus membership, not Milestone mutation eligibility.
- Do not overwrite existing Project invalidation subscriptions for Task/Journal/Overview. Invalidate other feature summaries only where their implemented data depends on Milestones; do not assume Task progress or Overview counts are Milestone-derived.
- Caches are transient in-memory UI state, not durable authority; no service-worker/localStorage API caching is introduced. Clear all feature-owned state on disposal/account change.

### 7. Legacy isolation

Keep `devspace.milestones.v1` bytes untouched. Authenticated composition must neither mount `MilestonesProvider`, call `legacyMilestones`, read local Project milestone text, nor import fixtures as data authority. Do not import, convert, migrate, or delete legacy records. Preserve the isolated legacy entry and its existing tests; its historical prototype behavior is not an API migration path. Use storage sentinels and authenticated artifact checks to verify isolation.

## Validation

### Static

- During Plan creation only: inspect live generated contract/current sources, review required scope/template/index consistency, and check documentation links/format. No application implementation, build, unit/browser test, or backend mutation is part of proposal creation.
- After approval: run frontend unit tests, TypeScript/build, boundary checks, documentation links, affected formatting, `git diff --check`, and authenticated-artifact isolation checks using existing tools. No new dependency is planned.
- Cover DTO rejection/UUID/revision/identifier checks, leap years/year boundaries/null versus omission, title UTF-16 limits, completed-only serialization, immutable creation intents and field-presence hashing implications, exact DELETE query/response parsing, query keys/cursor resets, detail independence, invalidation, duplicate pages, and stale/session races.

### Runtime

- Capture representative existing Project-detail and Home rows, editor, filters, focus, desktop/mobile/landscape layouts before implementation. Compare equivalent seeded API scenarios after adaptation. Preserve long Korean titles, null/overdue dates, completed rows, scroll, keyboard/touch, modal focus return, and unsaved navigation. Every unexplained visual or interaction regression fails validation.
- Deterministic browser reads: first loading/error/retry/empty, stale refresh, all confirmed filter combinations, fixed ordering/ties/null dates, limits/cursor reset, later-page failure preserving prior rows, invalid cursor, direct detail beyond loaded pages, Project outside first page, archived relation, and unavailable versus empty states.
- Deterministic mutations: pending/double-click controls; create with optional/explicit null date and completion; immutable same-key retry, changed-input rejection, replay after deletion, reconciliation failure; dirty edits/date clearing/omission; complete/reopen and filter focus; revision-only/same-value server changes; conflicts and repeated review; mismatched success IDs; exact permanent deletion/404; no automatic ambiguous PATCH/DELETE replay; retained drafts on all failure classes.
- Verify owned archived creation/edit/reassignment/deletion, foreign/missing Project rejection, duplicate names, rename/scope/archive invalidation, both reassignment views, and no copied active-only prohibition.
- Verify Home default unity/open/two, explicit supported limits and scopes/Project UUID, fixed order including overdue/undated records, status changes, server totals, read-only requests/navigation, and Project detail management. Ensure no Dashboard/Link requests or saved-layout/local-Milestone authority and no first-page Project dependency.
- Verify same-identity recovery and account-switch cleanup, aborted and abort-ignoring old requests, late security responses, stale pre-mutation pages, overlapping Project/Milestone recovery, and confirmed mutation with failed refresh. Retain existing Auth/Project/Overview/Task/Journal and legacy regression suites.
- Extend existing `tests/real/run.mjs` harness with Milestone acceptance. Run against **real Vite and freshly built Nginx**, the unchanged backend, and disposable PostgreSQL/OIDC resources owned by the run. Compare live generated contract; exercise authenticated CRUD, archived reassignment, revisions/idempotency, filtering/cursor/detail, CSRF/session boundaries, and database outcomes. Capture/inspect desktop/mobile/landscape screenshots, storage sentinels, excluded API traps, and proxy behavior for both frontend delivery paths. Clean only run-owned resources.
- Follow recent Plans' unchanged-backend clean build/Testcontainers regression and source/configuration baseline comparison; use process-only environment overrides where established by the harness. Do not change backend code, security assertions, or configuration to make validation pass. Record actual commands/counts/artifacts and limitations; do not reuse historical pass counts as current evidence.

## Execution Policy: Recover Within the Approved Contract

The approved execution followed the sessions below. For any future expressly authorized follow-up, diagnose and fix recoverable implementation, type/build, OpenAPI, proxy, Docker/process, browser-harness, test, integration, or visual-parity failures within this approved frontend scope, revalidate, and continue. Do not stop for ordinary failures, replace real-boundary validation with mocks, weaken assertions, or silently expand backend/dependency/security scope.

Stop only for a genuine decision-level blocker: contradiction with implemented backend contract, required unapproved architecture/security/backend change, unavoidable new dependency, unresolved data/identity policy, or fundamental UI/backend incompatibility that cannot be resolved within approved scope. Record concrete evidence and the required decision, preserve work, and leave the Plan active; do not mark temporary failures rejected or completed.

## Execution Sessions

### Session 1: Contract and visual baselines

- [x] After explicit approval, transition to active and update the index; re-read all governing source/app/page/feature/shared instructions and record frontend/backend baselines.
- [x] Recheck live OpenAPI and current backend sources, especially archive eligibility, replay fingerprint, DELETE, and cursor ordering; capture current Milestone Home/editor/Project-detail responsive and accessibility baselines.
- [x] Define DTO/draft/presentation, Project-option injection, date-only validation, mutation intents, and approved read-only Home exception. Establish baseline legacy/artifact checks.

### Session 2: Reads, query state, and direct detail

- [x] Implement validated API list/detail models and store, server filters, cursor chains, totals, exact ordering, loading/empty/error/retry, and stale-response guards.
- [x] Adapt preserved list presentation; paginate all-owned Project options and resolve selected IDs directly.
- [x] Pass model/read/pagination/detail/state tests and real Vite/backend read acceptance, including null/tied dates, archived Projects, and selected resources outside first pages.

### Session 3: Mutations and explicit reconciliation

- [x] Connect preserved editor and completion controls to awaited POST/PATCH; add minimal permanent-delete action/confirmation.
- [x] Implement frozen creation intents, exact dirty PATCH/current revision, null clearing, owned archived reassignment, exact DELETE acknowledgment, draft retention, and explicit conflict/ambiguous-outcome reconciliation.
- [x] Pass deterministic mutation tests and real Vite/backend create/edit/complete/reopen/delete/replay/conflict checks with response/database evidence.

### Session 4: Project-detail and Home composition

- [x] Mount feature store and selected-UUID Project-detail section through app/page slots; preserve other feature composition and existing navigation guards.
- [x] Add approved fixed read-only Home widget with existing default two/unity/open, supported explicit inputs, status filter, and Project navigation, without Dashboard authority.
- [x] Connect Milestone/Project mutation invalidation across options, list/detail/editor/Home and old/new Project views; pass cross-surface and storage/excluded-API browser checks.

### Session 5: Recovery, isolation, and visual regression

- [x] Complete generation/epoch/session race protection and same-identity draft handoff; verify stale read/mutation/security results, ambiguous outcomes, and failed post-success refresh.
- [x] Run affected Auth/Project/Overview/Task/Journal/Milestone and retained legacy browser regressions; inspect desktop/mobile/landscape screenshots and keyboard/focus/touch/scroll/navigation behavior.
- [x] Fix and revalidate all unexplained visual/interaction regressions, including filter-removal focus and new delete confirmation, before proceeding.

### Session 6: Final acceptance and documentation

- [x] Pass final static/unit/build/boundary/docs/artifact/format checks and required browser regressions after fixes.
- [x] Pass final real Vite and fresh Nginx/backend acceptance, generated-contract comparison, database/storage assertions, screenshots, cleanup, and unchanged-backend regression/preservation checks.
- [x] Update frontend root/architecture/development documentation to reflect final Milestone authority and deferred APIs. Record final evidence and recovery history here.
- [x] Only after all required validation passes, mark this Plan completed and update `docs/plans/README.md` in the same change.

## Approval candidates and unresolved decisions

The following candidates were explicitly approved for execution:

- Preserve/extract existing Milestone presentation with an API-specific controller and separate validated DTO/draft/view models; no new dependency or standalone route.
- Add minimal permanent-delete action/confirmation using shared patterns because the existing Milestone UI has none.
- Use date-only nullable dueDate, completed-derived presentation, exact fixed-order server filters/cursors, and independent direct detail.
- Allow all owned active/archived Project relations, including reassignment, with server UUID identity and paginated/direct option resolution.
- Use frozen explicit-field creation bodies/keys, explicit conflict/retry/reconciliation, no automatic ambiguous business replay, and transient identity-scoped caches/drafts.
- Add the fixed read-only authenticated Home widget with existing unity/open/default-two inputs, retained status filtering, and canonical Project-detail navigation. Removing mutation controls on this one surface is the explicit read-only exception; full management remains in Project detail. Legacy saved widget configuration is not imported.

No unresolved contract or decision-level blocker was found in proposal inspection. All candidates were explicitly approved on 2026-09-13. Execution is complete with no unresolved decision-level blockers; validation evidence is recorded below.

## Execution evidence and recovery history (2026-09-13)

- The frontend baseline was `250e56d`; the sibling backend remains at `238aaa11108ea301e32d36690aaf616e5817ab0e` with a clean working tree. Generated OpenAPI was rechecked against current controller/DTO/command/query/cursor sources. No backend source/configuration, dependency, legacy storage or identity policy was changed.
- Session 1 captured legacy Project-detail, editor, Home, desktop/mobile/landscape baselines under `.auth-validation/milestone-baseline-*.png`. The five existing Milestone/accessibility browser tests passed before API validation. API DTO, calendar arithmetic, draft/intent, all-owned Project options and presentation boundaries were established.
- Sessions 2–3 implemented direct/list reads, filter-bound cursor chains, exact POST/PATCH/DELETE, nullable dates, completed changes, archived reassignment and explicit reconciliation. Milestone unit coverage includes malformed DTO/UUID/revision/date/duplicate-page rejection, null-versus-omission, immutable replay windows, later-page retry, independent detail, stale epochs, deleted replay, exact deletion acknowledgment and cursor retirement after invalidation.
- Sessions 4–5 composed Project detail by canonical server UUID and read-only Home with unity/open/default-two, retained status controls and Project navigation. Project rename/scope/archive refreshes Milestone presentation even at equal Milestone revision. Same-identity drafts, changed-account cleanup, late 201/401/403, explicit CSRF retry, completion focus and unchanged-draft cancellation have deterministic browser coverage.
- Frontend validation passed: `npm.cmd test -- --run` (24 files, **134 tests**); `npm.cmd run build`; `npm.cmd run check:boundaries` (**152 files, 506 local imports**); `node tools/check-auth-artifact.mjs`; changed-file Prettier checks; `git diff --check`; `node tools/check-doc-links.mjs` (**30 documents**).
- Browser suites passed: Milestone **13**, retained legacy **35**, Auth **20**, Project/Overview **21**, Task **21**, Journal **7** (**117 total**). Controlled Vite reuse was used for each configured port. Existing storage sentinels and excluded API assertions remain enabled; fixtures now permit the approved Milestone reads.
- Real `node tests/real/run.mjs --projects=final --tasks=final --journals=final --milestones=final` and its `--nginx` counterpart passed combined feature/session/proxy acceptance. Subsequent Milestone-only Vite/Nginx runs revalidate final Milestone-specific fixes. The unchanged backend uses disposable PostgreSQL/OIDC; 25 Milestones traverse pages of **20 and 5**, with overdue/null dates, direct reads, archive filters, archived creation/reassignment, completion/reopening, same-value revisions, stale conflicts, exact DELETE and idempotent original replay after deletion. UI create/edit/date-clear/complete/reopen/delete and read-only Home navigation are exercised. Run-owned rows/processes/containers are cleaned, and session/proxy smoke finishes with zero business rows and zero excluded API requests.
- Runtime evidence is retained under `.auth-validation/vite/` and `.auth-validation/nginx/`: `milestone-contract.json`, `milestones-result.json`, combined feature results, session `result.json`, `milestone-home.png`, and `milestone[-editor]-desktop/mobile/landscape.png`. Captures were visually compared with the original Milestone structure. Existing fields, Korean labels, row layout, focus indication and responsive modal scrolling remain intact; only the approved read-only Home actions and permanent-delete addition differ.
- The unchanged backend passed `APP_ORIGIN=http://localhost:8080 gradlew.bat clean test --no-daemon`: **183 tests, zero failures/errors**, verified from its JUnit XML. The established Origin override is process-only; no backend security assertion/configuration was edited.
- Recoverable issues were fixed and revalidated: Windows shell editing/quoting failures; required Docker execution privileges; an accidentally duplicated projectStatus in the new real harness; exact Project selector labeling; a missing confirmation response in a browser fixture; premature screenshot capture; unnecessary Project-option eager reads; broad auth styles overriding Milestone buttons/inputs/focus and the Home title; completion focus attempted before the filter was re-enabled; preselected unchanged drafts treated as dirty; and stale cursors retained after mutation invalidation. Home title parity is now asserted at the original **13px**, selected Project failures offer explicit retry, and confirmed deletions cannot reappear from a retained stale page. No test assertions or backend behavior were weakened to obtain a pass.

## Completion Criteria

- [x] Existing Milestone rows/editor/Korean controls/responsive/accessibility/navigation are preserved, with only approved asynchronous/delete additions and the explicit read-only Home exception.
- [x] Authenticated authority is validated server DTOs and canonical Project UUIDs; nullable calendar dates, completed/status separation, revisions/audits, filters/order/cursors/detail, and archived eligibility match the backend.
- [x] Create/edit/complete/reopen/permanent-delete, idempotency, conflicts, uncertain outcomes, acknowledgment validation, and draft retention follow the approved contract.
- [x] Session cancellation/stale-response protection and Project/Milestone invalidation keep Home/detail/lists coherent without cross-account state leakage.
- [x] Legacy Milestone storage remains preserved and unused; no import/migration/backend change/Link or Dashboard integration/new dependency occurs.
- [x] Required static, browser, visual, real Vite/Nginx/backend, and unchanged-backend validation passes with final evidence recorded.
- [x] Related documentation and Plan index are updated; completion is recorded only after successful validation.
