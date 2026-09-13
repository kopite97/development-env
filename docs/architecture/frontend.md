# Frontend architecture

## Composition

The entry is [main.tsx](../../src/main.tsx), which renders [app/App.tsx](../../src/app/App.tsx). App composes the app-owned [AuthApp](../../src/app/auth/AuthApp.tsx) and [AuthSession](../../src/app/auth/session.ts). GET /api/v1/me gates five distinct states: checking, unauthenticated, disabled, bootstrap-error and authenticated. The authenticated shell displays server User/PersonalWorkspace, API-backed Project, Overview and Journal surfaces. It mounts none of the legacy business providers. Identity is partitioned by User ID, Workspace ID and independent session generation; Workspace revision is not a session counter.

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

[PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx) composes isolated feature stores with the existing AuthSession transport and captured generation. [ServerProjectsPage](../../src/pages/ServerProjectsPage.tsx) joins Project UI, Overview, Tasks and the bounded recent-Journal view by validated server UUID without a cross-feature import. Root shows global Overview, the temporary Task-only Home board and a read-only newest Journal widget; `/tasks` uses the preserved Task shell and `/journals` uses the preserved Journal presentation with server reads. Library remains pending. App-owned history guards ordinary draft/pending navigation with one confirmation; auth teardown takes precedence.

[Project API models](../../src/features/projects/apiModel.ts) validate UUID/revision/audit metadata and explicitly serialize writable fields. Presentation maps currentMilestone to the memo, status to archived, and colorToken to a visual class. No fixture lookup or local UUID generation supplies resource identity. Creation keys are operation identifiers only.

[ProjectStore](../../src/features/projects/apiStore.ts) separates filter-bound cursor chains, direct detail and revision-aware entities. Pages are 20 rows; only a null cursor ends traversal. Direct archived detail never depends on list membership. [OverviewStore](../../src/features/overview/apiStore.ts) deduplicates scope/project queries independently of Project search, status and pagination. Active and archived counts are separate; aggregate task counts include archived Projects and exclude soft-deleted tasks.

Queries combine AbortControllers, generation checks and request sequencing. Mutation epochs retire old Project reads; Overview invalidation retires old aggregate reads. Successful mutation responses seed confirmed entities before follow-up refresh, so a failed read cannot turn a confirmed save into an apparent failed write. Inactive queries become stale without speculative fetching. These endpoints are independent snapshots, not a shared commit watermark.

[ApiProjectEditor](../../src/features/projects/ApiProjectEditor.tsx) freezes creation key/body/time, bounds replay to 24 hours, submits dirty-field PATCHes with captured revision and requires explicit review for conflict/ambiguity. [Project handoff](../../src/app/auth/projectHandoff.ts) retains detached memory-only drafts solely across same-identity verification. Login/logout/session loss/account change destroys them. No restored draft automatically dispatches. Bounded Project CSRF recovery reuses AuthSession verification/token acquisition without automatic mutation replay.

Milestone, Link and Dashboard APIs/providers remain excluded. Authenticated Journal composition uses [JournalStore](../../src/features/journal/apiStore.ts), while all legacy storage stays preserved and unused by authenticated composition. See [PLAN-0009](../plans/PLAN-0009-journal-integration.md).

## Authenticated Journals

[JournalStore](../../src/features/journal/apiStore.ts) validates the implemented Journal response, keeps per-filter cursor chains and direct UUID detail queries, and rejects obsolete results after request cancellation, mutation invalidation or session-generation changes. List requests send server scope, canonical `projectId`, project status, literal title/body/Project-name query, inclusive `from`/`to` dates, newest/oldest order and a bounded limit. A missing loaded row or exhausted page never establishes resource absence; editor entry, conflict review and selected Project views use `GET /api/v1/journals/{id}`.

The API model separates the editable `entryDate` calendar string from read-only `createdAt` and `updatedAt` audit timestamps. Date inputs and serializers keep `YYYY-MM-DD` values unchanged, without timezone or local-noon conversion. Bodies retain whitespace and newlines. Creation requires an active server Project and an in-memory Idempotency-Key/body intent for explicit replay within the backend window. PATCH sends the captured revision and dirty fields; permanent DELETE requires that revision and confirms the returned `deletedId`. Conflicts, CSRF failures, network failures and failed reconciliation retain drafts or deletion context for explicit review and retry.

Project options are injected from the app-owned ProjectStore. Active options are paginated; a selected archived Project is fetched directly and remains available for retaining its relation while reassignment is restricted to active Projects. Project mutations invalidate Journal lists, details, option queries and bounded recent widgets. Journal mutations invalidate all Journal read surfaces. The Home and Project-detail widgets are read-only, newest ordered, default to three rows, and have no Dashboard API or saved-layout authority.

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

Task writes invalidate all Task reads/stats and Overview. Project writes additionally invalidate Task reads and option queries through app composition. Stats exclude deleted Tasks and remain independent from loaded rows; trash ignores board search. The Home board reuses WidgetFrame presentation with one combined limit (default 20), without Dashboard providers, API or stored layout. Task markup is isolated from broad auth-card styles. Existing legacy adapters and storage remain unchanged.

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

The isolated prototype retains its stabilization backlog and example Operations data. Authenticated Project detail now includes Task editing and a recent Journal view under [PLAN-0008](../plans/PLAN-0008-task-integration.md) and [PLAN-0009](../plans/PLAN-0009-journal-integration.md). The [historical API proposal](../references/api/backend-api-contract.md) does not override the implemented backend contracts referenced by the integration Plans. Auth, User/PersonalWorkspace, Projects, Overview, Tasks and Journals are integrated; Milestone, Link and Dashboard APIs remain deferred. `tests/tasks/` and `tests/journals/` cover API behavior, storage isolation and retained presentation; the legacy browser entry preserves existing prototype regressions.
