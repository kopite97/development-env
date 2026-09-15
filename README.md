# Devspace

Devspace is a React 19 and TypeScript workspace frontend. The default entry verifies a backend session through `/api/v1/me`, then displays the user's name and personal workspace. Google sign-in and CSRF-protected logout use the backend's existing session contract.

Projects, Tasks, Journals, Milestones and Links use backend data and mutations. The Task page retains its existing board, editor, trash and responsive shell. Home shows Overview, a Task board, recent Journals and read-only Milestone/Link widgets; Project detail includes Task and Milestone management and recent Journals. Library preserves its Link editor and up/down ordering controls. Home configuration now comes from the Dashboard API, preserving the grid, widget editor, drag/arrow ordering and sizes. The deployment widget remains an explicitly labeled example. Existing prototype records are preserved in browser storage and are never read, imported or cleared by the authenticated entry.

## Development

Use Node.js 22.12 or newer:

```sh
npm ci
npm run dev
```

The local frontend origin is `http://127.0.0.1:5173`. Root `.env` and [.env.example](.env.example) contain the server-only `BACKEND_UPSTREAM=http://127.0.0.1:8080` proxy setting. Do not prefix it with `VITE_`. Browser requests remain relative; Vite forwards `/api` and `/oauth2`, including nested paths, without rewriting them.

Configure the backend's `APP_ORIGIN=http://127.0.0.1:5173` and Google callback `OIDC_GOOGLE_REDIRECT_URI=http://127.0.0.1:5173/api/v1/auth/callback/google` together. Backend credentials stay in backend configuration. Use one hostname consistently. A missing backend produces a retryable connection screen; it never opens the prototype.

## Container

```sh
docker build -t devspace .
docker run --rm -p 10000:10000 -e BACKEND_UPSTREAM=http://host.docker.internal:8080 devspace
```

The official Nginx image renders the upstream into [nginx.conf](nginx.conf) at startup. Supply a reachable HTTP(S) origin without a path suffix. Missing upstream fails startup. SPA routes fall back to the index; API and OAuth failures retain backend/proxy status. Login and callback access logs are disabled to avoid recording provider parameters.

For live deployment, use an HTTPS browser origin, matching backend `APP_ORIGIN`, a registered Google callback at that origin's `/api/v1/auth/callback/google`, and backend `SESSION_COOKIE_SECURE=true`. Use the configured callback and trust forwarded headers only from controlled ingress. The local HTTP container tests use isolated Secure=false settings; they do not establish a production TLS or Google rollout.

## Validation

```sh
npm run check:boundaries
npm run check:docs
npm test
npm run build
node tools/check-auth-artifact.mjs
npm run test:e2e
npx playwright test --config playwright.auth.config.ts
npx playwright test --config playwright.projects.config.ts
npx playwright test --config playwright.tasks.config.ts
npm run dev -- --port 4180 --strictPort
$env:JOURNAL_REUSE_SERVER='1'; npx playwright test --config playwright.journals.config.ts
node tests/real/run.mjs
node tests/real/run.mjs --nginx
node tests/real/run.mjs --category-only
node tests/real/run.mjs --category-only --nginx
npm run dev -- --port 4181 --strictPort
$env:MILESTONE_REUSE_SERVER='1'; npx playwright test --config playwright.milestones.config.ts
```

Install Chromium with `npx playwright install chromium` if needed. Existing prototype regressions run on a separate test-only Vite entry at port 4175; auth tests use port 4176, Project/Overview tests use port 4178, Task tests use port 4179 and Journal tests use port 4180, with isolated contexts. There is no production demo selector. Real acceptance runs sequentially on ports 18080 (backend), 18999 (disposable local OIDC provider), and 4175 or 4177 (Vite/Nginx). It requires Docker, Java 21 at the existing local JDK path, and a sibling backend checkout at `../backend` or the historical `../dev-back/devspace` path. The runner reuses its unchanged `bootTestRun`/PostgreSQL Testcontainers setup, rejects occupied ports, and stops only its own processes. Provider keys/tokens are disposable and are not packaged in the frontend image. Safe local evidence is retained under ignored `.auth-validation/`.

## Category-only API

Normal business requests use `/api/v2`; authentication and Category CRUD retain `/api/v1`. Project Category UUID is the only authenticated classification identity. No scope-to-name inference, legacy provider or localStorage authority exists. URL `category=all|uncategorized|UUID` filters real queries; resource Project filters intersect it. Home overrides saved selection for Overview, Tasks, Journals, Milestones and Links, never Deploy, and never persists its transient filter. Links may be unlinked or assigned to active/archived Projects.

The workspace data revision header protects derived data when resource revisions do not change. Category rename refreshes labels independently. Pending creation intents bind original API version/body/key; old v1 replay is never automatically converted to a new v2 creation. Coordinate deployment with the backend cutover and pending-intent drain. Historical feature runner flags now fail fast; use the coordinated `--category-only` suite. See [PLAN-0014](docs/plans/PLAN-0014-project-category-only-transition.md).

## Home Dashboard

GET `/api/v2/dashboards/home` owns widget order, titles, sizes, selection (all/uncategorized/Project UUID/Category UUID) and optional limits. Virtual revision-0 defaults are displayed without auto-saving; a saved empty array stays empty. The existing editor keeps a draft until an awaited full PUT succeeds. Conflicts and uncertain responses preserve that draft and require explicit comparison/reconciliation, never automatic replay. `기본 배치` changes the draft using the one contract-tested schema-2 reset template.

Overview uses server counters plus Project rows (pagination when limit is omitted); boards use a combined default limit 20, recent Journals 3 and open Milestones 2. Links use their full server collection. Owned archived Project references resolve by UUID independently of pages. Deployment remains labeled example/demo data. `devspace.layout.v1` remains preserved and unused by authenticated code.

Start Vite on port 4183, set `DASHBOARD_REUSE_SERVER=1`, and run `npx playwright test --config playwright.dashboard.config.ts`. Run `node tests/real/run.mjs --category-only` and the same command with `--nginx` sequentially for disposable real acceptance. See [PLAN-0012](docs/plans/PLAN-0012-dashboard-integration.md) for contract, validation and recovery evidence.

## Projects and counters

Project IDs, revisions and audit timestamps come exclusively from the server. Active/archived lists use 20-row cursor pages and explicit Load more; URL category/search/status changes restart the chain. A selected Project is fetched directly, including archived Projects and Projects outside loaded pages or search. The current milestone is a memo string, not a Milestone resource.

Creation retains an immutable request and Idempotency-Key in memory for explicit retries within the backend's 24-hour replay window. Reload/logout/account changes lose that recovery state: review Projects before creating again after an unconfirmed result. Edits send only changed fields and the captured revision. Conflicts and ambiguous writes require review, reconciliation and an explicit new attempt. Archive preserves related resources and detail access.

Overview totals do not depend on loaded pages or search. Active and archived Project counts are separate; task aggregates include non-deleted tasks of archived Projects. Failed counters display unavailable/stale states, not fabricated zeros. Project mutations invalidate Project queries and Overview; manual reads and workspace-revision observations discover external changes without focus-triggered business reloads. Same-account verification may restore a detached draft, but never queues or retries a mutation automatically.

No local Project data is read as API authority, imported or deleted. Legacy fixture IDs never become server Project IDs. No additional environment variable is required.

## Tasks

The Task page and Project detail load independent 20-row status columns with cursor controls. Home uses one combined 20-Task budget across all columns, with effective Category/Project selection and an optional smaller combined limit. Trash uses `deleted=true`, ignores board search, and has its own server total and pagination. `/tasks/stats` counts all matching live Tasks independently of loaded pages. Search uses server title-or-Project-name matching.

Task and Project UUIDs, revisions and audit metadata come from the server. Project name and categoryId are derived display fields; no name-based relation lookup runs in API mode. Creation/reassignment uses active Projects. Existing archived relations may be retained, and Tasks in archived Projects can be restored. The editor preserves all six fields and drafts after errors; status controls, drag/drop, delete and restore wait for confirmed responses. Revision conflicts require fresh detail and explicit review/reapply. Creation retries reuse an immutable body/key for at most 24 hours; no automatic replay or browser persistence is added.

Task mutations invalidate Task lists/details/stats and Overview. Project changes also invalidate Task reads and Project options, including same-revision derived name/category changes. Background verification preserves the mounted shell/drafts for the same identity; hard session boundaries retire private state. Task browser tests use port 4179. Legacy `devspace.tasks.v1` remains preserved and unused.

## Journals

Authenticated Journals use server DTOs and canonical Project UUIDs. The editable date is the date-only `entryDate`; `createdAt` and `updatedAt` remain audit timestamps. Requests preserve `YYYY-MM-DD` values and Journal bodies exactly, including whitespace and newlines. The Journal page delegates category, Project, title/body/Project-name search, inclusive date bounds, newest/oldest ordering, totals and cursor pagination to the backend, and uses direct UUID reads for editor entry, conflict review and Project detail.

Creation requires an active Project and keeps an in-memory Idempotency-Key/body intent for explicit same-key retries. PATCH sends the captured revision and dirty fields; permanent DELETE requires the revision and confirms `{deletedId}`. Conflicts, CSRF/network failures and failed reconciliation retain drafts or deletion context. Archived relations remain readable and editable for non-relation fields, while reassignment requires an active Project. Home recent Journals are read-only; Project detail reuses locked-Project Journal creation. Both lists are newest ordered and limited to three by default with Home Category/Project/limit supplied by Dashboard configuration. Legacy `devspace.journals.v1` and fixtures remain preserved and unused by authenticated composition. Journal browser tests use port 4180.

## Links

Library uses server category/search and full collection ordering, with no pagination. Create/edit/permanent-delete are awaited; drafts survive failures and conflicts. Up/down ordering submits every live Link ID with collectionRevision. IDs, item revisions, positions and audit fields come from the backend. Home remains read-only, uses the effective Dashboard selection and shows the full bounded collection. Legacy `devspace.links.v1` stays preserved and unused.

Run the Link browser suite with Vite on port 4182 and `LINK_REUSE_SERVER=1`: `npx playwright test --config playwright.links.config.ts`. Real disposable-backend acceptance is `node tests/real/run.mjs --category-only`, then its `--nginx` counterpart. See the [development guide](docs/guides/development.md) for visual and concurrency checks.

## Milestones

Project detail preserves the Milestone rows, Korean editor fields, completion/reopen controls and status filter with awaited API operations. Lists use server category, Project UUID, Project status and `open|done|all` filters with 20-row cursor pagination and fixed completion/date/UUID ordering. Detail reads are independent of loaded pages. `dueDate` is nullable `YYYY-MM-DD` without timezone conversion; `completed` supplies all completion presentation. Status is only a query filter. Server UUID, revision and audit timestamps remain authoritative.

Owned active **and archived** Projects allow creation, editing, reassignment and deletion. Project names/categoryIds are derived display fields; Project options paginate and selected relations resolve directly. Creation freezes an explicit-field body and Idempotency-Key for reviewed retries within 24 hours. PATCH sends intended fields and the captured revision. DELETE is permanent, sends revision in the query and validates `200 {deletedId}`. Conflicts and ambiguous outcomes require explicit direct-read reconciliation; drafts survive errors and same-identity revalidation, with no automatic business replay.

Milestone and Project changes invalidate related list/detail/options/Home views. Home keeps the existing widget presentation with effective Category/Project selection, initial `open` status and an omitted-limit default of two records, including overdue and undated rows in server order. It is read-only and navigates to canonical Project detail for management. The Milestone feature owns its data; Dashboard only supplies widget configuration. `devspace.milestones.v1` remains preserved and unused; no migration is performed. Browser tests use port 4181.

## Structure and scope

- [Decision index](docs/decisions/README.md): architectural records and approval status.
- [Frontend architecture](docs/architecture/frontend.md): auth composition, transport and retained legacy implementation.
- [System overview](docs/architecture/overview.md): browser/proxy/backend boundary.
- [Plan index](docs/plans/README.md) and [PLAN-0006](docs/plans/PLAN-0006-frontend-auth-http-integration.md): execution and validation evidence.
- [PLAN-0007](docs/plans/PLAN-0007-project-overview-integration.md): Project/Overview contract, execution and validation evidence.
- [PLAN-0008](docs/plans/PLAN-0008-task-integration.md): Task integration, preserved UI and validation evidence.
- [PLAN-0009](docs/plans/PLAN-0009-journal-integration.md): Journal integration, preserved UI and final validation evidence.
- [PLAN-0010](docs/plans/PLAN-0010-milestone-integration.md): Milestone integration, archived Project semantics, Home behavior and validation evidence.
- [PLAN-0011](docs/plans/PLAN-0011-link-integration.md): Link collection/CRUD/reorder integration, preserved library/Home and validation evidence.
- [Stabilization plan](docs/plans/PLAN-0003-frontend-stabilization.md): historical prototype scope retained for reference.

The retained prototype includes project/task/journal/link/milestone CRUD, dashboard widgets, local persistence and accessibility workflows. Its providers, fixtures and legacy navigation remain available only to their separate regression harness. The [historical API proposal](docs/references/api/backend-api-contract.md) does not override the implemented backend contract referenced by PLAN-0006.
