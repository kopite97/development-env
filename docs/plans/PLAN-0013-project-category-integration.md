# Plan: ProjectCategory integration

Date: 2026-09-14.
Status: completed. Explicitly approved with all candidates and executed in Sessions 1-6 on 2026-09-14. Final validation and recovery evidence is recorded below; unrelated repository formatting warnings are retained as the pre-existing baseline allowed by this Plan.

## Goal

Implement the accepted [ProjectCategory boundary](../decisions/project-category-boundary.md): a server-backed Project relation identified by Category UUID, independent of the existing `scope` compatibility axis. Preserve the authenticated application shell, Project presentation, completed feature integrations, and legacy storage isolation.

## Scope

- In scope: Category API models/store, authenticated CRUD, revision/error recovery, Project relation parsing/serialization, editor selection, minimal Category management/display, targeted freshness, and unit/browser/real-backend validation.
- Out of scope: backend changes, Category filtering/query parameters, Dashboard Category configuration, scope replacement or inference, unrelated redesign, legacy model/storage migration, and automatic Category defaults.

## Verified implementation contract

Read-only verification on 2026-09-14 used the running backend at `http://127.0.0.1:8080`: generated `/v3/api-docs` and `/swagger-ui/index.html` both responded successfully. The following is the implemented OpenAPI contract, not a proposed backend API. Ownership and mutation ordering were corroborated in sibling backend `src/main/java/com/kopite/devspace/projectcategory/application/CategoryCommandService.java`. No authenticated mutation or test-data change was performed during Plan creation. Authenticated behavioral verification remains an execution gate below.

| Surface             | Verified contract                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership/identity  | Session-owned personal workspace; Category UUID is identity. Missing/inaccessible resources return `404 RESOURCE_NOT_FOUND`. No name-based lookup identity.                                                                                                                                                                                                                 |
| List/read           | `GET /api/v1/project-categories` returns `{ items, total }`, full collection ordered `createdAt ASC, id ASC`, no parameters/pagination/search/manual ordering. `GET /api/v1/project-categories/{id}` returns current owned Category.                                                                                                                                        |
| Category model      | `{ id, name, revision, createdAt, updatedAt }`; revision is a positive safe integer, maximum `9007199254740991`. Audit fields remain internal.                                                                                                                                                                                                                              |
| Create              | `POST /api/v1/project-categories`, `{ name }`, required `X-CSRF-Token` and `Idempotency-Key` (1-128 visible ASCII characters), `201 CategoryResponse`. Same key/body replays the original snapshot for 24 hours, even after rename/deletion. Raw name differences constitute different intents even when normalization yields equal names.                                  |
| Names               | Java trim then NFC, 1-100 normalized UTF-16 units; case-sensitive workspace uniqueness. Unknown/duplicate/null request fields rejected. Do not substitute JavaScript's broader trim semantics or case folding as server authority.                                                                                                                                          |
| Rename              | `PATCH /api/v1/project-categories/{id}`, `{ revision, name }`, CSRF, `200 CategoryResponse`. Both fields required; even same-normalized-name rename increments Category revision once, never Project revision.                                                                                                                                                              |
| Delete              | `DELETE /api/v1/project-categories/{id}?revision=...`, CSRF, no body, `200 { deletedId }`. Active AND archived references reject with `409 CATEGORY_IN_USE`. No cascade/clear/reassignment; repeated delete returns 404.                                                                                                                                                    |
| Errors/quota        | `409 CATEGORY_NAME_CONFLICT`, `REVISION_CONFLICT`, or create `IDEMPOTENCY_KEY_REUSED`; create `429 QUOTA_EXCEEDED` at 100 persisted Categories. Full list is never truncated at the creation cap. Standard `VALIDATION_ERROR`, `AUTH_REQUIRED`, `ACCOUNT_DISABLED`, `CSRF_INVALID`, `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR` use `{ code, message, fieldErrors, requestId }`. |
| Defaults            | No automatic Categories. Project create still requires `name`, `scope`, `stack`; `scope` remains `unity                                                                                                                                                                                                                                                                     | server`. |
| Project create      | `categoryId` omitted or null creates uncategorized; UUID assigns an owned Category. Omission preserves legacy v1 idempotency fingerprint; explicit null/UUID uses v2, including raw UUID case. Field presence and supplied values matter; property order does not.                                                                                                          |
| Project read/update | Normal responses require nullable UUID `categoryId`, with no derived Category name. PATCH omission preserves relation, null clears it, UUID assigns; revision remains required. Archived Projects are editable; archive/unarchive preserves Category.                                                                                                                       |
| Project replay      | POST 201 permits `ProjectResponse` OR `LegacyProjectResponse`. Pre-deployment replay can omit `categoryId`; it does not resolve current Category state. Normal list/detail/PATCH responses do not permit omission.                                                                                                                                                          |

Recheck these operations and schemas before Session 1. Any incompatible live-contract drift blocks the affected work until this Plan is revised; do not invent request fields, error payloads, or backend guarantees.

## Changes

### 1. Category API boundary and lifecycle

- Add Category model/parser/store and focused tests initially under `src/features/projects/`, separate from [ProjectStore](../../src/features/projects/apiStore.ts). Use a branded Category UUID distinct from Project UUID, server revisions, strict response validation, and full-list/detail query snapshots. Category names are mutable display values only.
- Compose store ownership/disposal in [PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx). Reuse authenticated transport, session generation, abort lifecycle, typed errors, CSRF single-flight recovery, and explicit mutation retry. Do not add a provider backed by fixtures/localStorage or new cross-feature imports.
- Serialize Category create intents as frozen raw `{ name }` plus key/time. Preserve the exact body/key during uncertain retries and same-identity recovery; do not regenerate from an edited draft. After the 24-hour window or backward-clock detection, require explicit reconciliation/new-intent confirmation, never automatic reposting.
- Treat a create replay as historical, not authoritative current state: revalidate list/detail after success, including renamed/deleted replay targets. Never resurrect a deleted Category or overwrite a newer name from an old 201 snapshot. Successful creation followed by failed refresh is a freshness error, not a failed creation requiring another POST.
- Guard one pending create and one mutation per Category ID; reject duplicate submissions. Combine session generation with request/mutation epochs and revision-aware adoption so pre-mutation lists, late responses, and disposed-session results cannot restore deleted rows or stale names.
- Maintain Category-management draft/intent memory independently of Project editor memory. Same-identity reauthentication may restore it; identity/workspace change or logout follows existing teardown policy. Never automatically submit after authentication recovery.

### 2. Project model, drafts, and immutable intent

- Extend [apiModel](../../src/features/projects/apiModel.ts), [createIntent](../../src/features/projects/createIntent.ts), draft memory, store create handling, and editor reconciliation. Normal `ApiProject` and authenticated editable draft carry `categoryId: ServerCategoryId | null`. Widen dirty PATCH value types to include null; unchanged Category is omitted, explicit clearing sends null, selection sends UUID. Scope changes only when its separate control changes.
- For new frontend create intents, serialize uncategorized explicitly as null and selected Category as its UUID. Continue accepting/retrying already-frozen omission-based intents without inserting a field, normalizing UUID case, or reconstructing their bodies. Rename, option refresh, or selected-Category disappearance must never alter an existing intent.
- Use a POST-only legacy response parser/result variant for missing `categoryId`; do not weaken normal list/detail/PATCH parsers. Resolve that Project by UUID with a current GET before seeding a complete edit baseline or claiming a current relation. Missing is unknown, not null. If reconciliation fails, retain confirmed creation identity and show retry-read recovery, not a new create action. Also reconcile normal historical POST snapshots before treating them as current.
- Preserve dirty fields, selected ID, and explicit null across revision conflict/reload/reapply. A missing Category on save produces recovery feedback, never replacement selection. An uncertain create remains frozen until explicitly resolved/abandoned under existing safety rules.
- Keep [legacy Project model](../../src/features/projects/model.ts), fixtures, providers, and stored validators unchanged. Extend authenticated presentation through props/composition rather than making Category mandatory in legacy records.

### 3. Project editor and management UX (approval candidates)

- Preserve [ProjectFields](../../src/features/projects/ProjectFields.tsx), form-grid, modal, Korean labels, controls, spacing, focus handling, and existing Project actions. Provide an authenticated classification slot/props: replace the hardcoded `개발 분야` choice there with server Categories plus explicit `미분류` (null). Retain a separate `호환 범위` scope select with the existing two values and existing new-Project default `unity`. This is the current frontend default, not an inferred Category mapping or backend default. Legacy editor rendering remains unchanged.
- Propose one reusable Category-management modal/view opened from a secondary `카테고리 관리` action near the authenticated Category field and from the existing Projects header action area. Reuse shared Modal/Field/button/error/confirmation patterns; do not add a route or redesign Project screens. When opened from the editor, retain its draft in the owner and show only one active modal/focus trap. Closing management returns focus and the unchanged Project draft/selection.
- Management provides list, create-name input, rename action/form, and explicit delete confirmation. Use existing icon buttons/tooltips where appropriate. Show distinct loading, load failure with retry, empty, mutation pending, field error, and successful-but-refresh-failed states. No debug UUID/revision/audit metadata in normal UI.
- Category creation does not automatically select a new Category; the user selects it explicitly after reconciliation. Renames retain selection by UUID. If the selected ID becomes unavailable, keep a disabled/unavailable selection and clear error, never choose the first item or null automatically. Allow an explicit different selection or clearing; require resolution before submitting a new Category assignment. A list failure must not masquerade as an empty collection or reset the draft.
- Existing unrelated-field edits may retain an unchanged Category without requiring a successful list fetch; distinguish unknown availability from a confirmed missing selection. Frozen create retries remain exact even when selection availability changes.
- Allow Category assignment/change/clear for archived Projects using the same revision-based Project editor; do not enable Journal/Task/Milestone creation for archived Projects by implication.
- Initially show resolved Category in the existing Project detail information area, keeping scope separately labeled. Do not add new card rows or alter Home widgets in this Plan. Shared presentation receives optional Category display state from authenticated composition; existing cards, scope badges/icons, sidebar, and Topbar remain intact.

### 4. Conflict and error recovery

- `CATEGORY_NAME_CONFLICT`: show a name-field error, preserve typed name and Project draft; do not select the conflicting Category by name. Definitively rejected creation may start a reviewed new intent when the user changes the name; uncertain requests retain the old intent.
- `CATEGORY_IN_USE`: keep the row and show that active or archived Projects still use it and must be reassigned/cleared before deletion. Do not offer cascade deletion or claim local counts prove it unused.
- `REVISION_CONFLICT`: reload current Category by ID, retain proposed rename/delete context, show current state, and require renewed explicit submission/confirmation with current revision. No automatic overwrite or destructive retry; same-value rename is still a real revision mutation.
- `QUOTA_EXCEEDED`: explain the 100-Category creation limit without treating it as a timed rate limit. Keep create draft; existing rename/delete remain available. Server decides admission even if the local list suggests capacity. Preserve other transport/unknown-error handling and request ID diagnostics without exposing raw metadata as product content.
- 404 after stale rename/delete or Project assignment: refresh relevant Category state and preserve drafts. A repeated-delete 404 is reconciled as already unavailable, not parsed as a successful delete payload. Network uncertainty after rename/delete requires GET/list reconciliation before resubmitting with a new revision.
- Reuse existing 400 field feedback, explicit CSRF recovery, 401 same-identity recovery, disabled-account handling, cancellation, and network/5xx retry UX. Failures do not dismiss modals or erase inputs. Pending save disables duplicate commands and preserves navigation/unsaved-change guards.

### 5. Freshness and targeted invalidation

| Event                        | Required refresh                                                                                                                        | Intentionally untouched                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Category create              | Full Category list and returned-ID current read; options subscribe to this store                                                        | Project cursors, Overview, related-resource stores, Dashboard configuration              |
| Category rename              | Adopt current Category revision; invalidate/revalidate Category list/detail; subscribed editor/detail names update by UUID              | Project revision and all Project list/filter keys                                        |
| Category delete              | Confirm matching deleted ID, remove/invalidate Category state with epoch protection; revalidate selected references without replacement | Project relations (backend forbids used deletion), existing scope caches                 |
| Category-only Project PATCH  | Adopt updated Project, invalidate its detail and Project list snapshots without broad feature callback                                  | Scope counts, Task/Journal/Milestone/Link, Dashboard/options that do not expose Category |
| Other/mixed Project mutation | Preserve existing Project invalidation semantics                                                                                        | No new Category-dependent scope behavior                                                 |

- Category display joins current CategoryStore data at render time, not copied names frozen inside Project entity/query snapshots. Revalidate on Category-consuming view activation, management/editor opening, and browser focus with request deduplication; no real-time server push guarantee is assumed. Failed background refresh retains clearly stale known data with retry, not fabricated current names.
- Add a narrowly scoped Project invalidation path for Category-only PATCH while retaining existing broad invalidation for changes that already require it. Determine this from immutable sent dirty fields, not guessed response name/scope equality. Do not wire Category CRUD to current `projects.onInvalidate`, which fans out to Overview, Dashboard, Task, Journal, Milestone and selectors.
- Project list keys remain scope/status/query/page size; no Category query parameter, local loaded-page Category filter, or Dashboard schema field. Task/Journal/Milestone/Dashboard adapters still use Project UUID and current scope/archived rules, without CategoryStore dependencies. Link remains unaffected.

## Validation

### Static

- Run `npm test`, `npm run build`, `npm run check:boundaries`, `npm run check:docs`, and `npm run format:check`; record any existing formatting baseline separately without unrelated reformatting.
- Unit tests: Category schemas/UUID/safe revisions/full ordering and totals; create immutable raw-name key/body/window; name normalization boundaries; Category conflicts/quota/404; stale list versus rename/delete; session disposal; confirmed write versus failed refresh.
- Project tests: normal nullable field required, POST-only legacy omission, current-read reconciliation failure, omitted/null/UUID create and dirty PATCH, unchanged frozen legacy body/key, raw UUID preservation, archived assignment, revision reapply, no automatic substitution, no scope inference.
- Cache tests: rename updates names with unchanged Project revision, historical replay cannot resurrect rows, category-only edits have targeted fan-out, mixed Project edits preserve existing fan-out. Keep shared legacy model/fixture tests passing.
- Update API Project mocks throughout consuming suites to include nullable `categoryId`; retain explicit legacy replay fixtures only where valid. Add Category endpoint allowlists to authenticated test harnesses without relaxing storage/API isolation assertions.

### Runtime

- Extend Project browser coverage for Category management and editor integration: empty list, create, rename, delete, duplicate names, quota, in-use active/archived references, revision conflicts, pending double-click prevention, refresh failures, selected deletion, and Project drafts retained across management/failures.
- Exercise Project create with null/UUID, omitted legacy replay, relation change/clear on active and archived detail, expired/uncertain create replay, CSRF recovery, session expiration/account switch, late response after logout, and back/forward/close/refresh unsaved guards. Never expect browser reload to persist memory-only drafts in localStorage.
- Re-run auth, Project, Task, Journal (including Project-detail creation), Milestone, Link, Dashboard, restored-shell, and legacy browser suites. Check direct route/sidebar/mobile navigation and refresh for `/`, `/projects`, `/projects/:id`, `/tasks`, `/journals`, `/library`; assert scope URLs/configuration/requests and server UUID selectors unchanged.
- Capture before/after `/projects`, `/projects/:id`, Project editor and Category management at existing desktop/mobile/landscape test sizes. Compare against the current restored Project UI: only approved classification controls/display/management additions may differ; verify shell, cards, spacing, Korean text, focus, overflow, and modal geometry. Keep legacy visual baselines unchanged.
- Extend existing `tests/real/run.mjs` / Project validation flow for Category contracts using the disposable backend/OIDC/workspace harness, both Vite proxy and Nginx paths. Do not mutate the user's running workspace on port 8080. Recheck its OpenAPI as authority, and ensure the isolated backend exposes the same contract before acceptance runs.
- Real backend evidence must cover authenticated Category CRUD/normalization/conflicts/revision/quota, active AND archived in-use rejection, archived relation edits, omitted/null/UUID semantics, missing/foreign Category rejection, unchanged scope behavior, and replay after rename/deletion. Seed pre-deployment Project replay fixtures only through the isolated harness to verify omitted-field recovery; deterministic browser transport interruption tests cover uncertainty without pretending to simulate it through normal successful requests.
- Record commands, backend contract/version evidence, test totals, responsive screenshots, and failures/recovery in this Plan during execution. Do not treat OpenAPI inspection or mocked tests as proof that real mutations passed.

## Execution Sessions

All six sessions completed on 2026-09-14 after explicit approval. The execution sequence and gates are retained below; final results follow.

1. **Contract and store:** Recheck live schemas; implement Category API/store, lifecycle, immutable create intents, parsers, revision and stale-response tests. Gate: focused model/store tests pass.
2. **Project relation:** Extend API model/draft/serialization, POST replay reconciliation, and targeted Project invalidation. Gate: omitted/null/UUID, retries, archived and fan-out unit tests pass; legacy parsers unchanged.
3. **Editor selection:** Add composed Category field and separate scope input, loading/missing-option handling, draft guards. Gate: Project browser create/edit and unchanged-scope tests pass.
4. **Management:** Add reusable management surface, create/rename/delete, conflicts/quota/session recovery. Gate: CRUD/error/draft/pending browser coverage passes.
5. **Display and compatibility:** Wire detail name lookup/focus freshness; validate targeted invalidation and related suites; desktop/mobile/landscape visual comparison. Gate: no unrelated UI, scope, selector, or legacy regressions.
6. **Real acceptance and documentation:** Run full static/browser checks and isolated Vite/Nginx backend scenarios; record evidence, update current architecture/testing documentation only for implemented behavior. Mark completed only after all criteria pass.

## Approval Candidates and Deferred Work

- Approval includes the proposed management entry points, single-active-modal flow, `개발 분야` Category / `호환 범위` scope controls, explicit null for new uncategorized create intents, no auto-selection after create, and detail-only initial Category display. These are frontend proposals, not backend contract claims.
- No unresolved backend contract question currently blocks this scope: the live schema specifies identity, ownership, ordering, normalization, revisions, response shapes, nullable relation, defaults, archived edits and in-use deletion. Real authenticated behavior and contract drift remain validation gates, not assumed results.
- Category filtering, Home/Dashboard Category presentation/configuration, additional card display, management routes, default Category provisioning, and eventual scope replacement remain deferred to separate approval. The accepted Decision is not rewritten by this Plan.

## Completion Criteria

- [x] Category CRUD and Project selection/display use server UUIDs and independent stores with authenticated lifecycle protection.
- [x] Normal nullable response parsing and legacy create replay compatibility pass; all retry intents remain immutable.
- [x] Required errors, drafts, archived edits, revision conflicts and targeted freshness behave as planned.
- [x] Existing scope APIs/filters, completed feature behavior, shell/navigation and legacy storage isolation remain unchanged.
- [x] Required static, browser, responsive visual and real Vite/Nginx validation passes with evidence recorded, with pre-existing global formatting warnings isolated as specified above.
- [x] Related documentation and Plan index are updated after implementation; no completion based solely on proposal verification.

## Execution Evidence

### Session results

| Session | Result                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Rechecked live OpenAPI. Added Project-owned Category models/store, frozen raw-name intents, full-list validation, cancellation/epoch protection and focused model/store tests (initial gate: 5 passed).                                        |
| 2       | Added nullable Project relation, POST-only historical parser, current-read reconciliation with confirmed-ID recovery, immutable omitted-body compatibility and Category-only invalidation (Project unit gate: 15 passed).                      |
| 3       | Composed server `개발 분야` and separate `호환 범위` without legacy model changes. Existing Project browser suite: 21 passed; new archived assignment/clear test: 1 passed.                                                                    |
| 4       | Added reusable single-active-modal management, independent memory, error/revision/quota/CSRF recovery and guarded draft transitions. Initial CRUD/error gate: 4 passed after focus restoration fix.                                            |
| 5       | Added detail-only UUID-to-name lookup and focus freshness, retained missing selections, checked unrelated feature integrations and original-region visual parity at three sizes. Final full Project suite: 31 passed; shell suite: 17 passed.  |
| 6       | Full static/browser acceptance, disposable real Vite/Nginx acceptance and current architecture/development documentation completed. Final Category subset: 10 passed; final Project visual subset: 3 passed after the last spacing adjustment. |

Implementation refinement: because Category GET returns the entire collection, its current snapshot resolves a creation replay's returned ID or its absence without a redundant per-ID GET. Mutation snapshots never seed name authority. Direct Category GET is used for revision/uncertain-write reconciliation; no separate detail cache or copied Project Category names is needed. This preserves the planned freshness guarantees while reducing state and requests.

### Final validation

- `npm test`: 30 files, **166 tests passed**, including duplicate Category create and retired-session mutation publication protection.
- `npm run build`: TypeScript and production Vite build passed. Final Nginx build produced the same `index-BG2kzzwe.js` / `index-Bh0DEwtS.css` assets as the local build.
- `npm run check:boundaries`: 188 source files / 692 local imports passed. `npm run check:docs`: links resolve in 38 documents.
- Feature browser commands used `npm run test:e2e -- --config playwright.<suite>.config.ts --workers=2 --output test-results/category-<suite>`: auth **20**, Projects **31**, Tasks **21**, Journals **15**, Milestones **13**, Links **16**, Dashboard **18**, shell **17** passed. The default legacy suite with `--output test-results/category-legacy` passed **35**. Total: **186 distinct browser tests**, excluding repeat runs.
- Responsive comparisons cover 1440x1000, 390x844 and 844x390. Approved Category controls/rows are excluded only from unchanged-region pixel comparisons, not whole-page assertions; actual editor, management, list and detail screenshots are also captured and visually inspected. Final artifacts: `test-results/category-final-shell/`; full shell/navigation/font evidence: `test-results/category-shell/`.
- `node tests/real/run.mjs --categories` and `node tests/real/run.mjs --categories --nginx` passed. Nginx was rebuilt and revalidated after final UI changes. The disposable backend's Category/Project paths and schemas matched live port 8080 exactly; DB migrations through V14 applied. Real CRUD, raw-name normalization/idempotency, duplicate-name/revision/quota errors, active AND archived in-use rejection, archived assignment/clear, missing/foreign access, Project scope preservation and legacy omitted-field replay all passed.
- Both real runs passed session/proxy acceptance (signed OIDC/PKCE, refresh, CSRF, Origin rejection, logout, disabled account, SPA routing and no excluded API requests). Evidence: `.auth-validation/{vite,nginx}/category-result.json`, `result.json`, and responsive `category-detail-*.png`. Only disposable test DBs were written; the port-8080 workspace was not mutated.
- Explicit Prettier checks passed for every file changed by this implementation. Repository-wide `npm run format:check` was run and still reports unrelated pre-existing formatting/line-ending warnings; those files were not mass-reformatted. This is the baseline exception required by the Static section, not a claim that the global command exited successfully.

### Recovery record

- Sandboxed esbuild could not read the parent configuration path. Re-ran the same tests/build with approved escalation; implementation failures were not suppressed.
- Management-to-editor focus initially returned to the first input. Reproduced in browser, restored Category focus after modal initialization, and reran CRUD/focus tests successfully.
- A Milestone scope-regression test still selected `server` through the old `개발 분야` label. Updated only its selector to the approved `호환 범위`; its scope mutation and equal-revision presentation assertions remain and passed.
- Initial cold shell tests encountered blank entry pages while original/authenticated Vite configurations shared an optimizer cache. Separated the legacy test cache, then passed the complete 17-test shell run and final three-size Project visual run. No app fallback or weakened visibility assertion was introduced.
- Browser artifacts initially shared the default output root and could erase previous screenshots. Final suites use separate output directories; no production behavior changed.
- A confirmed creation followed by read failure is retained as confirmed state and retries only reads. Missing Category assignment remains editable for explicit correction, and switching an unsaved management draft to a different operation requires confirmation.

Current architecture and development instructions now describe these implemented boundaries and validation commands. Category filtering, Dashboard Category configuration, defaults, and scope replacement remain deferred. The accepted Decision and all other completed Plan statuses are unchanged.
