# Frontend architecture

## Composition

The entry is [main.tsx](../../src/main.tsx), which renders [app/App.tsx](../../src/app/App.tsx). App composes AppProviders, AppLayout, and PageRouter. The router selects five primary pages, project detail, or the not-found page.

```text
src/
  main.tsx
  app/                 bootstrap, providers, routing, layouts, CSS composition
  pages/               route-level feature composition and input contracts
    home/              cross-feature widget renderers
  features/
    dashboard/         layout draft, catalog, widget frame/editor
    projects/          project data, classification, editor and summaries
    tasks/             task data, board, editor and recovery
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

[PageRouter](../../src/app/PageRouter.tsx) injects navigation/search callbacks and the presentation slots composed by [usePageScaffold](../../src/app/layouts/usePageScaffold.tsx). The shared [PageScaffold](../../src/shared/ui/PageScaffold.tsx) renders title, description, overview, feedback, filters, actions, and children without reading domain providers. Pages can suppress slots for detail and recovery screens.

ProjectsWorkspace, JournalWorkspace, LinkLibrary, and DashboardWorkspace own their feature-specific filters, editor state, and commands. URL filter values remain application-owned inputs. ProjectDetailPage joins projects, tasks, and journals by project ID; useProjectEditor owns the project editing state. ProjectsWorkspace receives task status summaries through page composition rather than importing the tasks feature.

## State and persistence

ProjectsProvider wraps TasksProvider and JournalsProvider because they resolve project names and scopes from current project data. DashboardProvider owns saved layout and its editing draft. LinksProvider owns link data. WorkspaceProvider owns URL-backed filters/navigation, toast, and generic detail display and checks dashboard editing before navigation.

MilestonesProvider stores independent project-linked goals in `devspace.milestones.v1`. Without valid saved milestone data, existing project goal memos initialize stable-ID milestones with no deadline; the first successful milestone change saves the full list. An explicitly saved empty list stays empty. Subsequent project memo edits do not change independent milestones. Project names/scopes are resolved from current projects. Home and project detail share the provider; pending goals sort by date before undated goals, with completed goals available through the status filter. Deadlines are calendar dates without timezone conversion. Failed saves preserve state and editor drafts.

[usePersistedState](../../src/shared/hooks/usePersistedState.ts) validates stored JSON, falls back to initial data on invalid/unreadable storage, and updates React state only after localStorage writes succeed. Storage keys are `devspace.projects.v1`, `devspace.tasks.v1`, `devspace.journals.v1`, `devspace.links.v1`, and `devspace.layout.v1`. Layout cancellation does not roll back task changes. Failed writes return false and retain the previous saved state; editors keep their draft open for retry.

Project, Task, and JournalEntry types belong to their feature models. Project classification is defined in `src/features/projects/scope.ts`. Project/task/journal fixtures are in each feature's `fixtures.ts`; their values and IDs were retained during migration. Old tasks without projectId still resolve original seeded names through projects/model.ts's legacyProjectId before checking current project names. Renaming or archiving projects retains linked tasks and journals. There is no new storage schema or migration that clears user data.

Routes are `/`, `/projects`, `/projects/:projectId`, `/tasks`, `/journals`, and `/library`. Query parameters are `scope`, `q`, and `archived`. `src/app/useBrowserNavigation.ts` manages push/replace/pop history and restores rejected navigation. `devspace.navigation.v1` is a history.state key, not a localStorage key. Unsaved forms register a shared navigation guard and beforeunload listener.

`useMobileNavigation` owns mobile menu focus entry, Tab wrapping, Escape, scroll locking and focus restoration; main content is inert while the named menu dialog is open. Desktop resizing closes the mobile menu. Shared Modal names use heading IDs, focus the first form field after opening, and restore an available trigger on close. Project progress bars include project-specific accessible names.

## Dashboard composition

[widgetCatalog](../../src/features/dashboard/widgetCatalog.ts) owns titles, descriptions, and icons. WidgetEditor and WidgetFrame use only this metadata. [widgetRenderers](../../src/pages/home/widgetRenderers.tsx) connects widget types to projects, tasks, journals, links, operations, and milestones. HomePage reads shared feature providers and injects the render callback into DashboardWorkspace. DashboardWorkspace owns layout editing, drag state, widget settings, and reset confirmation; it does not import the other content features.

DashboardProvider persists the layout array separately from task/project/journal/link records. The draft is committed only on layout save, and navigation is blocked while layout editing is active. Widget removal changes layout only. Widget types, IDs, array order, size values, and storage validators remain compatible with existing saved layouts.

Project overview, board, journal, and milestone widgets support optional `projectId` and `limit` (1–20). A selected project takes precedence over scope and remains available after archival; missing projects show a recovery message. Limits apply to displayed rows/cards, leaving overview statistics untruncated. Defaults remain unchanged when settings are absent. Selected-project widgets link to project detail. Operations and links have no project relation and do not expose these settings.

Journal edits preserve IDs and unchanged creation timestamps. Changed dates use local noon; inclusive date filters use local calendar dates. Project/date/order controls belong to JournalWorkspace and reset when leaving the page; global scope/search remain URL-backed. Deletion requires confirmation and is permanent. Failed edits/deletes retain saved data for retry.

## Styles

Styles enter through [app/styles/global.css](../../src/app/styles/global.css), in shared base, shared UI, app layout, dashboard, remaining features/shared content, and responsive order. Tokens are imported separately by main, preserving their previous cascade position. `app/styles/features.css` is the import manifest for feature-owned sheets and shared content layout. Catalog rules belong to dashboard; task title/recovery rules belong to tasks; shared styles contain no feature-specific selectors.

`app/styles/responsive.css` remains the final application-wide responsive composition layer because it coordinates the shell and several features. Widget-specific project-summary overrides remain in dashboard styles. The migration preserves existing design values; moving rules does not authorize a visual redesign.

## Validation and limitations

Unit tests are colocated with models and routes; `tests/` contains Playwright routing, CRUD, layout, save-failure, and mobile regression tests. See the [development guide](../guides/development.md).

Operations still show example data. Project-detail task editing remains in the [separate stabilization backlog](../plans/PLAN-0003-frontend-stabilization.md). Journal management and project widget settings are tracked in [PLAN-0004](../plans/PLAN-0004-journal-and-project-widgets.md); milestones and accessibility are tracked in [PLAN-0005](../plans/PLAN-0005-milestones-and-accessibility.md). The [API contract](../references/api/backend-api-contract.md) is a future design, not an implemented client or server.
