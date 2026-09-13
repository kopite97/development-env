# Plan: Home Dashboard integration

## Status

- Status: `completed`
- Registered: 2026-09-14
- Approved and activated on 2026-09-14, including all six sessions and compatibility candidates. Backend behavior remains unchanged.
- Completed: 2026-09-14 after final Vite and fresh Nginx/backend acceptance, visual comparison and regression checks.
- Reuses completed [Auth](PLAN-0006-frontend-auth-http-integration.md), [Project/Overview](PLAN-0007-project-overview-integration.md), [Task](PLAN-0008-task-integration.md), [Journal](PLAN-0009-journal-integration.md), [Milestone](PLAN-0010-milestone-integration.md), and [Link](PLAN-0011-link-integration.md) integrations.

## Goal

Replace the temporary fixed authenticated Home composition with the server's Home Dashboard configuration. Preserve the existing Home visual design, grid, widget frames, drag and arrow ordering, configuration/size controls, responsive layout, navigation and accessibility. Adapt existing presentation boundaries and compose completed API-backed features; Dashboard stores configuration, never copies of business data.

## Scope

- In scope: validated Dashboard reads/full replacement saves, virtual defaults, schema/revision authority, configuration drafts and explicit reconciliation, existing Home/editor/frame presentation, configurable API widget composition, Project selection, session/cancellation/invalidation, and static/browser/visual/real Vite/Nginx/backend validation.
- Out of scope: backend changes, new dependencies, new widget types, deployment/monitoring API integration, other Dashboard keys/routes, automatic layout migration, legacy storage access, new business-resource models, and automatic replay of uncertain saves.

## Verified implementation contract

On 2026-09-14, fetched the running [generated OpenAPI](http://127.0.0.1:8080/v3/api-docs), including its UTF-8 default example, and compared it with current sibling backend source. [Swagger UI](http://127.0.0.1:8080/swagger-ui/index.html) exposes that generated contract. Inspection was read-only; no authenticated PUT or database probes were performed during proposal creation. Runtime acceptance is planned after approval.

Source evidence is sibling backend `src/main/java/com/kopite/devspace/dashboard/`: `presentation/HomeDashboardController.java`, `presentation/dto/SaveHomeDashboardRequest.java`, response DTOs, `domain/HomeDashboard.java`, `domain/DashboardWidget.java`, and query/command services. Existing `DashboardCommandTests`, `DashboardOverviewApiTests` and OpenAPI tests corroborate defaults, normalization, archived references, atomicity and concurrent saves. Recheck runtime/source at execution start; older reference documents do not override implemented behavior.

| Operation                     | Implemented contract                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/v1/dashboards/home` | No query parameters. 200 `{id:"home",schemaVersion:1,revision,widgets:[...]}`. Configuration only; no business data, audit fields, pagination or default numeric limits. No-store response.                                                                                                                                                               |
| GET before persistence        | Returns the exact deterministic virtual default below at revision 0; does not create a Dashboard or increment workspace/business state. Repeated reads stay virtual.                                                                                                                                                                                      |
| GET persisted configuration   | Returns saved order and values, including a saved empty array. Missing/inaccessible referenced Project causes 404 `RESOURCE_NOT_FOUND` for the whole Dashboard, without dropping widgets, repairing state or returning defaults. Invalid stored schema/state is not a client fallback opportunity.                                                        |
| PUT `/api/v1/dashboards/home` | No query parameters. Required JSON `{schemaVersion:1,revision,widgets:[...]}`; full atomic ordered replacement, not PATCH. Request does not include response `id`, audit fields or business data. 200 returns the entire normalized Dashboard, including the first save. Session cookies and `X-CSRF-Token` apply; no Idempotency-Key contract.           |
| Revision                      | Nonnegative safe integer, maximum `9007199254740991`. First save with revision 0 creates revision 1. Concurrent first saves have one winner and one 409. Later saves require the current revision; every successful PUT, even identical content, advances it. Exhaustion also returns `REVISION_CONFLICT`. Never increment or predict a revision locally. |
| Errors                        | 400 `VALIDATION_ERROR` or `UNSUPPORTED_SCHEMA_VERSION`; 401 `AUTH_REQUIRED`; 403 `ACCOUNT_DISABLED`/`CSRF_INVALID`; 404 reference unavailable; 409 `REVISION_CONFLICT`; 500 internal error. Unsupported integer schema versions differ from missing/null/noninteger validation errors.                                                                    |

Request deserialization rejects missing required fields, nulls, duplicate JSON fields, unknown fields, fractional numeric values, invalid enums and invalid UUID references. Widget `id` and title are trimmed using backend semantics; IDs are case-sensitive and unique after trimming, but **not required to be UUIDs**. Repeated widget types are valid. Title length is 1–48 UTF-16 code units after trimming. No application-level widget-count cap or finite ID-length cap beyond required nonblank text was found; do not invent a contract maximum or truncate received configurations.

Every widget requires `{id,type,title,scope,size}`. Allowed types are overview, board, deploy, links, journal and milestone. Every type allows small, medium and wide sizes, and scope all/unity/server. Array order is layout order; there is no widget position or individual widget revision.

| Widget types                        | Optional fields                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| overview, board, journal, milestone | `projectId` as canonical owned Project UUID and `limit` as integer 1–20; either can be independently omitted. Explicit null rejects. |
| deploy, links                       | Neither projectId nor limit is permitted. Omit both on type changes; do not serialize stale editor fields.                           |

Owned archived Projects are valid references for all four data widget types. A supplied Project normalizes scope to all on save; its identity is never inferred from a name or the scope control. No numeric limit is inserted by the server when omitted. PUT validates referenced ownership before comparing stored Dashboard revision, so an invalid reference may yield 404 even with a stale revision; do not assume Link reorder's conflict precedence applies. PUT updates Dashboard persistence and workspace dataRevision, but does not mutate Projects/Tasks/Journals/Milestones/Links or turn workspace revision into a session generation.

### Exact virtual defaults

The response envelope has `id:"home"`, `schemaVersion:1`, `revision:0`. All six widgets omit projectId and limit:

| Order | id             | type      | title         | scope | size   |
| ----- | -------------- | --------- | ------------- | ----- | ------ |
| 1     | home-overview  | overview  | 프로젝트 개요 | all   | wide   |
| 2     | home-board     | board     | 작업 보드     | all   | wide   |
| 3     | home-deploy    | deploy    | 운영          | all   | medium |
| 4     | home-links     | links     | 바로가기      | all   | small  |
| 5     | home-journal   | journal   | 개발 일지     | all   | medium |
| 6     | home-milestone | milestone | 마일스톤      | all   | medium |

These intentionally differ from both the legacy `defaultLayout` and the temporary fixed authenticated Home. Server order/titles/scopes/sizes win; retain visual components instead of substituting the old defaults. Revision 0 is a successful loaded configuration, not an empty/error state or permission to save automatically.

## Changes

### 1. DTO, draft and presentation boundaries

Create a feature-owned Dashboard API model/store on the completed private transport and Query foundation. Validate the exact envelope, home ID, supported schema, safe revision, array, widget field discriminants, normalized IDs/uniqueness, title lengths, optional fields and scope/project invariant before publication. Unknown response schema/type is unavailable/protocol error with retry, not a reason to silently drop widgets or install defaults.

Keep an immutable confirmed DTO, an editing draft of the same widget configuration schema, a captured baseline revision and transient editor/drag/pending state. These are lifecycle states of one model, not competing layout authorities. Existing WidgetFrame can accept a thin typed presentation adapter; do not introduce a second registry of persisted layout fields. Dashboard envelope ID/revision/schema are not editable. New widget IDs may use `crypto.randomUUID()` as client-authored configuration identity (the API requires the client to supply them); this does not fabricate a business-resource ID. Preserve existing widget IDs on rename, reorder, resize and type replacement.

Keep optional values omitted throughout draft serialization; blank Project/limit inputs mean omission, not null, zero or inserted defaults. Use UI input strings only inside the widget editor. Preserve intermediate input/errors. Trim IDs/titles consistently for validation and show duplicate/field-index errors without discarding the layout. Accept server normalization from the validated response.

### 2. Home and editing UI preservation

Use [DashboardWorkspace](../../src/features/dashboard/DashboardWorkspace.tsx), [WidgetFrame](../../src/features/dashboard/WidgetFrame.tsx), [WidgetEditor](../../src/features/dashboard/WidgetEditor.tsx), existing catalog, CSS and the preserved app shell/scaffold as the baseline. Capture both legacy editable Home and current API feature surfaces before changes. Extract controller props as needed; do not mount DashboardProvider or other legacy business providers in authenticated Home.

Keep Korean heading/actions, welcome strip, tabs/search, dashboard-grid/is-editing, widget icon/title/scope headers, add-widget area, edit banner, catalog selection, type replacement, width selector, removal, drag handles, arrow reorder, reset confirmation, cancel and save. Preserve drag ID/drop semantics, stale-target no-op handling, mobile arrow alternatives, touch/scroll, focus return, modal trapping/Escape, unsaved navigation and beforeunload. Widget business-content drag (Task cards) must not start a Dashboard drag. Prevent nested WidgetFrames when extracting existing Home surface content.

Home scope/search filters only select displayed widgets by configuration title/scope, as today; they are not Dashboard GET parameters or global business search. Entering layout edit clears/disables these filters as the existing flow does, so reorder/replace always edits the full draft array. Keep content interactions outside layout-edit mode; while editing/pending, disable or inert business mutation controls/links that would conflict with layout manipulation, preserving current layout-edit behavior and keyboard access to frame controls.

Add compact loading/error/refresh/pending/reconciliation states inside existing Home containers. Initial Dashboard loading/error/404/schema failure cannot show a fabricated fixed Home or genuine empty state. A successful saved `widgets:[]` stays empty after reload and offers the existing add action. Failed refresh retains clearly stale confirmed layout; individual widget read failure is isolated to its frame and must not hide other successful widgets.

### 3. Configurable API widget composition

App owns store lifetimes and injects renderer dependencies through page composition. Dashboard owns configuration and edit behavior; renderer composition joins features without introducing cross-feature business stores. Use each widget's actual title/scope/size/Project/limit, and separate instances by widget ID so repeated types retain independent UI state. Share feature query caches for identical read keys, not editable state or a single global Task editor across repeated boards.

| Type      | Composition and omitted-limit behavior proposed for approval                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| overview  | Preserve the existing ProjectOverview stats/Project-row presentation, adapt it to completed OverviewStore counters plus ProjectStore rows/direct detail. Do not manufacture fake Tasks to fill its current tasks prop or derive totals from loaded pages. Explicit limit bounds Project rows only, never Overview counters; omitted limit uses existing 20-row Project pages with minimal load-more to retain access to all matching Projects. Selected Project is fetched directly, including archived, and opens canonical detail. |
| board     | Extract/reuse ApiTaskManager/TaskReads under one Dashboard frame. Scope/project come from the widget, not the old fixed unity value. Explicit limit 1–20 is the combined Home board budget across statuses; omitted limit keeps completed Home default 20. Preserve Task edit/status/trash flows and their existing Project eligibility rules; Dashboard's archived reference permission does not authorize Task creation into an archived Project.                                                                                  |
| journal   | Reuse ApiRecentJournals with widget scope/project and explicit limit, default 3 when omitted. Newest server order, read-only detail presentation, entryDate/body/audit semantics and filtering stay in JournalStore.                                                                                                                                                                                                                                                                                                                 |
| milestone | Reuse ApiMilestoneList content, scope/project and explicit limit, default 2 when omitted, initial open filter. Keep the completed read-only Home behavior/status control and canonical Project-detail navigation. Do not override configured all scope with the former fixed unity default.                                                                                                                                                                                                                                          |
| links     | Reuse ApiLinks read-only content with configured scope and empty business query, full bounded server collection. Neither projectId nor limit is serialized or invented. Link order is LinkStore authority, unrelated to Dashboard frame order.                                                                                                                                                                                                                                                                                       |
| deploy    | Backend config supports it, but no operational-data API exists. Proposed compatibility behavior is to preserve existing DeploymentStatus's explicitly labeled 예시/데모 presentation and informational modal, including its scope behavior. It must never claim live status or become authority for any integrated feature. Do not invent a deployment API or remove a valid server widget.                                                                                                                                          |

The deploy exception is explicit: all five completed data surfaces remain exclusively API-backed; only the already labeled operations example remains an example. Reuse Overview results for shell counts and widget counters, rather than keeping an additional fixed unconfigured Home widget. Page-level chrome may query shared Overview for existing shell counters.

For unselected Overview Project rows, retain active-Project semantics; the Overview API supplies independent totals/Task counts. Task/Journal/Milestone keep their completed projectStatus and business-resource semantics. An explicit archived Project reference takes precedence over broad active-only row selection and must be resolved by UUID even outside first pages. Provide paginated all-owned Project options and independent selected-ID lookup in the widget editor; show archived labels, loading/error/retry, and never substitute a similarly named Project.

### 4. Virtual defaults and explicit reset

Normal Home always starts from GET, including revision-0 defaults. Never seed authenticated state from legacy defaults, fixtures, localStorage, or a failed GET. Do not persist defaults on mount, refresh, entering edit, or adding a local draft widget. First explicit 배치 저장 sends revision 0 and the entire draft and waits for normalized 200.

There is no reset/default endpoint and a saved GET cannot request virtual defaults. To preserve 기본 배치 without backend changes, propose a **single schema-1 reset template copied from the verified server default contract** using the same widget model, tested against actual unsaved GET/OpenAPI. This template is only an explicit draft-edit command after the existing confirmation, not a read fallback or saved authority. It does not set revision to 0 for a saved Dashboard: save uses the current captured revision. Cancel restores the confirmed layout. Avoid a second layout model or separate renderer defaults array; keep the template in one contract module and revalidate it when backend defaults change. A reset does not delete business records or legacy storage.

### 5. Awaited save, conflict and uncertain-outcome review

Freeze one PUT payload from the full draft and captured revision on explicit save; serialize saves and disable double submits, drag/configuration changes and accidental close while pending. No resource Idempotency-Key is added. Validate response ID/schema/widget fields and advancing server revision before confirming success; never create a synthetic acknowledgment from the request. Install the complete normalized response atomically and only then leave edit mode/show 배치를 적용했습니다. Refresh failure after confirmed success is a stale-read issue, not a reason to offer the same PUT again.

Keep draft, baseline and uncertain submitted payload through network/validation/404/409/protocol/reconciliation failures. On REVISION_CONFLICT reload current Dashboard separately while preserving the draft, compare ordered widgets and changed fields, and require explicit reconciliation. Offer server-layout adoption with discard confirmation, or deliberate reapplication of the preserved layout against the freshly read revision after reviewing latest server additions/removals/order. Do not silently merge, delete concurrent widgets or automatically overwrite the winner; choosing a full draft replacement must clearly identify that consequence. A second conflict repeats the review without losing work.

On timeout/lost or malformed PUT response, server state may already have changed. Do not automatically replay PUT, even with identical content (same-value saves advance revision). Explicitly GET latest: if content matches the normalized submitted configuration, explain that current state matches and let the user accept it without another write; do not invent attribution to the lost response. If different, require the same explicit comparison/reconciliation. Failed GET keeps draft and disables blind resave until review is possible. CSRF recovery follows existing Auth behavior with no business replay; unsupported schema requires compatible client/contract resolution, not local conversion.

For a reference 404, keep the draft and highlight the selected UUID/settings for explicit correction/removal using independently loaded Project options. Do not repair or drop widgets automatically. A cold GET 404 may provide no layout/revision to edit safely: show unavailable/retry, not a default overwrite or guessed revision. If such persistent corrupted state blocks required acceptance and cannot be resolved within authorized data policy, record a decision-level blocker.

### 6. Cache, invalidation, sessions and legacy storage

DashboardStore is identity/workspace/generation scoped with one home query, abort/sequence guards and mutation epochs. Cancel obsolete route/read work; reject late old-generation GET/PUT/auth failures. A saved Dashboard revision and feature revisions are separate authorities. Keep layout drafts in transient memory only, including nested widget-editor draft; use established same-identity Auth handoff, clearing all configuration drafts/intents on logout/account change. Preserve navigation/discard behavior without stale completion reopening a route or discarding a newer draft.

Successful PUT invalidates prior Dashboard reads, installs the response, and reconciles subscriptions by widget ID and full query configuration. New/changed scopes/Projects/limits bind new feature query keys; removed widgets release observers; unaffected confirmed feature caches can be reused. Dashboard save does not mutate business records or increment their revisions. Existing feature mutation hooks continue to invalidate Overview/Task/Journal/Milestone/Link content across all repeated instances. Project rename/scope/archive updates invalidate relevant options/direct presentation and revalidate Dashboard references without overwriting an open layout draft. Avoid cycles where widget reads or Dashboard reads repeatedly invalidate each other.

Keep `devspace.layout.v1` byte-for-byte preserved, including empty or malformed values. Authenticated code neither reads it as authority nor imports/migrates/deletes it, seeds drafts from it, or synchronizes it through storage events. No persisted layout queue, fallback default save, or reintroduced fixture/localStorage authority for Overview/Task/Journal/Milestone/Link. Retain isolated legacy provider/drag tests.

## Validation

### Static

Proposal checks only Markdown formatting, relative links, sequence/status and this contract comparison. Runtime implementation tests do not apply to Plan creation and are not claimed as completed.

After approval run DTO/serializer/store/draft/intent tests, type/build, source-boundary, authenticated-artifact, changed-file formatting, docs-link and diff checks. Cover exact default configuration, response/request asymmetry, schema errors, safe revisions including 0, optional omission versus null, ID trimming/uniqueness and repeated types, title UTF-16 limits, all type/size combinations, unsupported settings, Project normalization, saved empty layouts and unsupported response fields. Do not invent or test against a false widget-count maximum.

### Runtime

- Capture legacy Home grid/editor/drag/resize and completed API content baselines at desktop/mobile/landscape. Compare equivalent configured layouts, not legacy versus intentionally different server default titles/order/scopes/sizes. Verify headers, row/card geometry, Korean text, edit banner/catalog, modal scrolling/focus trap/return, Escape/discard, keyboard arrow ordering, native widget drag, Task drag isolation, mobile menu/touch/overflow and direct navigation. Unexplained visual or interaction changes fail validation and must be fixed.
- Deterministic browser tests cover first loading/error/retry, saved empty, virtual revision 0 with no automatic PUT, add/remove/replace/resize/reorder/reset/cancel/save, double-submit/pending protection, two-tab first/later conflicts, repeated conflict/failed reconciliation, ambiguous success, direct missing/archived Project outside loaded pages, repeated widget types, filter transitions, content errors, late GET/PUT/401/403, same-identity recovery, changed identity and all legacy storage sentinels.
- Prove each configured widget uses completed APIs and configured scope/project/limit, correct omitted-limit behavior and one frame; prove all five feature authorities stay independent from Dashboard config and local storage. Validate Overview totals beyond loaded rows, combined Task budgets, newest Journals, read-only Milestone/Link Home, and no deployment API requests. Explicitly test demo labeling for deploy and default reset template parity.
- Real Vite and fresh Nginx production runs use the unchanged backend with the established disposable OIDC/PostgreSQL harness. Verify generated OpenAPI, repeated unsaved GET with zero Dashboard writes, first 0-to-1 save, saved empty persistence, normalization/archived ownership, exact atomic full replacement and same-value increments, competing first/later saves, unsupported/null/duplicate/unknown fields, inaccessible Project failures and no partial writes. Inspect database evidence that only configuration/workspace data revision changes, and business rows remain untouched by Dashboard saves.
- Extend the existing real harness allowlist narrowly for `/api/v1/dashboards/home`; retain exclusion checks for unimplemented APIs and other Dashboard endpoints. Run affected Auth/Project/Overview/Task/Journal/Milestone/Link and legacy regressions, plus unchanged-backend regression checks. Record commands/pass counts, screenshots, contract/response/database evidence, cleanup and recovery history. A mocked browser pass cannot replace real proxy/backend or visual acceptance.

## Execution Sessions

Execute in order after explicit approval. Each session records evidence and fixes recoverable failures before continuing.

1. **Contract and visual baseline:** activate Plan/index; reread governing source instructions, runtime OpenAPI/source/defaults; capture original Home/editor/drag and current API widgets; confirm renderer boundaries, deploy/reset candidates and Project option semantics.
2. **Dashboard reads and configurable Home:** implement validated DTO/query/session foundation, virtual/saved-empty/error states and one configuration-driven grid; extract existing frames/content and inject Overview/Project, Task, Journal, Milestone, Link and labeled deploy rendering. Validate exact configured fields and no legacy authority.
3. **Draft layout/editor interactions:** adapt existing edit/add/type-change/size/remove/drag/arrow/cancel/reset UI, all-owned Project options/direct lookup, optional settings/normalization, repeated-instance state and unsaved guards. Verify desktop/mobile keyboard/drag parity before saves.
4. **Async save and reconciliation:** implement exact full PUT, revision-0 first save, normalized response adoption, pending protection, explicit resource-reference correction, conflict/ambiguous-outcome review and same-identity draft handoff. Pass deterministic and real backend mutation acceptance.
5. **Cross-widget recovery and visual regression:** finalize invalidation/subscriptions, route/filter/session races, multiple boards and feature draft isolation; run existing feature and legacy regressions and inspect screenshots/interaction parity. Diagnose and fix every unexplained regression.
6. **Final acceptance and documentation:** run final static/unit/build/browser and real Vite/fresh Nginx/backend checks, record evidence/cleanup/recoveries, update relevant root/architecture/development documentation, then mark completed and update Plan index only after all required validation passes.

## Self-recovery execution policy

Diagnose, fix within approved scope, revalidate and continue after recoverable implementation, type/build, test, OpenAPI/encoding, proxy, Docker, browser-harness, integration, concurrency or visual-parity failures. Reuse verified managed Vite servers when Windows child-server teardown hangs; stop only run-owned processes. Do not weaken assertions, substitute fixture authority or modify backend/security behavior to obtain a pass.

Stop only for a genuine decision-level blocker: an unreconciled contradiction with implemented backend contract, required unapproved architecture/security/backend change, unavoidable dependency, unresolved identity/data policy, or fundamental UI/backend incompatibility outside the approved candidates. Record concrete evidence and the required decision, leave execution incomplete/active, and do not reject or pause for ordinary recoverable failures.

## Approval candidates and unresolved decisions

Approval candidates are the verified contract and six sessions, preservation through existing presentation boundaries, configuration-driven API renderer matrix (including omitted-limit policies), all-owned archived Project options, explicit full-layout reconciliation, same-identity transient drafts, and the following compatibility choices:

- Preserve the server-supported deploy widget as the existing clearly labeled operations example, without live claims or deployment API work; never use examples for the five integrated data surfaces.
- Preserve 기본 배치 as an explicit draft reset using one contract-tested schema-1 server-default template, never a read fallback or alternative persisted authority.
- Preserve ProjectOverview rows/stats using completed Overview/Project API authority; omitted limit permits existing server pages with minimal load-more, while explicit limit bounds rows only. Feature rendering defaults never populate omitted Dashboard fields.

All candidates and the deploy/demo, explicit default-reset template and Overview omitted-limit choices were explicitly approved. All six sessions are completed; no unresolved decision-level blocker remains.

## Completion Criteria

- [x] Home uses validated server Dashboard configuration and exact virtual/saved-empty behavior with no auto-save or local layout authority.
- [x] Existing grid, configuration/size/removal/drag/arrow/cancel/reset UX, Korean labels, navigation, responsive layout and accessibility are preserved with approved compatibility choices only.
- [x] All five completed API surfaces honor widget configuration, canonical Project references, repeated-instance isolation and feature-specific semantics.
- [x] Awaited full PUT, server revisions, conflict/reference/ambiguous-result reconciliation and draft preservation pass required checks.
- [x] Session/stale-response protection and Dashboard/feature invalidation work without business-data side effects or cross-account leakage.
- [x] Legacy storage and backend remain unchanged; no competing layout model, new dependency or unapproved API integration is introduced.
- [x] Required static, browser, visual and real Vite/Nginx/backend validation passes with final evidence and recovery history recorded.
- [x] Relevant documentation and Plan index are updated; completion is recorded only after successful validation.

## Execution evidence — 2026-09-14

| Session                   | Completed work and evidence                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — contract/baseline     | Rechecked running 8080 OpenAPI and backend Dashboard source. Captured original Home/edit/editor at 1440×1000, 390×844 and 844×390; retained previous API feature baselines. Confirmed exact six-widget defaults and owned archived Project semantics.                                                                                                                                                                                |
| 2 — reads/composition     | Added validated Dashboard DTO/query/store; replaced root's fixed composition with ServerDashboardHome and one WidgetFrame per configured item. Reused the five API stores and labeled DeploymentStatus. ProjectOverview now accepts real Overview counters and Project rows/direct reads without fabricated Task data. Virtual/default/empty/error, limits, scopes and archived UUID rendering passed deterministic and real checks. |
| 3 — draft interactions    | Shared WidgetEditorView and preserved catalog, fields, add/replace/size/remove, arrow/native drag, cancel/reset, Korean presentation and focus behavior. Home scope/search remain URL-backed, survive reload and clear/disable on editing. All-owned options have pagination/direct selected lookup. Same-configuration grid/frame/title/editor geometry matches the legacy entry at all three viewports.                            |
| 4 — async mutations       | Full awaited PUT captures baseline revision and submission; validates returned schema/configuration/revision before publishing. First-save race, reference validation, same-value increments, two-tab conflict review, uncertain committed response reconciliation, failed reconciliation and draft retention passed. No ambiguous request auto-replays.                                                                             |
| 5 — recovery/regression   | Session generation, abort/sequence/epoch guards and revision watermark reject obsolete results. Same-identity layout/widget/Task drafts survive verification; account change clears them. Dashboard saves refresh feature reads; Project writes refresh references/options. Repeated boards, old-session 200/401/403, combined Task budgets and Overview later-page retry passed. All existing 132 browser regressions passed.       |
| 6 — final acceptance/docs | Final 156 unit, 150 total browser and 183 unchanged-backend tests passed. Final real Vite result completed at 01:30:44 KST and fresh Nginx result at 01:32:00 KST. Updated root README, architecture, development guide and Plan index after acceptance.                                                                                                                                                                             |

### Commands and results

- `npm test -- --run`: **156/156**, 28 files.
- `npm run build`: TypeScript and Vite passed. Final production assets: `index-QGr2GKWn.css`, `index-BhvINkdm.js`; the fresh Docker build produced the same assets.
- `npm run check:boundaries`: **175 source files / 630 local imports** passed. `npm run check:docs`: **32 documents** resolved. `node tools/check-auth-artifact.mjs`: passed, no legacy business storage/fixtures or server-only configuration in the authenticated artifact. `git diff --check`: passed.
- Changed/new implementation, test and documentation files pass explicit Prettier checks. Repository-wide `npm run format:check` still reports the established unrelated formatting backlog (186 files in the first scan); changed-file issues were corrected, without mass-formatting unrelated files.
- `npx playwright test --config playwright.dashboard.config.ts` with verified Vite 4183 and `DASHBOARD_REUSE_SERVER=1`: **18/18**. Existing suites: **35 legacy + 20 Auth + 21 Project/Overview + 21 Task + 7 Journal + 13 Milestone + 15 Link = 132/132**, total **150/150**. Windows suites used managed/reused verified servers and their documented reuse flags.
- `node tests/dashboard/visual-parity.mjs`: same configured grid columns/gaps, frame width/padding/border/radius, title typography, header layout and editor dimensions match at all three viewports. Screenshots were inspected alongside the original captures; configured server defaults intentionally differ in titles/order/scopes/sizes from legacy defaults.
- Unchanged sibling backend: `APP_ORIGIN=http://localhost:8080` with `gradlew.bat clean test --no-daemon`: **183 tests, 0 failures/errors/skips**. Backend HEAD remains `238aaa11108ea301e32d36690aaf616e5817ab0e`, clean; no backend behavior or contract edits.
- `node tests/real/run.mjs --dashboard=final` and `node tests/real/run.mjs --dashboard=final --nginx`: **both passed** on the final code. Disposable signed OIDC/PKCE, session/CSRF/Origin/logout, SPA/API proxy separation and backend-unavailable behavior also passed. Only the exact Home Dashboard path was added to the API allowlist.

### Real contract, database and visual evidence

Ignored local evidence is under `.auth-validation/`: `dashboard-live-contract.json`, original `dashboard-baseline-*`, `dashboard-edit-baseline-*`, `dashboard-editor-baseline-*`, authenticated `dashboard-api-*`, `dashboard-edit-api-*`, `dashboard-editor-api-*`, `dashboard-same-layout-*`, `dashboard-same-editor-*`, and `dashboard-visual-parity.json`. Feature regression logs use `dashboard-regression-*.log`; final Project and Dashboard reruns passed after the recoveries below.

Both `.auth-validation/vite/` and `.auth-validation/nginx/` contain final `dashboard-contract.json`, `dashboard-result.json`, `dashboard-{desktop,mobile,landscape}.png`, `dashboard-editor-*`, proxy `result.json` and harness logs. Evidence proves:

- Repeated unsaved GET returns identical revision-0 defaults with no Dashboard row or workspace revision/dataRevision change; mounting Home does not save.
- Concurrent first PUTs yield exactly **200 + 409** and revision 1. The UI reset submission exactly matches the actual virtual-default configuration and retains the current saved baseline revision.
- Owned archived Project references outside the first 20 Project options resolve directly. All five feature surfaces render real seeded data; Project name identity is never inferred.
- Invalid null/duplicate/unknown/unsupported widget fields reject atomically. An invalid Project reference yields 404 even with stale revision. Configured scope normalizes to all with a Project.
- Real two-tab review retains the local full layout, fetches the latest server configuration and requires explicit rebase plus a separate save. Saved empty survives reload; equal-value saves advance server revision. Final tested revision is 8.
- JSON snapshots of Projects, Tasks, Journals, Milestones and Links remain identical across Dashboard writes. Workspace revision stays 1; no business-data mutations arise from layout changes. Overview omitted-limit pagination reaches 22 active Projects while counters remain independent.
- Legacy storage sentinels remain unchanged. Disposable harness-owned records are cleaned, and final proxy results report zero business rows and zero excluded API requests. User backend 8080 and existing storage are untouched.

### Recovery history

1. Corrected adapter extraction wiring/import paths before the first successful build; no fallback provider was introduced. Boundary and production-artifact checks confirmed isolation.
2. Updated earlier Home tests to supply explicit saved Dashboard configurations where historical widget defaults are under test. Auth identity assertions now use the authenticated named region. A broad Task mock initially intercepted Dashboard GET, and one Overview test left Project reads unmocked, causing session retirement; both fixture contracts were corrected and their full suites passed. Modal close and Task-field selectors were narrowed to their actual accessible controls.
3. Visual review identified the former floating auth logout overlapping Home content. Moved Home logout into normal flow. A subsequent real landscape run exposed the global `.button` display rule overriding its alignment, placing it beneath the fixed sidebar. Increased selector specificity, added a dedicated real-click landscape regression and revalidated all 18 Dashboard tests plus final Vite/Nginx flows.
4. The failed real logout wait exposed an unhandled harness response promise and left its owned backend on 18080. Paired click/response with `Promise.all`, identified the exact process from the run log, stopped only that process after OS approval, and reran on clean acceptance ports. Occupied managed Vite ports were reused only for this checkout. No backend/security change or forced-click test bypass was used.
5. Restored URL-backed Home filter/reload behavior during interaction review, including clear-on-edit, then added reload/reset assertions. Corrected a documentation helper escaping error and formatted/check-linked all changed documents. Repository-wide pre-existing formatting remains outside this Plan.

All recoverable failures were fixed and revalidated. No unresolved decision, new dependency, deployment API, layout migration, automatic default save or silent Dashboard conflict resolution remains.
