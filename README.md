# Devspace

Devspace is a React 19 and TypeScript workspace frontend. The default entry verifies a backend session through `/api/v1/me`, then displays the user's name and personal workspace. Google sign-in and CSRF-protected logout use the backend's existing session contract.

Projects and Tasks use backend data and mutations. The Task page retains its existing board, editor, trash and responsive shell. Home shows Overview and a temporary Task-only board; Project detail includes related Tasks. Journal, Milestone, Link and Dashboard APIs remain deferred. Existing prototype records are preserved in browser storage and are never read, imported or cleared by the authenticated entry.

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
node tests/real/run.mjs
node tests/real/run.mjs --nginx
node tests/real/run.mjs --projects=final
node tests/real/run.mjs --projects=final --nginx
node tests/real/run.mjs --projects=final --tasks=final
node tests/real/run.mjs --projects=final --tasks=final --nginx
```

Install Chromium with `npx playwright install chromium` if needed. Existing prototype regressions run on a separate test-only Vite entry at port 4175; auth tests use port 4176 and Project/Overview tests use port 4178, with isolated contexts. There is no production demo selector. Real acceptance runs sequentially on ports 18080 (backend), 18999 (disposable local OIDC provider), and 4175 or 4177 (Vite/Nginx). It requires Docker, Java 21 at the existing local JDK path, and the sibling backend checkout at `../dev-back/devspace`. The runner reuses its unchanged `bootTestRun`/PostgreSQL Testcontainers setup, rejects occupied ports, and stops only its own processes. Provider keys/tokens are disposable and are not packaged in the frontend image. Safe local evidence is retained under ignored `.auth-validation/`.

## Projects and counters

Project IDs, revisions and audit timestamps come exclusively from the server. Active/archived lists use 20-row cursor pages and explicit Load more; URL scope/search/status changes restart the chain. A selected Project is fetched directly, including archived Projects and Projects outside loaded pages or search. The current milestone is a memo string, not a Milestone resource.

Creation retains an immutable request and Idempotency-Key in memory for explicit retries within the backend's 24-hour replay window. Reload/logout/account changes lose that recovery state: review Projects before creating again after an unconfirmed result. Edits send only changed fields and the captured revision. Conflicts and ambiguous writes require review, reconciliation and an explicit new attempt. Archive preserves related resources and detail access.

Overview totals do not depend on loaded pages or search. Active and archived Project counts are separate; task aggregates include non-deleted tasks of archived Projects. Failed counters display unavailable/stale states, not fabricated zeros. Project mutations invalidate Project queries and Overview; manual refresh and session resumption discover external changes. Same-account verification may restore a detached draft, but never queues or retries a mutation automatically.

No local Project data is read as API authority, imported or deleted. Legacy fixture IDs never become server Project IDs. No additional environment variable is required.

## Tasks

The Task page and Project detail load independent 20-row status columns with cursor controls. Home uses one combined 20-Task budget across all columns, with Unity scope and no Dashboard API or saved-layout authority. Trash uses `deleted=true`, ignores board search, and has its own server total and pagination. `/tasks/stats` counts all matching live Tasks independently of loaded pages. Search uses server title-or-Project-name matching.

Task and Project UUIDs, revisions and audit metadata come from the server. Project name and scope are derived display fields; no name-based relation lookup runs in API mode. Creation/reassignment uses active Projects. Existing archived relations may be retained, and Tasks in archived Projects can be restored. The editor preserves all six fields and drafts after errors; status controls, drag/drop, delete and restore wait for confirmed responses. Revision conflicts require fresh detail and explicit review/reapply. Creation retries reuse an immutable body/key for at most 24 hours; no automatic replay or browser persistence is added.

Task mutations invalidate Task lists/details/stats and Overview. Project changes also invalidate Task reads and Project options, including same-revision derived name/scope changes. Session checking hides private content; detached drafts survive only verified same-identity recovery. Task browser tests use port 4179. Legacy `devspace.tasks.v1` remains preserved and unused.

## Structure and scope

- [Frontend architecture](docs/architecture/frontend.md): auth composition, transport and retained legacy implementation.
- [System overview](docs/architecture/overview.md): browser/proxy/backend boundary.
- [Plan index](docs/plans/README.md) and [PLAN-0006](docs/plans/PLAN-0006-frontend-auth-http-integration.md): execution and validation evidence.
- [PLAN-0007](docs/plans/PLAN-0007-project-overview-integration.md): Project/Overview contract, execution and validation evidence.
- [PLAN-0008](docs/plans/PLAN-0008-task-integration.md): Task integration, preserved UI and validation evidence.
- [Stabilization backlog](docs/plans/PLAN-0003-frontend-stabilization.md): unrelated pending prototype work.

The retained prototype includes project/task/journal/link/milestone CRUD, dashboard widgets, local persistence and accessibility workflows. Its providers, fixtures and legacy navigation remain available only to their separate regression harness. The [historical API proposal](docs/references/api/backend-api-contract.md) does not override the implemented backend contract referenced by PLAN-0006.
