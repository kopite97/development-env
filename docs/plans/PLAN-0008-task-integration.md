# PLAN-0008: Task Integration Without UI Redesign

Status: `completed`

## Goal

Replace authenticated Task localStorage/fixture authority and synchronous local mutations with the existing backend Task API. Preserve the established Task page, board, trash and editor visual design, layout, interactions, responsive behavior, accessibility and successful user flows. Adapt their data/input/output boundaries instead of replacing them with simpler screens. Reuse the Project and Overview foundation from [PLAN-0007](PLAN-0007-project-overview-integration.md) and authentication/HTTP from [PLAN-0006](PLAN-0006-frontend-auth-http-integration.md).

Approved for execution on 2026-09-13, including all contract/approval candidates and temporary Task-only Home behavior. Execute sessions in order; visual and interaction parity is required.

## Scope

- Include authenticated Task page, live board, Home Task board and selected-Project Task section; Task list/detail/stats/create/PATCH/soft-delete/restore; server Project selection; async state, cancellation, invalidation, tests and execution evidence.
- Preserve existing Task presentation and navigation. Pure presentation extraction, injected inputs/callbacks, async result types and small additive loading/pending/error/pagination controls are in scope. Do not discard functionality or replace the UI merely to simplify integration.
- Preserve `devspace.tasks.v1` and all other legacy storage byte-for-byte. API mode neither reads them as authority nor imports, deletes, migrates, uploads or resolves their fixture/name identities.
- Reuse installed React/TypeScript/Vite/Vitest/Playwright and existing native HTTP/cache primitives; no new dependency is proposed. No new frontend environment variable is expected. If approved execution introduces one, update both frontend root `.env` and `.env.example` with safe values/examples, retaining existing configuration.
- Exclude Journal, Milestone, Link and Dashboard APIs, Dashboard defaults/layout persistence, excluded business providers, backend source/security/contract changes, permanent Task deletion, bulk operations, new product features, global visual redesign and live deployment. Retain the isolated legacy harness and its workflows. Presentation-only reuse of a frame does not authorize its legacy providers or Dashboard API.

### Inspection baseline and source authority

Inspected on 2026-09-13 against frontend HEAD `75e679358e482c64f5e79ac7699948029ae3d6d2` plus completed, uncommitted PLAN-0006/0007 work, and backend HEAD `cdd4bf01aaa3ff7e7a68802e74a88a93b1938379` plus its pre-existing contract/business changes. Recheck working trees before execution and preserve those changes. HEAD alone is not the inspected source state.

Backend source and reviewed generated `.gradle/backend-openapi-review/after.json` in the sibling checkout establish the contract:

- [TaskController](../../../backend/src/main/java/com/kopite/devspace/task/presentation/TaskController.java), [TaskResponse](../../../backend/src/main/java/com/kopite/devspace/task/presentation/dto/TaskResponse.java), [create DTO](../../../backend/src/main/java/com/kopite/devspace/task/presentation/dto/CreateTaskRequest.java), [update DTO](../../../backend/src/main/java/com/kopite/devspace/task/presentation/dto/UpdateTaskRequest.java), [restore DTO](../../../backend/src/main/java/com/kopite/devspace/task/presentation/dto/RestoreTaskRequest.java), [stats DTO](../../../backend/src/main/java/com/kopite/devspace/task/presentation/dto/TaskStatsResponse.java).
- [Query service](../../../backend/src/main/java/com/kopite/devspace/task/application/query/TaskQueryService.java), [list filter](../../../backend/src/main/java/com/kopite/devspace/task/application/query/TaskListFilter.java), [search adapter](../../../backend/src/main/java/com/kopite/devspace/task/infrastructure/persistence/TaskSearchAdapter.java), [command service](../../../backend/src/main/java/com/kopite/devspace/task/application/command/TaskCommandService.java), [creation fingerprint](../../../backend/src/main/java/com/kopite/devspace/task/application/command/TaskRequestHash.java), [domain values](../../../backend/src/main/java/com/kopite/devspace/task/domain/TaskValues.java).
- [Task API tests](../../../backend/src/test/java/com/kopite/devspace/TaskApiTests.java), [command tests](../../../backend/src/test/java/com/kopite/devspace/TaskCommandTests.java), [OpenAPI tests](../../../backend/src/test/java/com/kopite/devspace/TaskOpenApiTests.java), [implemented contract review](../../../backend/docs/reviews/2026-09-13-backend-openapi-contract-review.md).

Frontend evidence:

- [Task model](../../src/features/tasks/model.ts) contains optional Project IDs and runtime name/fixture fallback. [TasksProvider](../../src/features/tasks/TasksProvider.tsx) reads a complete local array and returns synchronous persistence results. Neither is API authority.
- [TaskManager](../../src/features/tasks/TaskManager.tsx) combines board, create/edit and trash, filters by concatenated title/Project name, slices before grouping, and derives counts from loaded arrays. [TaskBoard](../../src/features/tasks/TaskBoard.tsx) already has reusable card markup, three columns, drag/drop, status selects and mobile horizontal scroll. [TaskEditor](../../src/features/tasks/TaskEditor.tsx) already provides the intended fields/modal/discard UX, but generates Task UUIDs and serializes local Project display fields.
- [TasksPage](../../src/pages/TasksPage.tsx), [PageScaffold](../../src/shared/ui/PageScaffold.tsx), [Task styles](../../src/features/tasks/styles.css), [ProjectSelect](../../src/features/projects/ProjectSelect.tsx), [legacy Home renderer](../../src/pages/home/widgetRenderers.tsx) and [legacy Project detail](../../src/pages/ProjectDetailPage.tsx) establish visual and interaction references.
- [PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx) currently exposes Projects and root Overview; `/tasks` is pending. [AuthApp](../../src/app/auth/AuthApp.tsx) owns authenticated navigation and Project-specific draft guards. The legacy [layout](../../src/app/layouts/AppLayout.tsx) and [scaffold hook](../../src/app/layouts/usePageScaffold.tsx) still depend on local providers. Wiring them unchanged would violate authority isolation.

## Changes

1. Separate validated API Task records and editable drafts from the fixture-bearing legacy model; add explicit presentation and request adapters.
2. Extract provider-independent inputs from existing Task presentation, preserving its DOM/CSS structure and flows. Supply an authenticated controller and keep a legacy adapter for existing regressions.
3. Add filter-bound paginated live/trash queries, direct Task reconciliation and independent stats, using server Project relations.
4. Replace local saves with explicit async create/edit/status/delete/restore operations, revision conflicts and immutable creation intents.
5. Compose Task, Project and Overview invalidation and session/draft lifecycles through app/pages without new cross-feature dependency exceptions.
6. Validate visual/interaction parity, API correctness and real Vite/Nginx/backend boundaries; document final evidence only after approved execution.

## Task contract and frontend models

### Operations

All requests remain relative, same-origin and authenticated through the current session. Mutations use the existing CSRF/Origin protections.

| Operation                              | Contract                                                                                                                                                                                                                                                   | Response / relevant errors                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/api/v1/tasks`                    | scope=all/unity/server (default all), optional Project UUID, projectStatus=all/active/archived (default all), query (default empty), optional status=todo/doing/done, deleted=true/false (default false), limit 1–100 (default 20), optional opaque cursor | 200 `{items,total,nextCursor}`; 400 validation/invalid cursor; 404 missing/inaccessible selected Project                             |
| GET `/api/v1/tasks/{id}`               | Server Task UUID, independent of list membership                                                                                                                                                                                                           | 200 full Task **including trash**; 400 malformed ID; 404 missing/inaccessible                                                        |
| GET `/api/v1/tasks/stats`              | Only scope, optional projectId, projectStatus and query                                                                                                                                                                                                    | 200 `{counts:{todo,doing,done},total,asOf}`; always excludes deleted Tasks; 400 unsupported/invalid parameters; 404 selected Project |
| POST `/api/v1/tasks`                   | Required title/projectId; optional description/status/priority/tag; required visible-ASCII Idempotency-Key, 1–128 characters                                                                                                                               | 201 full Task or original creation replay; 409 PROJECT_ARCHIVED / IDEMPOTENCY_KEY_REUSED                                             |
| PATCH `/api/v1/tasks/{id}`             | Required expected revision; supplied writable fields only                                                                                                                                                                                                  | 200 full Task; 409 REVISION_CONFLICT / RESOURCE_DELETED / PROJECT_ARCHIVED                                                           |
| DELETE `/api/v1/tasks/{id}?revision=N` | Revision is a query parameter, not a JSON body; this is soft delete                                                                                                                                                                                        | **200 full Task**, not 204; 409 REVISION_CONFLICT / INVALID_RESOURCE_STATE                                                           |
| POST `/api/v1/tasks/{id}/restore`      | JSON `{revision:N}` only; no creation Idempotency-Key                                                                                                                                                                                                      | **200 full Task**; 409 REVISION_CONFLICT / INVALID_RESOURCE_STATE                                                                    |

Common errors retain 400 VALIDATION_ERROR, 401 AUTH_REQUIRED, typed 403 ACCOUNT_DISABLED, mutation CSRF_INVALID, 404 RESOURCE_NOT_FOUND and server failures. Unknown 403 is an ordinary forbidden error, not assumed expiration. Do not parse DELETE/restore as bodyless success or invent a permanent-delete endpoint.

### Model and DTO mapping

| Backend field             | API model / existing presentation                                              | Write policy                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| id                        | Validated server Task UUID, preferably Task-owned branded identity             | Never generate a resource UUID or adopt a fixture ID                                                          |
| revision                  | Positive safe integer, at most 9007199254740991                                | Captured expected revision for PATCH/delete/restore; never increment locally                                  |
| createdAt / updatedAt     | Required validated server timestamps                                           | Read-only audit metadata; no browser-generated replacements                                                   |
| title / description / tag | Existing editor fields and Task card text                                      | Title trimmed/nonblank, max 160 UTF-16 units; description max 10000, no blanket trimming; tag trimmed, max 40 |
| projectId                 | Required canonical server Project UUID                                         | Writable only as the actual Project relation, never inferred from names                                       |
| projectName               | Derived server display field; adapt to existing card `project` label if needed | Never write project/projectName or resolve identity by it                                                     |
| scope                     | Derived server unity/server classification                                     | Never writable on Task; do not assign it from a fixture or a stale selected option                            |
| status                    | todo/doing/done, preserving current labels/columns                             | PATCH status for drag/drop/select/completion/reopen; no separate complete endpoint                            |
| priority                  | API normal/high; UI `보통` ↔ normal, `높음` ↔ high                             | Exact bidirectional mapping; retain labels, flag and styling                                                  |
| deletedAt                 | Required nullable server timestamp                                             | null is live, timestamp is trash; set only by delete/restore, never client time                               |

Use a separate API-only `ApiTask`/draft/presentation boundary. Do not reuse `resolveTask`, `legacyProjectId`, fixture imports or optional-ID legacy validation in API mode. Pure Task presentation types can be extracted within Tasks and shared by legacy/API adapters without moving domain logic into `shared`.

Validate complete Task/page/stats shapes, all status buckets even zero, safe nonnegative totals, enums, UUIDs and timestamps. Malformed responses become protocol errors, not empty data or fixture fallback. Extra response metadata is never spread into write bodies. Stats does not echo filters; bind its response to the captured query key/sequence. `asOf` is observation time, not a mutation revision or commit watermark.

POST allowlist is title/projectId/description/status/priority/tag. Optional defaults are empty description/tag, todo, normal. Propose a consistent full editor serializer with explicit optional fields, then freeze its serialized values/presence for retry. Preserve current title/tag trimming **before** creating the immutable request. PATCH contains expected revision and only dirty writable fields; omit unchanged relation/display data. Explicit null, unknown and duplicate fields are rejected by the backend. Empty optional text clears it. Revision-only/same-value PATCH advances revision, so skip a no-change save or same-column drop rather than using it as refresh.

## Preserve the existing frontend

### Presentation and composition contract

- Before editing runtime code, capture the existing legacy Task page, Home board, Project Task section, populated/empty trash and editor at desktop, short desktop, mobile and landscape sizes. Use equivalent explicit test data for API comparisons. Record intended contract-driven differences separately; do not bless a redesigned screenshot as the new baseline.
- Keep `TasksPage`/`PageScaffold`/`content-panel`, welcome/filter/search/reset placement, TaskManager action row, TaskBoard classes/card hierarchy/status headings, priority/tag visuals, trash modal/restore rows, and the wide editor/form grid. Preserve Korean user-facing labels and existing fields: title, Project, status, priority, tag and description.
- Prefer splitting `TaskManager` into a view plus injected controller inputs; adapt TaskBoard with per-column data/totals/read states and per-Task pending operations. Adapt TaskEditor into a draft form that awaits a typed async result. Keep a legacy adapter so old callers/tests retain local behavior. Do not feed API data through TasksProvider or fabricate complete legacy Project/Task arrays.
- Preserve title-to-edit, drag/drop across statuses, touch/keyboard status select, create/save-close, delete-confirm-close, trash restore, cancel/discard and search reset. Keep current focus trapping/restoration, Escape behavior, beforeunload guard, 44px touch controls, horizontal board scroll and no page-level overflow. Pending UI should disable conflicting actions, not remove them or the surrounding screen.
- The authenticated `/tasks` route is currently pending, but that does **not** make the small PLAN-0007 auth card the Task design baseline. Render the existing Task page in its established shell/content widths. Extract presentation-only layout/Sidebar/Topbar inputs as needed instead of mounting their local providers. Retain navigation entries, breadcrumbs and mobile menu behavior; supply authenticated identity and real Overview counters. Preserve pending destinations for excluded features. Scope this mechanical composition work to Task integration; do not redesign existing Project/Overview or sign-in screens.
- Existing auth `.auth-card`/Project CSS has broad input/button rules. Ensure reused Task markup is not accidentally restyled by that wrapper; preserve the Task/modal stylesheet cascade and compare screenshots. This is boundary isolation, not permission to create a new visual system.
- `useUnsavedChanges` registers a shared navigation guard, while AuthApp currently checks only Project draft memory. Compose a single guard decision for Task and Project drafts, including menus, filter changes, Back/Forward and modal close. Do not double-prompt or let a guard block forced auth cleanup. Pending/unconfirmed writes also need ordinary-navigation protection even if no field is dirty.

### Home and Project detail

- Reuse the existing Task board card/frame and manager interactions on authenticated Home beside the current Overview surface. Do not mount `HomePage`/the complete widget registry with excluded features or a Dashboard provider. No Dashboard GET/PATCH/default creation or saved-layout localStorage read is allowed.
- Proposed Home defaults: existing board title/styling and Unity scope, with a bounded fallback of 20 Tasks when no caller limit exists. Accept existing explicit board limits (1–20) through a pure composition input. Offer the existing Task-page navigation to see the full board. This is a Task-only Home surface, not a recreation/removal of legacy Dashboard functionality; the legacy Dashboard harness stays intact.
- The Home limit is **one total budget across all columns**, as the existing manager slices before grouping. Never request N rows independently for each of three columns and display 3N. Do not reinterpret Home's widget-search UI as Task search unless the Task surface explicitly supplies that filter.
- Add/reuse the existing linked Task section on API Project detail using its verified server Project UUID. Keep PLAN-0007 detail information/counters and all pending non-Task sections. Preserve the existing detail board/status controls; reuse the same editor path where exposed, rather than creating a second write implementation. A selected Project overrides ambient scope in presentation by sending scope=all; adapters still support the backend's scope/project intersection semantics.
- Neither a Project absent from page one nor an empty Task page means the selected Project is missing. Verify direct Project detail first; never reuse the legacy widget renderer's array-membership not-found check.

## Queries, pagination, board, trash and stats

### Query strategies

| Surface              | Proposed request strategy                                                                                                                                           | Counts and limits                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Task page live board | Three separate status-filtered GET lists; deleted=false, projectStatus=all, current scope/query and optional selected Project; 20 per column, independent Load more | Independent cursors/read errors per column; stats supplies full column counts and matching search total     |
| Home limited board   | One GET with **status omitted**, deleted=false, matching Project/scope and limit=N; group the returned globally ordered items into columns                          | At most N total cards across all columns; no automatic continuation past budget; stats remains untruncated  |
| Project detail board | Verify server Project detail, then same paged live board with projectId=UUID, scope=all, projectStatus=all                                                          | No fixture ID or complete-Project-array assumption; archived selected Project remains usable                |
| Trash modal          | GET deleted=true, status omitted, current scope/Project and projectStatus=all; 20-row cursor pages                                                                  | Separate query state and server matching total; no use of live lists or stats to infer trash                |
| Task stats           | GET `/tasks/stats` with scope/projectId/projectStatus/query only                                                                                                    | All live matching Tasks, including archived Projects by default; independent of loaded pages or Home budget |

Preserve the existing trash behavior that ignores live board search: send query empty for trash unless a future approved UI adds trash search. The trash button's count uses this same query's server `total`. Propose a deduplicated limit=1 deleted-list read for the badge before the modal opens, and limit=20 when opening it; these are different cursor keys, not a cursor handoff. Show count pending/unavailable instead of zero when unverified. Restore invalidates both.

- URL scope/q and existing navigation remain the Task page filter inputs. Propose 250 ms debounced server search with cancellation. Backend search is literal case-insensitive substring of **title OR Project name**, not description/tag and not the legacy concatenated string. Document/test cross-field phrase differences; do not filter already-loaded pages locally and call that complete search. Encode `%`, `_`, `!`, spaces and Unicode without wildcard substitution.
- Omit status to request all statuses; `status=all` is invalid. Send strict deleted=true/false. Use explicit projectStatus=all to preserve Tasks of archived Projects; the Project list's active/archived tab must not silently become a Task Project filter.
- Each list key includes User/Workspace generation, scope, projectId/null, projectStatus, exact query, status/null, deleted, limit and its owned cursor chain. Encode opaque cursors through URLSearchParams and omit the first cursor. Cursors bind workspace and every filter/limit; no transplant among columns, trash, Home or Project views.
- Preserve createdAt DESC/id DESC order and deduplicate Task UUIDs when appending. Only nextCursor=null ends a chain; neither loaded count nor total does. No unbounded background crawl or assumption that pages form a snapshot. A moved Task can appear in stale pages from another column: canonical status/deleted state plus invalidation must prevent duplicate or wrong-column cards.
- Filter/limit/generation changes reset affected chains. One request per query/cursor; ignore stale successes/errors even if abort is ignored. Later-page failure keeps valid rows and offers retry of that cursor. INVALID_CURSOR/repeated cursor offers explicit first-page restart, never an automatic loop. First-load failure is not an empty board/trash message.
- GET by Task UUID supplies current reconciliation/editor data, including trashed Tasks, independently of lists. On opening a live editor, preserve modal shape and wait for fresh direct detail before enabling writes; if the Task moved to trash, show its actual state with restore/trash recovery, not an editable stale card. No new Task-detail route is required for this internal fetch.

### Stats versus Overview

`/tasks/stats` returns `{counts:{todo,doing,done},total,asOf}` with every status key. It accepts only scope/projectId/projectStatus/query; do not send status/deleted/limit/cursor or repeated parameters. Its query is meaningful: Task-page search statistics use the same server search as the columns. Stats always excludes deleted Tasks and is not a trash-count endpoint.

Keep full status counts in existing column badge positions and matching totals in the existing search-result position, optionally showing loaded counts separately. Do not replace an unavailable stats result with loaded array lengths. On a limited Home board, explain total versus displayed counts without expanding beyond N cards. Valid zeros are distinct from unavailable/loading/stale data.

PLAN-0007 Overview remains workspace/scope/Project business aggregation independent of search. It does not accept Task search/status/deleted filters. Do not replace Overview with search-filtered Task stats or send those filters to it. Matching unfiltered stats and Overview can settle at different times; they are not one atomic snapshot. Retain usable board rows if stats fails, and usable counters if a column fails.

## Project relation strategy

- Project integration is the canonical source of server Project IDs. App/pages inject paginated active options, selected-ID lookup and Project navigation into Task presentation; Task logic must not import the new Project store/model directly in violation of the [existing dependency decision](../decisions/feature-dependencies.md). A Task-owned minimal option/input contract is acceptable; keep Project validation/ownership lookup in Projects and composition in app/pages. No new cross-feature allowlist entry is proposed.
- Adapt the existing ProjectSelect visual control to narrow presentation options or an injected selection slot. Preserve its label, native selection behavior and archived suffix. Add loading/retry and an adjacent Load more control for active Project options; preserve selected options independently of loaded pages. Do not invent missing legacy Project fields just to satisfy a broad `Project[]` prop.
- On creation, require a selected active owned server Project. When no active Projects exist, keep the editor/action context, explain why save is unavailable, and provide existing Project navigation; never auto-create/import a Project. Do not silently reassign a draft when filters change or a Project is archived.
- On edit, direct-resolve the Task's existing Project UUID even if it is absent from active options. An existing archived relation remains selectable/retained and ordinary edits/status changes are allowed. Reassignment to a different Project requires an active owned target; omit unchanged projectId from PATCH. Check the relation against the captured baseline, not whether the currently selected option is simply marked archived.
- A Project archived after selection produces PROJECT_ARCHIVED on create/reassignment. Refresh Project eligibility, retain all Task draft fields, explain the rejected target and require an explicit eligible choice. This code is not REVISION_CONFLICT or session expiration. Restore of a Task in an archived Project remains allowed and does not change its relation/status.
- `projectName` and scope on Task responses are derived display data. Rendering already-loaded Tasks does not require loading every Project or a per-card Project GET. Never turn a Task's projectName/scope into a fabricated full Project entity or infer a Project revision/status from them.
- Project rename/scope/archive mutations invalidate relevant Task lists/stats and relation options through app composition, even when Task revision does not change. Fresh Task reads at the **same Task revision** must refresh derived Project display data. Older creation replays must not restore stale Project names/scopes or undo reassignment/deletion; use read epochs and direct reconciliation, not a revision-only cache tie rule.

## Async mutations, conflicts and creation intents

### Existing flows with asynchronous results

Convert save/delete/restore/status callbacks to promises or explicit operation results. Await success before closing the editor, moving/removing a card, removing a trash row or clearing a draft. Do not treat a Promise as the old boolean return. Preserve the existing successful flow rather than adding mandatory confirmation screens for ordinary saves.

- Creation: validate the draft, acquire CSRF through the current client, POST exactly the frozen writable body, require validated 201 and adopt the server UUID/revision/audit data. Close the modal on confirmed success as before and refresh the relevant surface. A new Task may be outside current filters/budget; do not force it into unrelated columns or change filters silently.
- Edit: fresh baseline plus dirty-field PATCH and captured revision. Preserve untouched description/tag/relation/status; no response spreading. A no-op save may close as unchanged without a write. Keep draft and field-specific errors on validation/network/forbidden/conflict failures.
- Status change: keep drag/drop and select interaction, submit only revision/status and serialize mutations per Task. Maintain the confirmed card in its previous column while pending, with visible feedback; move after validated success. Failure restores the confirmed select/drag position and leaves a retryable notice. Clear drag state on route/session teardown. Never let a stale drag operation overwrite a newer editor save.
- Delete: retain the existing editor confirmation and soft-delete language. Send DELETE with captured revision in the query; await full 200 with deletedAt set before closing/removing. Do not send edited form fields as part of deletion. If deletion fails, preserve the editor draft. No irreversible purge action is added.
- Restore: keep the existing trash row's restore action, disable just conflicting operations while pending, POST only revision and require full 200 with deletedAt null. On success remove from trash and refresh live views/stats; it may fall outside current filters. Restore retains its previous status/priority/relation, including an archived Project, and requires no active-target selector.
- Check full response ID, expected HTTP status and expected live/trash transition. Never mint timestamps/revisions/deletedAt in the browser. Confirmed mutation followed by failed refresh remains confirmed success plus stale/unavailable read state, not a reason to repeat the write.

### Revision and resource-state conflicts

REVISION_CONFLICT preserves the captured draft/intended status and loads current Task detail. Show latest revision and changed values in the existing modal/notice treatment, then offer explicit discard/reload or review/reapplication of selected dirty fields against the fresh revision. Never increment expected revision locally, silently overwrite, or auto-resubmit. Repeated conflict repeats review; failed reload retains the draft with read retry. A 404 disables writes and offers existing navigation recovery.

RESOURCE_DELETED means PATCH cannot edit trash. INVALID_RESOURCE_STATE means a delete/restore targets the wrong current state. Reconcile through direct detail and show actual live/trash state; do not report an unrelated revision conflict or automatically issue the opposite mutation. Revision checks precede state conflicts on delete/restore, so code and current detail both matter. State already matching intent after an uncertain response is useful evidence, not proof that this particular write succeeded.

Timeout/network/5xx/malformed-success after dispatch can be ambiguous. Invalidate reads and reconcile by UUID for PATCH/status/delete/restore, without automatic replay. Require a new deliberate, revision-checked action after reviewing current state. There is no creation-style idempotency contract on these operations. Per-Task pending guards must cover board, editor and trash instances within the private session.

### Creation Idempotency-Key

- Generate an operation key, not a Task ID. Store immutable body/key/start time/owning identity in memory before dispatch; preserve the exact values and optional-field presence on explicit retry. Backend fingerprinting uses command values, including raw text and omission distinctions; re-trimming/re-defaulting after a failure can change the request.
- Retry the same intent only within the backend's 24-hour window. Double submit/overlapping CSRF acquisition cannot create separate keys or requests. Ambiguous creation locks that recorded payload; editing into a genuinely new creation requires explicit abandonment/reconciliation, not silent key rotation. A definite pre-creation validation rejection may unlock correction with a new explicit submission.
- IDEMPOTENCY_KEY_REUSED is a distinct error: preserve the draft, explain the mismatch and offer reconciliation/abandonment. Never automatically retry with a new key.
- A replay can return the **original** creation snapshot after Task edits, soft deletion, restore, reassignment or Project archive. Reconcile its server Task UUID directly before enabling further writes or treating it as a current live card. Do not resurrect a deleted Task, downgrade revision, reset derived Project metadata or increment counters on replay. Replaying the same accepted creation remains possible after Project archive; do not block that retry solely because new creation would be forbidden there.
- After 24 hours, or if memory was lost on reload/logout/account change, do not promise deduplication or auto-submit. Protect ordinary unload/navigation while unresolved and explain that the Task may already exist; require review before a consciously new creation. No localStorage/sessionStorage recovery or automatic import is proposed.

## Session, cache and invalidation

- Create Task controllers only after authenticated `/me`; inject the **existing** AuthSession client/lifecycle and capture generation before queueing, token acquisition or dispatch. Do not create a second auth session, cache cookies or weaken Origin/CSRF checks.
- Use per-query sequence/AbortController, current route/filter ownership and mutation invalidation epochs in addition to auth generation. Check them before publishing rows/stats/errors, changing modal/pending state or navigating. A transport that ignores abort must still be unable to publish old data; stale same-generation reads cannot undo a confirmed mutation.
- Keep a memory-only feature cache with canonical Task UUIDs, direct-detail entries, separate status/Home/trash page chains and stats keys. Queries hold ordered IDs/server total/cursor/read state; invalidate inactive entries without fetching all combinations. Release abandoned chains/subscriptions and bound retained inactive cache entries; never crawl every Task/Project to rebuild local authority.
- Merge authoritative Task fields by revision, but handle fresh same-revision Project display changes explicitly using current read order/epoch. Creation replay is not a fresh detail read. List absence/eviction never proves deletion or missing identity.
- After every confirmed Task mutation, conservatively invalidate all cached Task live/trash/Home/Project lists, stats and direct detail in the User/Workspace partition, then seed confirmed data and refresh displayed queries. Reset cursor chains. Invalidate Overview through app composition; create/delete/restore/reassignment/status may affect different buckets/scopes. Do not apply optimistic total arithmetic.
- Conflict/ambiguous mutation also invalidates and reconciles relevant reads. Keep successful saves distinct from failed post-save refresh. Overview, stats and lists settle independently with stale/loading indications.
- Extend PLAN-0007's Project invalidation callback by composition so it refreshes Task queries/options **and** existing Overview, without replacing either subscriber or importing Tasks into Projects. Project rename affects Task search/projectName; scope/archive affects filter/stats eligibility even at unchanged Task revision. Task mutations do not synthesize Project revision/progress updates.
- App-owned detached Task draft/creation-intent handoff may survive same-identity verification only. Hide private UI and cancel old attempts during checking; restore only after `/me` confirms the identical User/Workspace. Preserve no queued dispatch. Bootstrap error keeps handoff hidden; login/logout/401/disabled/account change destroys it, with guards unable to block cleanup.
- Generalize/inject the existing Project-named bounded security-recovery entry point for Task operations; preserve Project/logout regressions. CSRF_INVALID permits one deduplicated verification plus fresh token and an **explicit** retry by the same identity. Repeated rejection is a configuration error; no mutation replay loop. Overlapping Task/Project recovery must not let one operation replay another. No secret-bearing logs/artifacts.
- Resumption/manual refresh discovers external changes. No polling/live synchronization promise. Existing payload-free cross-tab auth hints remain unchanged.

## Legacy storage and component compatibility

`devspace.tasks.v1` remains untouched, including malformed JSON, optional/UUID-shaped Project IDs and custom local records. Authenticated API mode never reads it, resolves its Task/Project names, uploads it, assigns ownership or deletes it. All six legacy business keys and unrelated sentinels remain preserved. A future migration requires another approved Plan.

Keep the old provider/model/fixtures behind the legacy test entry. Shared Task presentation may serve both adapters, but mode selection happens in composition: no storage/network fallback inside a view, no union cache containing local and server identities, and no production demo selector. Preserve legacy CRUD/navigation/accessibility tests when extracting UI rather than deleting or weakening them.

## Validation

### Static

During **Plan creation only**, validate this document/index formatting, links and scope. Runtime work does not apply until approval because no application change is authorized now.

After approval, require TypeScript/build, `npm test`, `npm run check:boundaries`, `npm run check:docs`, affected-file Prettier and production artifact isolation. Update the artifact checker only as needed to permit safe Task presentation/API code while rejecting legacy authority and excluded providers. No dependency exception or fixture fallback may be introduced to pass it. Preserve unrelated existing formatting/source changes.

### Runtime and visual acceptance after approval

1. Capture/compare visual baselines from existing Task UI with equivalent API data: page shell, headings, filters, card widths/order/styles, editor fields/actions, populated/empty trash, Home board, Project Task section, desktop/mobile/landscape and focus behavior. Verify functional flows as well as screenshots. Contract-driven pagination/pending/errors and real identity/counter text are additive; unexplained simplification/layout loss fails acceptance.
2. Model/serialization tests cover every required DTO field, UUID/revision safety, priority mapping, UTF-16 limits/empty/null/omission, read-only exclusion, derived Project display changes at equal Task revision and original replay after deletion/Project rename.
3. Deterministic browser tests allow only auth, Project, Overview and Task APIs; reject Journal/Milestone/Link/Dashboard/monitoring requests and production fixture imports. Prove no business request before `/me` and no effect-triggered mutation. Retain full auth, PLAN-0007 and legacy browser regressions.
4. More than 20 Tasks per status, unequal distribution/equal createdAt ties, independent column pagination/deduplication, first/later-page errors, literal search, rapid filter changes, null/repeated/invalid cursors and direct detail outside loaded pages. Home limits 1 and N must remain total budgets across all three columns, including after status movement. No automatic full collection fetch.
5. Stats totals exceed loaded pages/Home budget, honor title/Project-name search and scope/Project/projectStatus intersections, include archived Projects by default and exclude trash. Valid zero buckets, unavailable stats, independent failed column/stats and stale pre-mutation aggregates must work. Trash uses deleted=true/query empty, separate total/pagination and preserved modal flow.
6. Async editor save/delete, drag/drop/select/reopen, restore, duplicate/pending clicks, field validation and draft preservation. Verify no accidental Promise-truthiness close, no dirty fields in status/delete/restore writes, and no lost focus/route guard. Two-tab revision conflicts, failed reload, repeated conflict, RESOURCE_DELETED, INVALID_RESOURCE_STATE and PROJECT_ARCHIVED stay distinct.
7. Drop delivery of a real committed POST response; exact key/body retry must produce one Task row. Test key reuse, expired intent, replay after Task deletion/reassignment/Project rename/archive, ambiguous PATCH/delete/restore and confirmed-save/failed-refresh. Never substitute a mocked creation for real database deduplication evidence.
8. Project options span multiple pages; selected current archived Project is retained outside active options. Creation/reassignment to archived Project rejects, unchanged archived relation edit/status/delete and restore work. Server Project UUID detail works independently of list/search; foreign/missing Task/Project produces proper 404. Duplicate Project names never determine relation. Project rename/scope/archive invalidates Task display/search/stats without requiring Task revision change.
9. Current and late 401/disabled/ordinary 403, same-account checking/error/handoff, A-to-B isolation, ignored cancellation, late old successes/errors, concurrent security recovery and stale reads after same-generation mutations. No queued intent crosses account/generation teardown. Test beforeunload, Back/Forward, search/filter discard, modal Escape/cancel, mobile drag alternative and keyboard focus restoration.
10. Throw on authenticated storage access and compare all six legacy keys plus unrelated sentinels before/after bootstrap, mutations, trash, errors, logout and account switch; test malformed and UUID-shaped local data. Retain legacy regressions through their separate entry.
11. Extend frontend-owned `tests/real/` acceptance through Vite and a fresh Nginx image with the unchanged backend/local OIDC/disposable PostgreSQL. Exercise actual Task CRUD/stats/cursors/ownership/CSRF/Origin and Project/Overview interactions. Explicit isolated Task/Project setup is allowed; baseline/assert Journal/Milestone/Link/Home rows unchanged. Capture/inspect safe screenshots and compare generated OpenAPI. Stop only owned processes/containers and record cleanup.
12. Run unchanged backend Java 21 `./gradlew.bat clean build --no-daemon` with Testcontainers, covering existing Task/Project/Overview/OpenAPI/security/documentation-policy tests. Use process-only test configuration matching its existing Origin assertions (PLAN-0007 recovery: APP_ORIGIN=http://localhost:8080); do not edit developer `.env` or backend source. Compare backend source hashes before/after. Record commands/counts, failures/causes/recoveries and final evidence without credentials or private payloads.

## Execution Policy: Recover Within the Approved Contract

Use the same self-recovery policy as PLAN-0006/0007. Only after explicit approval, change to `active`, update the existing index row and execute sessions in order.

- Diagnose, fix and revalidate recoverable implementation, typing/build, DTO/fixture, server-readiness, proxy/cookie, test-harness, cursor, revision/idempotency, query/cache/session race and visual-parity failures within this scope, then continue without another scope-approval question.
- Preserve useful failure evidence and establish root cause; controlled assertions and a corrected rerun are required, not a lucky pass. Finish each session's validation before the next and rerun affected/final checks after recovery.
- Never weaken assertions, skip required validation, relax security, import/delete legacy storage, change backend contracts, integrate excluded APIs or remove/redesign working UI to get a pass.
- Stop only for a genuine decision-level blocker: contradictory approved requirements; necessary unapproved dependency/architecture/backend/security change; data-loss/identity risk unresolvable in scope; unavailable external prerequisites after reasonable authorized recovery; or root cause not reliably resolvable within this design. A fundamental UI/backend mismatch requires the specific conflict and smallest proposed UX change, not a blanket permission to simplify.
- Missing production domain/Google credentials is not a blocker for local OIDC acceptance. Diagnose local prerequisites first. Normal tool permissions still apply; approval of the Plan is not a sandbox bypass.
- If blocked, keep `active`, leave incomplete work unchecked, and record reproduction, diagnosis, attempted recovery, affected validation and exact decision/prerequisite. Do not rewrite completed Plans/shared guides to introduce this policy.

## Execution Sessions

All sessions were explicitly approved on 2026-09-13. Execution follows the listed order, establishing UI parity before replacing authority and validating reads/mutations before final composition.

### Session 1: Baselines, contracts and presentation boundaries

- [x] Recheck governing instructions, frontend/backend state/contracts and test runners; activate only after approval and update the index.
- [x] Capture Task page/Home/Project/trash/editor visual and interaction baselines with representative data; inventory preserved flows and allowed additive differences.
- [x] Define API DTO/draft/presentation/async callback contracts and Project-option injection. Extract pure Task/layout inputs while retaining existing markup/styles and legacy adapters; no excluded provider dependency.
- [x] Pass model/serializer/priority tests, boundaries/build/artifact isolation and legacy Task/editor/navigation/mobile smoke. Verify the extracted presentation remains visually equivalent.

### Session 2: Project relations and Task reads

- [x] Add current-session Task query/controller composition and paginated active Project options with independent selected-ID lookup.
- [x] Implement live status columns, direct Task reconciliation, separate trash queries/badge and `/tasks/stats`, with correct defaults/filters/totals and additive read-state controls.
- [x] Pass cursor/filter/first-later-error/malformed/stats/archived relation tests, no local authority, and no loaded-array completeness assumptions.
- [x] Pass real Vite/backend read acceptance beyond one page, ownership and archived Project behavior; compare the populated/empty/loading Task page and trash against baseline.

### Session 3: Creation, edit, status, delete and restore

- [x] Wire existing editor, board and trash actions to awaited async operations; preserve successful close/move/restore and draft/error behavior.
- [x] Implement immutable creation intents/replay window, dirty PATCH, per-Task pending guards, revision/resource-state/archived-target recovery and direct reconciliation.
- [x] Wire bounded shared session security recovery and Task/Project/Overview invalidation without auto replay or fabricated metadata/counters.
- [x] Pass deterministic and real Vite mutation acceptance: single row after dropped-response replay, revision/two-client conflicts, soft delete/restore, archived retain/reassign restrictions and no excluded writes. Revalidate drag/touch/editor/trash/focus parity.

### Session 4: Home and Project Task surfaces

- [x] Mount the reused Task-only Home board with a single combined limit and the existing Project Task section using verified server UUIDs; retain current Overview and pending excluded features.
- [x] Share mutations/stats/entity state across these surfaces without full-array lookups, per-column Home limit multiplication or Dashboard API/layout authority.
- [x] Pass Home budget, selected Project/scope behavior, archived Project detail, cross-surface invalidation, no Task-revision-bump Project display refresh and existing navigation/editor flows.
- [x] Pass real backend Home/Project Task acceptance and visual comparison; verify no Journal/Milestone/Link/Dashboard calls or Home row creation.

### Session 5: Session, cache, error and responsive regression

- [x] Complete same-identity detached Task handoff, combined navigation guards, current-generation/read epochs, ignored-abort safety and teardown cleanup.
- [x] Pass late A-after-B, overlapping Task/Project security recovery, stale same-generation reads, equal-revision derived metadata, repeated conflict/failed reload and confirmed-save/failed-refresh cases.
- [x] Run full Task, auth, Project/Overview and retained legacy browser suites with storage sentinels/access traps.
- [x] Review desktop/mobile/landscape screenshots and keyboard/touch/drag/modal focus flows against baseline; resolve every unexplained visual/functionality regression within scope.

### Session 6: Final validation, documentation and completion

- [x] Pass all required unit/build/boundary/docs/format/artifact checks and affected full browser suites after fixes.
- [x] Pass final real Vite and fresh Nginx Task/auth/Project/Overview acceptance; inspect screenshots/configuration/contracts and database assertions.
- [x] Pass unchanged backend clean build/Testcontainers regression, verify source preservation and clean up owned validation resources.
- [x] Update frontend root/architecture documentation for actual Task authority, preserved UI, query/stats/trash semantics and deferred APIs; record final commands/counts and recovery evidence in this Plan.
- [x] Only after all required validation passes, mark completed and update the existing frontend plan index row. Preserve other Plan statuses and unrelated changes.

## Completion Criteria

- [x] Existing Task visuals, layout, editor fields, board/trash interactions, navigation, responsive and accessibility behavior are preserved except documented contract-required additions.
- [x] Server Task/Project UUIDs and audit/revision metadata are authoritative; legacy name/fixture fallback and local data never enter authenticated API mode.
- [x] Column pagination, global Home budget, independent trash and stats queries/totals work without array-length/completeness assumptions.
- [x] Create/edit/status/soft-delete/restore, idempotency, conflicts, archived Project rules and async draft/pending states match the backend.
- [x] Session, identity, query/read epochs, same-revision Project display refresh and cross-feature invalidation cannot publish stale results or replay old actions.
- [x] Legacy storage and isolated legacy flows remain preserved; no excluded API/provider, Dashboard defaults, backend source change or new dependency is introduced.
- [x] All sessions and required static/visual/browser/real/backend validation pass with final evidence; documentation/index reflect completed implementation.

## Approval candidates and unresolved decisions

No blocking backend/product decision was identified during inspection. The following concrete choices were explicitly approved with this Plan:

- Reuse/extract Task presentation and necessary shell inputs, preserving the legacy Task visual baseline rather than substituting the current pending auth-card UI.
- Task-page/Project-detail 20-row per-status pagination; 250 ms server search debounce; projectStatus=all by default. Existing trash ignores board search, with a separate server total and paged modal.
- Home uses the existing Task card/board presentation with default Unity scope and a 20-Task combined budget when no explicit 1–20 limit is supplied, beside existing Overview; no Dashboard API or stored layout integration.
- Active Project options are paginated with an independently loaded current relation; Project eligibility and invalidation are injected through app/pages, without a new cross-feature dependency exception.
- Confirmed-state rendering while writes are pending; explicit conflict/ambiguous-operation review; memory-only immutable creation recovery and same-identity draft handoff; conservative partition-wide Task/stats/Overview invalidation.

Known contract-driven differences are cursor Load more/read states, real server totals and identities, asynchronous pending/recovery controls, title-or-Project-name server search rather than concatenated-string matching, and active-only creation/reassignment eligibility. These do not justify removing existing fields, drag/drop, trash, responsive layouts or successful user flows. Any additional fundamental incompatibility discovered during execution follows the decision-level blocker policy.

## Proposal validation and approval boundary

Historical proposal boundary: creation of this Plan changed only the Plan/index and started no runtime implementation. The user subsequently approved all execution sessions and candidates on 2026-09-13; the execution evidence below records that authorized work.

Proposal-only validation on 2026-09-13: Prettier formatting passed for the Plan and index; `npm run check:docs` resolved links across 28 Markdown documents. Runtime validation is deferred to approved execution because this task changes documentation only.

## Execution evidence

Session 1 (2026-09-13): API DTO/draft/presentation contracts and pure editor fields, board types, Sidebar/Topbar inputs extracted. 103 unit tests passed; build, source boundaries and artifact isolation passed; all 35 retained legacy browser tests passed. All nine captured screenshots and card styles were byte-identical before/after extraction (`.auth-validation/tasks/baseline` and `extracted`). Initial shell encoding damaged the profile dialog text; restored original Korean text and reran the full suite successfully. No backend source or legacy storage migration.

Session 2: 108 unit tests, deterministic read browser acceptance and real Vite/OIDC/PostgreSQL read acceptance passed (69 seeded Tasks, 68 live; 20 per independent status page, selected column advanced to 23, archived relation and trash/direct detail). Overview active-total mapping corrected after screenshot inspection and real assertions/rerun passed. Artifacts: `.auth-validation/vite/tasks-result.json`, `task-*.png`. Injected Project option adapter preserves paginated active options and direct selected lookup.

Session 3: 111 unit tests and two deterministic Task browser tests passed. Real Vite mutation acceptance passed: retained archived relation edit, concurrent revision conflict with dirty-field reapply, archived restore, committed POST response loss with identical body/key replay producing exactly one database row, editor soft delete. Inspected real editor screenshot; original fields/grid/actions retained. Shared bounded mutation-security entry point retains the Project compatibility alias.

Session 4: real Vite Home/Project surface acceptance passed: combined Home budget 20, Project detail UUID-specific status columns, Project rename refreshes Task display, no excluded rows. Real Task/Home/Project screenshots captured. Runner recovery: concurrent Testcontainers made global new-container counting ambiguous; bind database ownership to the exact container ID in the owned backend startup log and inspect its image. Rerun passed without touching unrelated containers.

Session 5: 112 unit tests, 20 Task browser tests, 20 auth, 21 Project/Overview and 35 legacy browser tests passed. Coverage includes A-to-B late 200/401/403 isolation, same-identity detached draft, bounded deduplicated Task/Project security recovery, repeated conflict/failed reload, committed-save/failed-refresh, archived options beyond page 1, native drag/status-only writes, modal error visibility, focus/discard/beforeunload, independent Home budget and storage access traps with UUID-shaped legacy sentinels. All nine final legacy screenshots plus card styles remain byte-identical to the original baseline. API Task card styles match the baseline in browser assertions. Backend source snapshot: 299 hashes unchanged. Harness recovery: scope storage setup to the app origin, await actual async mutation dispatch, and assert the shared HTTP client safe error text.

Final validation recovery: an attempted parallel backend clean build and bootTestRun shared build output and caused transient JPA managed-type discovery failure. Completed the clean build, then reran real Vite and Nginx sequentially successfully. Backend source hashes remain unchanged; no source/security workaround.

## Final validation evidence (2026-09-13)

All six approved sessions are complete. No decision-level blocker, new dependency, new environment variable, backend source change or excluded API integration was introduced. Root README and architecture documentation describe the implemented authority and preserved presentation.

| Validation                                                   | Final result                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Frontend build (TypeScript + Vite)                           | Passed; exact-source local and fresh Nginx builds produce `index-CFaMy-GP.js`                           |
| `npm test`                                                   | 112 tests, 19 files, passed                                                                             |
| `npm run check:boundaries`                                   | 124 source files / 393 local imports, passed                                                            |
| `npm run check:docs`                                         | Links resolved across 28 Markdown documents                                                             |
| Affected-file Prettier / `git diff --check`                  | Passed                                                                                                  |
| `node tools/check-auth-artifact.mjs`                         | Passed; no legacy storage/fixtures or server-only configuration in production output                    |
| `npx playwright test --config playwright.tasks.config.ts`    | 21 passed                                                                                               |
| `npx playwright test --config playwright.auth.config.ts`     | 20 passed                                                                                               |
| `npx playwright test --config playwright.projects.config.ts` | 21 passed                                                                                               |
| `npm run test:e2e` (isolated legacy entry)                   | 35 passed; total browser regression count 97                                                            |
| `node tests/real/run.mjs --projects=final --tasks=final`     | Passed through real Vite / OIDC / unchanged backend / disposable PostgreSQL                             |
| Same real command with `--nginx`                             | Passed through freshly built Nginx image; nginx configuration test passed                               |
| Java 21 `./gradlew.bat clean build --no-daemon`              | Passed: 183 tests / 36 suites / zero failures and errors; process-only APP_ORIGIN=http://localhost:8080 |
| Backend source preservation                                  | All 299 before/after source hashes identical, no added/removed source files                             |
| Generated contract comparison                                | Auth, Project/Overview and Task OpenAPI artifacts match between Vite and Nginx                          |

Real acceptance seeds 69 Tasks, verifies 68 live after deletion, independent column pagination, archived detail/retained relation edits and restore, Home's combined 20-row budget, Project UUID filtering and Project rename invalidation. Concurrent revision editing preserves the other client's tag while explicitly reapplying the local title. A committed POST response is dropped; identical key/body retry produces exactly one database row. Replay after soft deletion returns the original creation snapshot while fresh detail remains deleted; changed-body key reuse is rejected. Journal/Milestone/Link/Dashboard writes remain zero and isolated business fixture rows are removed.

Visual evidence: original versus extracted/final legacy screenshots (nine images) and card styles are byte-identical. Authenticated card styles are checked against the committed test baseline. Reviewed Task page, mobile/landscape board, Home, Project section, trash and the settled wide editor. Preserved title/project/status/priority/tag/description fields, actions, status select/drag, focus/discard and responsive board behavior. Final parity fixes restore URL scope/search and replace-history behavior, retain the original empty-state reset placement/label, and distinguish Home budget absence from a truly empty status bucket. Server counters/identity, pagination, pending/error/reconciliation controls and temporary Task-only Home are the approved contract-driven differences.

Evidence is retained in ignored `.auth-validation/vite/` and `.auth-validation/nginx/` (result JSON, Project/Task result JSON, contracts and screenshots), plus `.auth-validation/tasks/` (baseline/extracted/final-legacy screenshots, visual parity, backend clean-build counts, preservation and contract comparison). The checked-in `tests/tasks/legacy-card-styles.json` makes browser style validation independent of ignored evidence files.

Final recoveries also corrected duplicate confirmation handlers in the combined real runner and an editor screenshot captured before asynchronous detail loading opened the dialog. Verified the orphaned TestDevspaceApplication PID against this run's startup log/main class before stopping it, then reran successfully. Owned processes/containers were cleaned up; only the pre-existing development PostgreSQL container remained. No credentials/private payloads are recorded in this Plan. Legacy storage, prior completed Plans and unrelated work remain preserved.
