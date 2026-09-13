# PLAN-0009: Journal Integration

## Status

`completed` — explicitly approved and executed on 2026-09-13. No backend change was made or authorized by this document.

## Goal

Replace authenticated Journal localStorage and fixture authority with the existing backend Journal API while preserving the current Journal editor, list presentation, navigation, filtering, ordering controls, responsive layout, accessibility behavior, and successful user flows wherever the server contract permits.

The API and server-owned Project relation become authoritative. The existing `devspace.journals.v1` data remains intact for the isolated legacy prototype and is never imported, converted, deleted, or used by authenticated API composition.

## Scope

- In scope:

  - Authenticated Journal list and direct-detail loading through the existing shared HTTP/session transport.
  - Create, edit, and permanent-delete flows with awaited asynchronous state, drafts, pending controls, errors, revision handling, CSRF recovery, and creation idempotency.
  - Canonical server Project UUID relations, Project name/scope presentation mapping, active/archived Project rules, Project detail Journal views, and recent Journal widget reads.
  - Server-side newest/oldest sorting, inclusive `from`/`to` calendar-date filters, title/body/Project-name search, cursor pagination, matching totals, and independent direct Journal reads.
  - Session-generation cancellation, stale-response protection, cache invalidation, responsive/accessibility regression coverage, visual comparison, and real Vite/Nginx/backend browser validation.
  - Updating frontend architecture, development, and Plan-index documentation after approved implementation.

- Out of scope:

  - Any backend source, schema, security policy, generated OpenAPI, or API contract change.
  - Journal trash, restore, archive, or soft-delete behavior. Journal DELETE is permanent only.
  - Milestone, Link, or Dashboard API integration, Dashboard layout persistence, or automatic Journal local-data migration.
  - Treating local fixtures, Project names, local UUIDs, loaded arrays, or list absence as authenticated Journal authority.

## Current frontend baseline and authority boundary

The legacy Journal implementation is composed by [JournalWorkspace](../../src/features/journal/JournalWorkspace.tsx), [JournalEditor](../../src/features/journal/JournalEditor.tsx), [RecentJournals](../../src/features/journal/RecentJournals.tsx), and [JournalsProvider](../../src/features/journal/JournalsProvider.tsx). It currently stores `JournalEntry.createdAt` as both the audit timestamp and the editable 작성일 value, trims title/body before saving, filters and sorts the complete local array, and uses fixture/localStorage Project identity. Its existing fields, controls, labels, modal layout, detail navigation, and CSS are the presentation baseline.

The default authenticated composition currently routes `/journals` to a pending state and uses API stores for Projects, Overview, and Tasks from [PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx). The implementation should extract or adapt the existing Journal presentation contracts so the legacy test-only entry keeps its behavior while the authenticated entry receives API-backed data. It must not mount `JournalsProvider`, read Journal fixtures, or touch `devspace.journals.v1` in authenticated mode.

Project, Overview, and Task integrations from PLAN-0007 and PLAN-0008 may be reused through app/page composition. Journal feature code may use the shared HTTP layer and feature-owned models; cross-feature Project options and selected-Project detail should be injected through app/page contracts rather than importing Project implementation internals.

## Live backend contract inspected during proposal

The running backend at `http://127.0.0.1:8080` and its generated document at `/v3/api-docs` were read on 2026-09-13. Swagger UI is available at `/swagger-ui/index.html`. The executed implementation must recheck the live contract after approval; these observations are proposal evidence, not a substitute for final runtime validation.

- `GET /api/v1/journals` accepts `scope=all|unity|server`, `projectId` (UUID), `projectStatus=all|active|archived`, `query`, `from`, `to`, `sort=newest|oldest`, `limit` (1–100, default 20), and `cursor`.
  - The server searches literal title, Project name, and body text.
  - Date bounds are inclusive calendar dates.
  - `newest` orders by `entryDate DESC, createdAt DESC, id DESC`; `oldest` reverses all three keys.
  - The cursor binds workspace, all filters, and limit. There is no cross-page snapshot guarantee.
  - The response is `{ items, total, nextCursor }`, where `nextCursor` may be `null`.
- `GET /api/v1/journals/{id}` returns one owned Journal directly. List membership or a missing loaded page must never be treated as proof that the resource is missing.
- `POST /api/v1/journals` requires `X-CSRF-Token`, `Idempotency-Key`, and `{ title, projectId, body, entryDate }`. The Project must be an active owned Project. Reusing the same key and body within the backend's 24-hour replay window returns the original 201 snapshot, including after deletion or Project archival.
- `PATCH /api/v1/journals/{id}` requires `X-CSRF-Token` and a body containing `revision`; omitted fields stay unchanged. Same-value updates advance revision. Retaining an archived Project is allowed; changing the relation requires an active owned target.
- `DELETE /api/v1/journals/{id}?revision=...` requires `X-CSRF-Token` and the current revision, permanently deletes the Journal, and returns `{ deletedId }`. Subsequent reads and mutations return 404.
- `JournalResponse` contains server-owned `id`, `revision`, `createdAt`, `updatedAt`, `projectId`, `projectName`, `scope`, `title`, `body`, and date-only `entryDate`. `createdAt` and `updatedAt` are audit timestamps and are never editable date controls.
- Expected error classes include validation errors, `REVISION_CONFLICT`, `PROJECT_ARCHIVED`, `RESOURCE_NOT_FOUND`, `CSRF_INVALID`, authentication/disabled-account errors, network failures, and ordinary server errors. The existing shared transport and AuthSession security-recovery policy remain the error boundary.

## Proposed frontend model and DTO mapping

1. Add an API Journal model that validates complete UUID, revision, audit timestamp, date-only, Project relation, title, body, and enum fields. Preserve a safe integer revision and reject malformed or partial success payloads before publication.
2. Keep API response, editable draft, and presentation types distinct:
   - `ApiJournal` mirrors `JournalResponse`, including `revision`, `createdAt`, `updatedAt`, `entryDate`, `projectId`, `projectName`, and `scope`.
   - `JournalDraft` contains only editable `title`, `projectId`, `body`, and `entryDate`.
   - `JournalView` supplies the existing list/editor/detail surfaces without pretending `createdAt` is the entry date.
3. Serialize creation with exactly the writable fields `title`, `projectId`, `body`, and `entryDate`, plus a frozen `Idempotency-Key`. Serialize PATCH with the captured revision and dirty fields only; a Project change is sent as the canonical UUID.
4. Serialize DELETE with the captured revision query and parse the required `{ deletedId }` response. No client-side trash state, restore command, archive flag, or soft-delete fallback is introduced.
5. Represent `entryDate` as a strict `YYYY-MM-DD` string end to end. Native date inputs and display formatting consume that string directly; no `Date` parsing, timezone conversion, local-noon construction, or audit-timestamp substitution is allowed. The existing `createdAt`-based date behavior is replaced in API mode without converting legacy storage.
6. Preserve body content exactly as entered, including whitespace and newlines, subject only to nonblank validation and the server's UTF-16 length limit. Do not destructively call `trim()` when constructing the request or when displaying a saved body.

## Existing Journal UI and composition preservation

1. Reuse the existing Journal list rows, detail action, editor fields (title, Project, entry date, body), date controls, Project filter, sort control, empty-state actions, confirmation modal, modal focus behavior, navigation guard, responsive CSS, and accessible labels. Add only pending/error/retry/pagination affordances required by asynchronous API state.
2. Adapt `JournalWorkspace` and `JournalEditor` through API-facing props or a new API manager/controller rather than replacing the screen with a simplified table. The test-only legacy entry keeps `JournalsProvider` and its local behavior; authenticated composition receives an injected Journal store and Project option source.
3. Convert save and delete handlers to awaited operations. Disable only the affected controls while pending, retain the editor draft and deletion target after validation, network, CSRF, revision, or refresh failures, and require an explicit retry or conflict review. Successful responses close the editor/modal only after confirmed server data is available.
4. Keep newest/oldest control semantics. The full Journal page delegates search, Project, date, scope, sort, and total semantics to the server instead of filtering a partial loaded array. It resets the cursor chain when any bound filter, sort, or limit changes and exposes Load more while `nextCursor` is non-null.
5. Recent Journal widgets always request newest ordering and use their configured limit, with the existing default (three) when no limit is configured. They render server `entryDate`, `projectName`, and body/title detail without assuming a complete list. Dashboard API/layout authority remains out of scope; any authenticated Home composition must receive a bounded Journal read through page/app injection, while the legacy Dashboard renderer remains isolated.
6. Project detail Journal views use the selected server Project UUID and a direct filtered Journal query. A selected archived Project remains readable and its existing relation is retained for edits/deletes; an absent list page or an exhausted cursor cannot produce a false “missing” result.

## Reads, filters, sorting, and pagination

1. Build a Journal store/query controller on the existing `PrivateTransport` with per-filter cursor chains, direct-detail queries, request sequence numbers, AbortControllers, lifecycle/session-generation checks, and bounded inactive entries. Each list key includes scope, Project UUID/status, query, date bounds, sort, and limit.
2. Send `from` and `to` as exact inclusive date-only query values. Validate an inverted range in the UI before a request and preserve the existing alert and reset interaction.
3. Send the current text query unchanged to the server, which searches title, body, and Project name. Do not concatenate only loaded rows or perform a second local search that could hide server matches.
4. Map the existing scope control to `scope`, Project selection to `projectId`, active/archived behavior to `projectStatus`, and the newest/oldest control to `sort`. Project filter options must use server UUIDs; display labels come from current Project data or the Journal response's read-only `projectName`/`scope`.
5. Render explicit idle/loading/refreshing/stale/error/empty/ready states, matching totals, retry controls, and Load more. A failed later page retains the already confirmed rows and exposes retry; a failed initial load does not fabricate an empty list.
6. Use `GET /api/v1/journals/{id}` for editor entry, conflict reconciliation, and direct Project-detail access. A Journal outside the current search/page remains addressable if its UUID is known; list pagination never establishes resource existence.

## Mutations, drafts, and conflict policy

1. Creation freezes the request body, active Project UUID, date-only entry value, and Idempotency-Key for the in-memory replay window. An ambiguous response does not automatically replay; the UI offers an explicit review/retry using the identical key/body. Reload, logout, account change, or session loss retires the intent.
2. Creation and reassignment expose active owned Projects only. If a Journal currently points to an archived Project, editing title/body/entryDate or retaining that same relation remains allowed; changing to another Project requires an active target. Do not silently move, delete, or detach an archived relation.
3. PATCH captures the server revision and submits only changed fields. A successful response seeds the confirmed entity before list/detail refresh so a failed follow-up read cannot erase a confirmed edit or invite duplicate submission.
4. On `REVISION_CONFLICT`, `PROJECT_ARCHIVED`, ambiguous mutation, or a failed reconciliation, keep the draft and show the latest server state plus an explicit review/reapply path. Never overwrite a newer server Journal or automatically replay a mutation after a conflict.
5. DELETE requires confirmation, awaits the 200 `{ deletedId }` response, removes the Journal only after the returned ID matches the requested resource, and invalidates affected queries. A conflict or network failure retains the row and confirmation context for retry. There is no trash, restore, or archive workflow.
6. Reuse the shared CSRF and session recovery boundary. `CSRF_INVALID` may perform the bounded same-identity token recovery, but no Journal mutation is replayed automatically. Current-generation 401/typed 403 and account changes retire private Journal state.

## Project relation and cross-surface invalidation

1. Project UUIDs, revisions, and ownership are server authority. No local fixture ID, name lookup, random UUID, or legacy `project` field participates in authenticated requests.
2. Inject Project option data from the existing ProjectStore/app adapter. Active Project options may be paginated; a currently selected archived Project must be loaded directly and remain selectable as the retained relation. Journal list and editor must not assume the first Project page is complete.
3. Use read-only `projectName` and `scope` from each Journal response for immediate presentation, while ProjectStore updates invalidate Journal queries so rename, scope, archive, and ownership changes become current. Do not derive authenticated Journal scope from a stale local Project array.
4. Wire mutation invalidation across full list, filtered list, direct detail, Project-detail, Home recent-widget, and editor caches. Journal mutations invalidate all affected Journal reads; Project mutations invalidate Journal list/detail and option queries. These independent endpoints are not treated as one atomic snapshot.

## Legacy storage and excluded APIs

The authenticated Journal entry must not import or call `JournalsProvider`, `initialJournals`, `usePersistedState` for Journal data, or the `devspace.journals.v1` key. The legacy key, fixtures, old `createdAt` shape, and test-only local workflows remain byte-for-byte available to the isolated legacy entry. Auth/browser tests will install storage sentinels that fail on Journal storage access and verify no import, conversion, deletion, or write occurs. Milestone, Link, and Dashboard API calls remain absent from this Plan's authenticated Journal flows.

## Changes

1. Add API Journal DTO, draft, response validation, date-only helpers, serializers, and cursor/query-key types under the Journal feature; preserve separate legacy models where required by the test-only entry.
2. Add the Journal store/controller for list/detail reads, pending/error/stale state, per-filter cursor pagination, direct reconciliation, cancellation, generation checks, and mutation epochs.
3. Adapt the existing Journal list/editor/detail presentation to injected API contracts, preserving markup, labels, modal/accessibility behavior, responsive layout, filters, ordering, and draft/unsaved-change protection.
4. Compose an authenticated Journal route and provide Journal data from `PrivateWorkspace`, reusing the existing Project/Task/Overview session, navigation, HTTP, CSRF, and handoff conventions. Add Project-detail Journal rendering by selected server UUID.
5. Connect the existing Recent Journal widget presentation to bounded API reads with newest ordering and configured/default limits without introducing Dashboard API or saved-layout authority.
6. Add mutation and cross-surface invalidation wiring for Project rename/scope/archive, Journal create/edit/delete, direct detail, list pages, Project detail, and recent widgets.
7. Keep legacy storage and presentation tests isolated, update architecture/development documentation only after implementation, and record the final validation evidence in this Plan and [docs/plans/README.md](README.md).

## Validation

### Static

- Re-read applicable frontend and documentation instructions and compare the final implementation with the live generated OpenAPI and runtime backend responses.
- Run `npm run check:boundaries`, `npm run check:docs`, TypeScript/Vite build, unit tests for DTO/date/query/store/mutation/revision/idempotency behavior, changed-file Prettier checks, `git diff --check`, and `node tools/check-auth-artifact.mjs`.
- Verify authenticated production output contains no legacy Journal storage/fixture/provider markers and no excluded Journal-related API fallback.
- Verify request serializers preserve omission/null/empty-string/false/zero distinctions, body newlines/whitespace, date-only strings, UUIDs, revisions, CSRF headers, and `Idempotency-Key` without adding a runtime dependency or modifying backend files.

### Runtime

- Run the isolated legacy browser suite and confirm existing Journal creation, edit/delete, date filters, Project filters, ordering, Home widget, Project detail, mobile layout, keyboard/modal focus, navigation guards, and storage-failure regressions remain unchanged.
- Run deterministic authenticated Journal browser tests for initial/loading/refresh/error/empty states, server search across title/body/Project name, inclusive date bounds, newest/oldest ordering, cursor Load more, later-page failure/retry, direct detail outside the loaded page, and missing/inaccessible Project/Journal handling.
- Verify create with active Project, body preservation, entry-date edits, same-key/body explicit retry after a dropped response, changed-key/body rejection, pending controls, and no duplicate row. Verify reassignment rejects archived targets while retaining the same archived relation for edit/delete.
- Verify update with dirty-field PATCH, same-value revision advance, concurrent revision conflict, explicit reconciliation/reapply, failed refresh after confirmed save, and draft retention on validation/network/CSRF/conflict failures.
- Verify permanent delete confirmation, successful `{deletedId}` handling, conflict/retry, 404 after deletion, and absence of trash/restore/archive UI or requests.
- Verify Project rename/scope/archive invalidates Journal presentation, archived selected Project detail remains readable, Project detail uses the server UUID, and recent Journal widgets use newest order plus configured/default limits without requiring a complete list.
- Run desktop/mobile/landscape screenshots and keyboard, touch, modal focus, scroll, and unsaved-navigation checks. Any unexplained visual or interaction regression against the current Journal baseline fails validation.
- Run real Vite and fresh Nginx acceptance against the unchanged backend and disposable PostgreSQL/OIDC environment. Fetch and compare generated Journal contracts, exercise authenticated list/detail/create/update/delete and Project relation cases, assert storage sentinels and excluded API calls, inspect screenshots, and clean only resources owned by the run.
- Run the unchanged backend clean build/Testcontainers regression and compare backend source/configuration hashes before and after; no backend file or security assertion may change.

## Execution Policy: Recover Within the Approved Contract

During approved execution, recoverable implementation, test, OpenAPI, proxy, process, Docker, database, screenshot, or browser-harness failures must be diagnosed, fixed within this Plan's approved frontend boundary, and revalidated before continuing. Do not replace live contract or real-boundary tests with mocks merely to make progress, weaken dependency/artifact/storage checks, change backend source, or broaden the scope silently. Stop only for a genuine decision-level blocker such as an incompatible backend contract, a required security/policy change, an unavoidable new dependency, or an unresolved ownership/identity policy; record the concrete evidence and leave the Plan active.

## Execution Sessions

### Session 1: Baselines, contract, and presentation boundaries

- [x] Rechecked all governing instructions, the current frontend/backend working-tree baselines, completed Plan contracts, and the live Journal OpenAPI. Registered this Plan as `proposed`, then activated it after explicit user approval and updated the index.
- [x] Capture current Journal route, editor, Project detail, recent-widget, desktop/mobile/landscape, keyboard, modal, and navigation-guard baselines with representative legacy data. Inventory markup, styles, labels, fields, and successful flows that must remain.
- [x] Define API DTO/draft/presentation contracts, date-only semantics, Project option injection, query-key/cursor boundaries, and legacy/API composition without importing the legacy provider into authenticated code.
- [x] Pass model/serializer/date and artifact-boundary tests plus existing legacy Journal smoke before introducing API behavior.

### Session 2: Journal reads, filters, and pagination

- [x] Implement API response validation, list/detail query controllers, server scope/Project/date/search/sort parameters, cursor chains, matching totals, direct UUID reads, and explicit loading/refresh/stale/error/empty states.
- [x] Connect the preserved list controls and recent-widget presentation to server results, configured/default newest limits, active/archived Project options, and direct Project-detail UUID filtering.
- [x] Pass deterministic filter, tie-order, inclusive-date, search, pagination, later-page failure/retry, malformed response, cancellation, stale-response, and list-absence/direct-detail tests.
- [x] Pass real backend read acceptance for multiple pages, body/Project-name search, archived Project relation, selected Project outside the first page, and empty/error/loading screenshots.

### Session 3: Create, edit, delete, and conflict recovery

- [x] Wire the existing editor and delete confirmation to awaited API operations while retaining fields, date controls, body content, successful close behavior, pending guards, and draft/error behavior.
- [x] Implement active-Project creation/reassignment rules, exact date-only requests, frozen Idempotency-Key/body replay intents, dirty PATCH with captured revision, permanent DELETE with `{deletedId}`, and explicit conflict/reconciliation paths.
- [x] Pass unit and deterministic browser coverage for body preservation, dropped creation responses, changed idempotency body, same-value revision advance, concurrent conflicts, archived retention/reassignment restrictions, delete conflicts, CSRF recovery, and failed-save draft retention.
- [x] Pass real Vite/backend create/update/delete acceptance with database counts and exact Project/Journals response assertions; verify no duplicate creation and no trash/archive behavior.

### Session 4: Authenticated composition and cross-surface behavior

- [x] Mount the API-backed Journal route through `PrivateWorkspace` and preserve app-owned navigation/unsaved guards, session identity, Project options, and Task/Overview composition.
- [x] Add the selected-UUID Project-detail Journal view and bounded recent Journal widget read without Dashboard API/layout authority; retain legacy Dashboard/provider composition in its isolated entry.
- [x] Wire Journal and Project mutation invalidation across list/detail/editor/Project detail/Home surfaces, including rename, scope change, archive, and selected archived relation behavior.
- [x] Pass cross-surface browser tests for create/edit/delete, Home newest/default/configured limits, Project detail, direct navigation, refresh, back/forward, and no excluded API/storage access.

### Session 5: Session, cache, responsive, and legacy regression

- [x] Complete session-generation cancellation, abort-ignoring transport safety, stale A-after-B read/mutation suppression, dispose cleanup, security recovery bounds, and same-identity draft policy.
- [x] Pass overlapping Journal/Project recovery, late 200/401/403, stale pre-mutation reads, confirmed-save/failed-refresh, repeated conflict, lost response, and account-change tests.
- [x] Run full Journal/auth/Project/Overview/Task authenticated suites plus the retained legacy browser suite with storage sentinels, excluded-API traps, responsive screenshots, keyboard/focus, touch/scroll, modal, and navigation-protection checks.
- [x] Resolve every unexplained visual or interaction regression against the captured Journal UI baseline before final validation.

### Session 6: Final validation, documentation, and completion

- [x] Pass all required unit/build/boundary/docs/format/artifact checks and affected full browser suites after fixes.
- [x] Pass final real Vite and fresh Nginx Journal/auth/Project/Overview/Task acceptance, generated-contract comparison, database assertions, storage isolation, screenshots, and cleanup.
- [x] Pass unchanged backend clean build/Testcontainers regression and verify backend source/configuration preservation.
- [x] Update frontend root/architecture/development documentation for Journal authority, date/audit semantics, filters/pagination, mutation policies, widgets, Project relations, and deferred APIs.
- [x] Record final commands/counts/recovery evidence here and update the existing frontend Plan index row only after all required validation succeeds; then mark this Plan `completed`.

## Approval candidates and unresolved decisions

The following implementation choices are approved for execution with this Plan:

- Reuse/extract the current Journal list/editor/detail markup and styles, with API-specific store/controller inputs, rather than replacing the UI.
- Keep `entryDate` as the only editable date and display `createdAt`/`updatedAt` only as server audit metadata where a surface needs it; never convert date-only values through a timezone or local-noon `Date`.
- Use server filtering/search/sort/cursor pages as the only authenticated list authority. `GET /journals/{id}` is the source for direct detail and conflict reconciliation beyond loaded pages.
- Use in-memory immutable creation intents and the backend's 24-hour idempotency replay window with explicit review/retry, no automatic replay, and no browser persistence.
- Keep an archived Project relation readable and editable for non-relation fields, allow reassignment only to an active Project, and require explicit conflict recovery for a newly archived target.
- Add a bounded authenticated, read-only recent-Journal composition; do not introduce Dashboard API/layout persistence. Use newest ordering, default limit three, and an existing explicit limit when provided.

The authenticated Home recent-Journal surface is approved as a fixed read-only composition for this Plan. It uses newest ordering and the default limit three unless an existing explicit limit is provided, without Dashboard API or saved-layout authority.

## Proposal validation and approval boundary

This Plan was registered as `proposed` for creation only and was explicitly approved on 2026-09-13, including all contract candidates and the authenticated Home recent-Journal surface. It was then activated and executed in order. The live OpenAPI inspection above and the final generated-contract artifact verify the current Journal paths, fields, sorting, filters, cursor, idempotency, revision, Project, delete, and error contract.

## Final validation evidence (2026-09-13)

- The live backend OpenAPI returned 200 and the generated Journal contract was captured in `.auth-validation/nginx/journal-contract.json`. Real Vite and fresh Nginx runs both passed the Journal final phase: 25 seeded Journals were read as pages of 20 and 5; title/body/Project-name search, inclusive dates, newest/oldest ordering, archived-relation retention, idempotency replay after deletion, permanent delete, and storage/excluded-write assertions all passed (`excludedWrites: 0`). Auth/proxy smoke also passed with three OIDC authorizations, exchanges, and PKCE handshakes, zero business rows before Journal seeding, and zero excluded API requests.
- Frontend static validation passed: `npm.cmd test -- --run` (22 files, 122 tests), `npm.cmd run build`, `npm.cmd run check:boundaries` (140 files, 456 local imports), `node tools/check-auth-artifact.mjs`, changed-file Prettier checks, `git diff --check`, and `npm.cmd run check:docs` (29 documents). The stale completed-Plan links to the former `dev-back/devspace` checkout were updated to the current sibling `backend` checkout so the documentation check is now clean.
- Deterministic Journal browser validation passed all 7 tests: server filters/search/date bounds/order, cursor loading and later-page retry, Project-detail UUID reads, create body/date/Idempotency-Key behavior, revision conflict and explicit reapply, permanent delete, archived relation retention, active-only reassignment, and the read-only Home newest/default-three widget. The retained legacy suite passed 35 tests; auth passed 20; Project/Overview passed 21; Task passed 21. Storage sentinels, excluded-API traps, keyboard/focus, navigation guards, and responsive checks remained clean.
- Desktop, mobile, and landscape Journal screenshots from the Nginx run were inspected and showed the preserved editor/list/navigation structure with responsive controls and no unexplained visual or interaction regression. No authenticated code imports the legacy Journal provider, fixture, or `devspace.journals.v1`; the legacy key remains preserved and unused as API authority.
- The unchanged backend passed `APP_ORIGIN=http://localhost:8080 gradlew.bat clean test --no-daemon` with 183 tests. The process-only Origin override was required because the existing backend `.env` sets `127.0.0.1:5173` while the existing security test expects `localhost:8080`; no backend source, configuration, schema, or security assertion changed, and the backend working tree remained clean.
- Recoverable harness issues were diagnosed and resolved during execution: Chromium was installed for Playwright, the legacy config excludes the separate API Journal tests, authenticated fixtures allow the approved read-only Journal Home request, and Playwright suites use a controlled server-reuse flag to avoid Windows webserver teardown hangs. No dependency or backend scope was broadened. There are no unresolved decision-level blockers.

## Completion Criteria

- [x] Existing Journal UI fields, layout, navigation, filters, ordering, responsive, accessibility, and successful flows are preserved except approved contract-driven additions.
- [x] Authenticated Journal data comes only from server DTOs and canonical Project UUIDs; local fixtures and `devspace.journals.v1` remain untouched and unused.
- [x] Entry-date, audit timestamps, body preservation, Project active/archived rules, sorting, date filters, search, cursor pagination, totals, direct reads, and recent-widget limits match the implemented backend contract.
- [x] Create, dirty update, permanent delete, idempotency, revisions, conflicts, CSRF recovery, pending/error states, drafts, and explicit retry/reconciliation behavior match the approved policy.
- [x] Session-generation cancellation, stale-response protection, cache invalidation, Project mutations, and cross-surface consistency cannot publish obsolete or other-account Journal state.
- [x] No trash/restore/archive behavior, Milestone/Link/Dashboard API integration, backend source change, local-data migration, or new runtime dependency is introduced.
- [x] Required static, visual, deterministic browser, real Vite/Nginx/backend, storage-isolation, and unchanged-backend validations pass with evidence recorded here.
- [x] Related architecture/development documentation and the Plan index describe the final implementation, and only then is the Plan marked `completed`.
