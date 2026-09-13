# Frontend architecture

## Composition

The entry is [main.tsx](../../src/main.tsx), which renders [app/App.tsx](../../src/app/App.tsx). App composes the app-owned [AuthApp](../../src/app/auth/AuthApp.tsx) and [AuthSession](../../src/app/auth/session.ts). GET /api/v1/me gates five distinct states: checking, unauthenticated, disabled, bootstrap-error and authenticated. The authenticated shell displays server User/PersonalWorkspace, API-backed Project, Overview, Task, Journal, Milestone and Link surfaces. It mounts none of the legacy business providers. Identity is partitioned by User ID, Workspace ID and independent session generation; Workspace revision is not a session counter.

```text
src/
  main.tsx
  app/                 bootstrap, providers, routing, layouts, CSS composition
  pages/               route-level feature composition and input contracts
    home/              cross-feature widget renderers
  features/
    dashboard/         layout draft, catalog, widget frame/editor
    projects/          project data, classification, editor and summaries
    overview/          API aggregate DTOs, queries and counters
    tasks/             API models/queries/mutations, shared presentation, isolated legacy adapter
    journal/           journal CRUD, date/project filters and list/detail views
    links/             link data, validation, ordering and editor
    operations/        example service status display
    milestones/        independent goals, deadlines, completion and editor
  shared/
    ui/                feature-agnostic controls and PageScaffold
    hooks/             persistence and unsaved-change hooks
    lib/               navigation guard registration
    types/             presentation callback contracts
    styles/            tokens, base, controls and reusable content layout
```

The dependency direction is `app -> pages -> features -> shared`; app and pages may also use lower layers directly. Pages never import app. Features never import app or pages. Shared never imports application domains. The explicit project contracts shared between features are documented in the [dependency decision](../decisions/feature-dependencies.md) and checked by `npm run check:boundaries`.

In the isolated legacy composition, [PageRouter](../../src/app/PageRouter.tsx) injects navigation/search callbacks and the presentation slots composed by [usePageScaffold](../../src/app/layouts/usePageScaffold.tsx). The shared [PageScaffold](../../src/shared/ui/PageScaffold.tsx) renders title, description, overview, feedback, filters, actions, and children without reading domain providers. Pages can suppress slots for detail and recovery screens.

Legacy ProjectsWorkspace, JournalWorkspace, LinkLibrary, and DashboardWorkspace own their feature-specific filters, editor state, and commands. URL filter values remain application-owned inputs. ProjectDetailPage joins projects, tasks, and journals by project ID; useProjectEditor owns the project editing state. ProjectsWorkspace receives task status summaries through page composition rather than importing the tasks feature.

## Authentication and transport

[Shared HTTP](../../src/shared/http/client.ts) uses same-origin fetch at the relative /api/v1 root, typed errors, JSON/empty response checks, bounded timeout, caller/lifecycle cancellation and generation checks before dispatch/publication. It receives auth and CSRF callbacks through app composition and imports no app or feature code. CSRF acquisition is single-flight and memory-only; authenticated mutations get the current X-CSRF-Token. Login is explicit top-level backend navigation with validated route intent.

Normal logout waits for actual 204. CSRF_INVALID permits one same-identity revalidation/token refresh and explicit retry, with no mutation replay; a second rejection exposes a configuration problem. Ambiguous logout gates private state and reconciles with /me. Active 401 and typed disabled 403 tear down identity and tokens. Late obsolete responses cannot publish identity, errors or tokens.

Cross-tab BroadcastChannel messages contain only a change hint, never identity or tokens. Receivers verify /me; unchanged identity does not echo another hint. Focus, visibility and pageshow are the fallback. Pagehide retires private DOM before BFCache restoration. All of this bypasses the prototype dirty-navigation guard. No identity, tokens or auth events are persisted in browser storage.

## Authenticated Projects and Overview

[PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx) composes isolated feature stores with the existing AuthSession transport and captured generation. [ServerProjectsPage](../../src/pages/ServerProjectsPage.tsx) joins Project UI, Overview, Tasks, Milestone management and the bounded recent-Journal view by validated server UUID without a cross-feature import. Root composes API feature surfaces from the validated Home Dashboard configuration; `/tasks` uses the preserved Task shell and `/journals` uses the preserved Journal presentation with server reads. Library uses the preserved Link shell and server collection authority. App-owned history guards ordinary draft/pending navigation with one confirmation; auth teardown takes precedence.

[Project API models](../../src/features/projects/apiModel.ts) validate UUID/revision/audit metadata and explicitly serialize writable fields. Presentation maps currentMilestone to the memo, status to archived, and colorToken to a visual class. No fixture lookup or local UUID generation supplies resource identity. Creation keys are operation identifiers only.

[ProjectStore](../../src/features/projects/apiStore.ts) separates filter-bound cursor chains, direct detail and revision-aware entities. Pages are 20 rows; only a null cursor ends traversal. Direct archived detail never depends on list membership. [OverviewStore](../../src/features/overview/apiStore.ts) deduplicates scope/project queries independently of Project search, status and pagination. Active and archived counts are separate; aggregate task counts include archived Projects and exclude soft-deleted tasks.

Queries combine AbortControllers, generation checks and request sequencing. Mutation epochs retire old Project reads; Overview invalidation retires old aggregate reads. Successful mutation responses seed confirmed entities before follow-up refresh, so a failed read cannot turn a confirmed save into an apparent failed write. Inactive queries become stale without speculative fetching. These endpoints are independent snapshots, not a shared commit watermark.

[ApiProjectEditor](../../src/features/projects/ApiProjectEditor.tsx) freezes creation key/body/time, bounds replay to 24 hours, submits dirty-field PATCHes with captured revision and requires explicit review for conflict/ambiguity. [Project handoff](../../src/app/auth/projectHandoff.ts) retains detached memory-only drafts solely across same-identity verification. Login/logout/session loss/account change destroys them. No restored draft automatically dispatches. Bounded Project CSRF recovery reuses AuthSession verification/token acquisition without automatic mutation replay.

Dashboard configuration is integrated; legacy business providers remain excluded. Authenticated Journal, Milestone and Link composition uses feature-owned server stores, while all legacy storage stays preserved and unused by authenticated composition. See [PLAN-0009](../plans/PLAN-0009-journal-integration.md), [PLAN-0010](../plans/PLAN-0010-milestone-integration.md), and [PLAN-0011](../plans/PLAN-0011-link-integration.md).

## Authenticated Home Dashboard

[DashboardStore](../../src/features/dashboard/apiStore.ts) owns one validated `GET /api/v1/dashboards/home` snapshot. [The contract model](../../src/features/dashboard/apiModel.ts) validates home ID/schema 1, server revision and ordered widgets, rejecting unsupported/unknown fields and invalid optional settings. Widget IDs are client-authored configuration identifiers, not business UUIDs. The confirmed DTO, local draft and submitted intent use the same widget schema; no second persisted layout exists.

[ApiDashboardWorkspace](../../src/features/dashboard/ApiDashboardWorkspace.tsx) preserves WidgetFrame/grid, drag and arrows, add/type/width/removal, cancel and explicit reset. [WidgetEditorView](../../src/features/dashboard/WidgetEditor.tsx) is shared with the legacy controller; the authenticated adapter supplies paginated all-owned Project options and direct selected UUID reads. Scope/search remain URL-backed presentation filters and are reset/disabled during full-layout editing. Business content is inert during layout editing; pending saves lock competing layout actions.

Only explicit save sends full `PUT {schemaVersion:1,revision,widgets}`. The server response must match the normalized submission and advance the captured revision before success is published. No Idempotency-Key, local revision increment or ambiguous PUT replay exists. Revision conflicts reload the latest Dashboard and retain the complete draft for explicit full-layout review/rebase or discard. A matching GET after an uncertain write can be selected without a new PUT. Failed reconciliation blocks blind saves; 400/404 preserve editable correction state. Virtual revision 0 never auto-saves, cold errors never substitute defaults, and persisted empty stays empty. The single schema-1 default template is only the confirmed `기본 배치` draft command, tested against actual unsaved GET.

[ServerDashboardHome](../../src/pages/ServerDashboardHome.tsx) composes the completed API stores inside configured frames. [ServerProjectOverview](../../src/pages/ServerProjectOverview.tsx) adapts the original rows/stats to independent Overview counters and Project lists/direct detail: explicit limit bounds rows only; omitted limit retains 20-row pages and retry/load-more. Boards default to a combined 20 records, newest read-only Journals to three, open read-only Milestones to two, and Links to their complete filtered collection. Configured Projects, including owned archived Projects, resolve directly outside first pages. Existing business-specific mutation restrictions still apply. DeploymentStatus retains clearly labeled examples and its informational modal, without an operational API.

Generation/abort/query sequence and mutation epochs reject stale results; a revision watermark rejects older Dashboard reads. Successful saves invalidate previous Dashboard reads and subscribed business surfaces without writing business resources. Project mutations revalidate Dashboard references/options and related presentations. [Dashboard handoff](../../src/app/auth/dashboardHandoff.ts) retains layout/editor/intent and per-widget Task drafts only across verified same-identity recovery; logout/account changes clear all of them. Legacy `devspace.layout.v1` is never read, written, migrated or deleted by authenticated composition.

## Authenticated Links

[LinkStore](../../src/features/links/apiStore.ts) keeps full filtered collections and independent UUID detail queries on the private transport. GET sends only scope and literal query; the server includes common all links in unity/server results, searches label/description/URL, and returns position-ordered items, matching total, null cursor and same-snapshot global collectionRevision. There is no pagination or client sorting/filter authority. Each list retains its own rows/revision pair; filtered snapshots cannot supply reorder authority.

[Link models](../../src/features/links/apiModel.ts) validate DTOs and wrappers independently from writable drafts. Description maps to the existing desc presentation without destructive trimming. UUIDs, positions, resource/collection revisions and audit timestamps are server-owned. Known URL hosts select display icons without reusing fixture IDs. [ApiLinks](../../src/features/links/ApiLinks.tsx) reuses the existing LinkRows layout, Korean editor fields and up/down controls. Filtered/stale lists disable reorder; Dashboard widget drag is a separate layout interaction.

All mutations are awaited and serialized per collection. Creation freezes an in-memory body/Idempotency-Key for explicit same-intent retry, then reconciles detail and full collection because a replay may describe an edited/deleted resource. PATCH uses dirty fields/current resource revision; permanent DELETE uses query revision and validates deletedId. PUT order sends the entire live ID permutation with its captured collectionRevision and installs the validated response atomically. A no-op still advances the server collection revision; gap compaction may advance item revisions. No client revision/position increments or automatic ambiguous replays occur.

Mutation epochs invalidate all Link list/detail/Home reads, remove confirmed deletions from retained rows and prevent stale publication. Session generation, abort signals and component lifetime guards suppress old results. [Link draft handoff](../../src/app/auth/linkHandoff.ts) preserves drafts/intents only for verified same-identity recovery; logout/account changes clear them. Resource conflicts retain the editor for explicit review; collection conflicts restore confirmed order and require a fresh user action after reload.

[ServerLinksPage](../../src/pages/ServerLinksPage.tsx) uses the preserved sidebar/topbar/scaffold at `/library`, with URL scope/search and existing filter/navigation guards. Authenticated Home injects ApiLinks read-only content into a single Dashboard WidgetFrame, using its configured scope, empty business query and full bounded collection. The server bounds collections at 500 or a lower configured quota; 429 has a correction message. There is no Project relation, legacy import or authenticated access to `devspace.links.v1`.

## Authenticated Milestones

[MilestoneStore](../../src/features/milestones/apiStore.ts) separates filter-bound cursor chains, direct UUID detail and validated entities. Lists send scope, Project UUID, Project status, Milestone status and limit; ordering is server `completed ASC, dueDate ASC NULLS LAST, id ASC`. Query changes and mutation epochs retire old cursor chains; failed later pages preserve confirmed rows with retry. Direct reads establish availability independently of list membership, and generation/cancellation guards reject stale or other-account results.

[API models](../../src/features/milestones/apiModel.ts) keep DTOs, drafts and writable serializers separate. Nullable `dueDate` is calendar-only with arithmetic validation, blank input maps to null, and untouched PATCH dates are omitted. `completed` derives open/done presentation; no persisted status/progress is invented. UUID/revision/audit timestamps and derived Project name/scope come from the server. [App-owned Project options](../../src/app/auth/milestoneProjectOptions.ts) include all owned active and archived Projects with pagination and direct selected-ID lookup. Unlike Task/Journal restrictions, Milestones permit creation and reassignment to archived Projects.

[ApiMilestoneList](../../src/features/milestones/ApiMilestoneList.tsx) and [ApiMilestoneEditor](../../src/features/milestones/ApiMilestoneEditor.tsx) preserve existing Korean rows, fields, date/completion controls, modal, focus recovery, layout and unsaved-navigation patterns. Mutations are awaited. Creation freezes key/body/field presence for explicit replay within 24 hours and directly reconciles the returned snapshot before treating it as current. PATCH uses captured revision/dirty fields; completion/reopening writes only completed. Permanent DELETE uses query revision and validates the returned deletedId. Conflict, uncertainty and failed reconciliation preserve drafts and require explicit review; no ambiguous business mutation replays automatically.

Project mutations invalidate Milestone options/list/detail presentation, including equal-revision Project rename/scope changes. Milestone mutations invalidate Milestone read surfaces, including old/new Project relations. App-owned [draft handoff](../../src/app/auth/milestoneHandoff.ts) preserves memory only across verified same-identity recovery; logout/account changes clear it. Authenticated code never reads or migrates `devspace.milestones.v1` or local Project milestone text.

Project detail injects the selected server UUID into full paginated Milestone management. Authenticated Home injects ApiMilestoneList into the configured Dashboard frame with its scope/Project and limit (default two), initial open status and read-only canonical Project navigation. It includes overdue/undated items in server order. Dashboard owns configuration, while the Milestone store remains data authority. Milestone presentation is isolated from broad auth-card styles.

## Authenticated Journals

[JournalStore](../../src/features/journal/apiStore.ts) validates the implemented Journal response, keeps per-filter cursor chains and direct UUID detail queries, and rejects obsolete results after request cancellation, mutation invalidation or session-generation changes. List requests send server scope, canonical `projectId`, project status, literal title/body/Project-name query, inclusive `from`/`to` dates, newest/oldest order and a bounded limit. A missing loaded row or exhausted page never establishes resource absence; editor entry, conflict review and selected Project views use `GET /api/v1/journals/{id}`.

The API model separates the editable `entryDate` calendar string from read-only `createdAt` and `updatedAt` audit timestamps. Date inputs and serializers keep `YYYY-MM-DD` values unchanged, without timezone or local-noon conversion. Bodies retain whitespace and newlines. Creation requires an active server Project and an in-memory Idempotency-Key/body intent for explicit replay within the backend window. PATCH sends the captured revision and dirty fields; permanent DELETE requires that revision and confirms the returned `deletedId`. Conflicts, CSRF failures, network failures and failed reconciliation retain drafts or deletion context for explicit review and retry.

Project options are injected from the app-owned ProjectStore. Active options are paginated; a selected archived Project is fetched directly and remains available for retaining its relation while reassignment is restricted to active Projects. Project mutations invalidate Journal lists, details, option queries and bounded recent widgets. Journal mutations invalidate all Journal read surfaces. The Home and Project-detail widgets are read-only, newest ordered, default to three rows, and receive Home settings from Dashboard configuration without owning layout persistence.

## Retained legacy composition

The following page/provider/widget implementation is preserved for [the test-only legacy entry](../../tests/legacy/main.tsx), served through its separate Vite configuration. It is not imported by the default App or selectable in a production build. Existing legacy tests keep their original URLs and independent browser contexts. API-only Project/Overview stores are separate from these legacy providers.

## Legacy state and persistence

ProjectsProvider wraps TasksProvider and JournalsProvider because they resolve project names and scopes from current project data. DashboardProvider owns saved layout and its editing draft. LinksProvider owns link data. WorkspaceProvider owns URL-backed filters/navigation, toast, and generic detail display and checks dashboard editing before navigation.

MilestonesProvider stores independent project-linked goals in `devspace.milestones.v1`. Without valid saved milestone data, existing project goal memos initialize stable-ID milestones with no deadline; the first successful milestone change saves the full list. An explicitly saved empty list stays empty. Subsequent project memo edits do not change independent milestones. Project names/scopes are resolved from current projects. Home and project detail share the provider; pending goals sort by date before undated goals, with completed goals available through the status filter. Deadlines are calendar dates without timezone conversion. Failed saves preserve state and editor drafts.

[usePersistedState](../../src/shared/hooks/usePersistedState.ts) validates stored JSON, falls back to initial data on invalid/unreadable storage, and updates React state only after localStorage writes succeed. Storage keys are `devspace.projects.v1`, `devspace.tasks.v1`, `devspace.journals.v1`, `devspace.links.v1`, and `devspace.layout.v1`. Layout cancellation does not roll back task changes. Failed writes return false and retain the previous saved state; editors keep their draft open for retry.

Project, Task, and JournalEntry types belong to their feature models. Project classification is defined in `src/features/projects/scope.ts`. Project/task/journal fixtures are in each feature's `fixtures.ts`; their values and IDs were retained during migration. Old tasks without projectId still resolve original seeded names through projects/model.ts's legacyProjectId before checking current project names. Renaming or archiving projects retains linked tasks and journals. There is no new storage schema or migration that clears user data.

Routes are `/`, `/projects`, `/projects/:projectId`, `/tasks`, `/journals`, and `/library`. Query parameters are `scope`, `q`, and `archived`. `src/app/useBrowserNavigation.ts` manages push/replace/pop history and restores rejected navigation. `devspace.navigation.v1` is a history.state key, not a localStorage key. Unsaved forms register a shared navigation guard and beforeunload listener.

`useMobileNavigation` owns mobile menu focus entry, Tab wrapping, Escape, scroll locking and focus restoration; main content is inert while the named menu dialog is open. Desktop resizing closes the mobile menu. Shared Modal names use heading IDs, focus the first form field after opening, and restore an available trigger on close. Project progress bars include project-specific accessible names.

## Authenticated Tasks

[TaskStore](../../src/features/tasks/apiStore.ts) separates status-filtered 20-row cursor chains, a combined Home budget, trash pages/badge, direct detail, independent stats and revision-aware entities. Query sequence, abort signal, session generation and mutation epoch checks reject stale publication. Inactive query entries are bounded; pages are fetched only on demand. Equal Task revisions can carry newer Project names/scope, ordered by the current read; creation replay snapshots are reconciled by direct GET before presentation.

[API models](../../src/features/tasks/apiModel.ts) validate complete UUID/audit/revision records and serialize only writable fields. Priority labels map explicitly to normal/high. Project relation is a server UUID; name and scope are read-only derived fields. App-owned [Project option adaptation](../../src/app/auth/taskProjectOptions.ts) injects paginated active options and independent selected-ID detail. Tasks import neither Project API internals nor legacy name/fixture authority.

[ApiTaskManager](../../src/features/tasks/ApiTaskManager.tsx) connects the reused Task board and trash to confirmed async commands. [ApiTaskEditor](../../src/features/tasks/ApiTaskEditor.tsx) reuses the original fields/modal, retains drafts on failure, freezes creation intents, and requires explicit reconciliation/reapply for conflicts or ambiguous existing-resource writes. DELETE and restore parse full 200 responses. [Task handoff](../../src/app/auth/taskHandoff.ts) preserves detached drafts only across same-identity verification; bounded security recovery is shared with Projects. Logout, expiration, disabled accounts and identity changes clear it.

Task writes invalidate all Task reads/stats and Overview. Project writes additionally invalidate Task reads and option queries through app composition. Stats exclude deleted Tasks and remain independent from loaded rows; trash ignores board search. The Home board is injected into one configured WidgetFrame with a combined limit (default 20). Each board instance has its own editor memory keyed by widget ID; identical read filters may share the Task store cache. Task markup is isolated from broad auth-card styles. Existing legacy adapters and storage remain unchanged.

## Legacy dashboard composition

[widgetCatalog](../../src/features/dashboard/widgetCatalog.ts) owns titles, descriptions, and icons. WidgetEditor and WidgetFrame use only this metadata. [widgetRenderers](../../src/pages/home/widgetRenderers.tsx) connects widget types to projects, tasks, journals, links, operations, and milestones. HomePage reads shared feature providers and injects the render callback into DashboardWorkspace. DashboardWorkspace owns layout editing, drag state, widget settings, and reset confirmation; it does not import the other content features.

DashboardProvider persists the layout array separately from task/project/journal/link records. The draft is committed only on layout save, and navigation is blocked while layout editing is active. Widget removal changes layout only. Widget types, IDs, array order, size values, and storage validators remain compatible with existing saved layouts.

Project overview, board, journal, and milestone widgets support optional `projectId` and `limit` (1–20). A selected project takes precedence over scope and remains available after archival; missing projects show a recovery message. Limits apply to displayed rows/cards, leaving overview statistics untruncated. Defaults remain unchanged when settings are absent. Selected-project widgets link to project detail. Operations and links have no project relation and do not expose these settings.

Journal edits preserve IDs and unchanged creation timestamps. Changed dates use local noon; inclusive date filters use local calendar dates. Project/date/order controls belong to JournalWorkspace and reset when leaving the page; global scope/search remain URL-backed. Deletion requires confirmation and is permanent. Failed edits/deletes retain saved data for retry.

## Styles

Styles enter through [app/styles/global.css](../../src/app/styles/global.css), in shared base, shared UI, app layout, dashboard, remaining features/shared content, and responsive order. Tokens are imported separately by main, preserving their previous cascade position. `app/styles/features.css` is the import manifest for feature-owned sheets and shared content layout. Catalog rules belong to dashboard; task title/recovery rules belong to tasks; shared styles contain no feature-specific selectors.

`app/styles/responsive.css` remains the final application-wide responsive composition layer because it coordinates the shell and several features. Widget-specific project-summary overrides remain in dashboard styles. The migration preserves existing design values; moving rules does not authorize a visual redesign.

## Validation and limitations

Unit tests are colocated with auth, HTTP, model and route modules. `tests/auth/` contains deterministic auth/session browser tests with storage sentinels and excluded-API assertions. `tests/real/` owns the disposable signed-token/PKCE provider and real backend/Vite/Nginx acceptance runner. Existing routing, CRUD, layout, failure and mobile tests run through the isolated legacy entry. See the [current commands and deployment inputs](../../README.md).

The isolated prototype retains its stabilization backlog and example Operations data. Authenticated Project detail now includes Task editing and a recent Journal view under [PLAN-0008](../plans/PLAN-0008-task-integration.md) and [PLAN-0009](../plans/PLAN-0009-journal-integration.md). The [historical API proposal](../references/api/backend-api-contract.md) does not override the implemented backend contracts referenced by the integration Plans. Auth, User/PersonalWorkspace, Projects, Overview, Tasks, Journals, Milestones, Links and Home Dashboard are integrated. `tests/tasks/` and `tests/journals/` cover API behavior, storage isolation and retained presentation; the legacy browser entry preserves existing prototype regressions.
