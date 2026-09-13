# PLAN-0006: Frontend Authentication and Shared HTTP Foundation

Status: `completed`

## Goal

Establish a same-origin, session-authenticated frontend entry point with backend-owned User/PersonalWorkspace bootstrap and a reusable fetch foundation. Private application state must exist only after `/api/v1/me` succeeds, and must be invalidated safely on logout, session expiration or account change. Existing local prototype records remain untouched and do not become authenticated application data.

Approved by the user on 2026-09-13, including the proposed contract and clarifications. All six sessions were executed in order and completed under the self-recovery policy on 2026-09-13.

## Scope

- Implementation and Plan-owning repository: `C:\Develop\dev-env\frontend`. This frontend Plan is the single source of truth; [the frontend Plan index](README.md) tracks its execution order and status. Follow [the frontend runtime Plan template](PLAN-TEMPLATE-RUNTIME.md) and [Plan lifecycle rules](PLANS.md).
- Implemented API contract/source reference only: `C:\Develop\dev-env\dev-back\devspace`. The backend repository does not own or index this Plan. Do not retain an independently editable backend copy or activate the frontend's unrelated stabilization backlog.
- Inputs: [frontend readiness review](../../../backend/docs/reviews/2026-09-13-frontend-backend-integration-readiness.md), [backend OpenAPI review](../../../backend/docs/reviews/2026-09-13-backend-openapi-contract-review.md), completed [authentication Plan](../../../backend/docs/plans/PLAN-0003-authentication-session.md), and the actual generated backend contract. Cross-repository links assume the sibling checkout layout (`frontend` and `backend` under `C:\dev\devspace`); backend-linked documents are API/source evidence, not a second Plan authority. Frontend inspection baseline: commit `75e679358e482c64f5e79ac7699948029ae3d6d2` with a clean working tree; recheck before execution.
- Include `/me` bootstrap, User/PersonalWorkspace state, auth routing/states, Google entry, logout, CSRF lifecycle, shared fetch/error/cancellation/session-generation handling, same-origin development/deployment proxy configuration, and meaningful unit/browser/backend-boundary validation.
- Include the minimum authenticated shell and route placeholders needed to expose authentication without mounting unfinished business features or their local providers. Preserve existing business implementation for later Plans and test-only legacy regression coverage.
- Preserve the six existing localStorage business keys and their contents. Do not import, delete, migrate, assign ownership, upload or use them as API-mode authority.
- Use the installed React/TypeScript/Vite/Vitest/Playwright stack and native browser/fetch APIs. No new runtime HTTP, router, state-management or query-cache dependency. Shared transport must respect existing frontend dependency boundaries.
- Backend files and API/security/domain behavior are outside this frontend implementation scope. Own new fixtures, runners and acceptance-test support in the frontend repository; consume the existing backend application/test setup as an external contract-validation target. If validation requires backend source or test-support changes, report a separate scope decision before making them. No test login bypass or fixture endpoint may enter a production artifact.
- **Exclude** Project, Task, Journal, Milestone, Link, Dashboard and Overview API integration, including incidental list requests, counts, selectors, mutations, Dashboard defaults/GET/PUT and automatic business seeding. Do not add Workspace editing, multiple Workspaces, account deletion, JWT/browser tokens, refresh-token APIs, Google SDK login, deployment monitoring or unrelated feature/UI enhancements.
- Infrastructure work is limited to the existing frontend Vite/Nginx/Docker configuration and local validation. No live deployment, DNS/certificate provisioning, production Google configuration or new shared infrastructure is executed by this Plan.

## Changes

1. Replace immediate prototype-provider bootstrap with an auth-only boundary and backend User/PersonalWorkspace state.
2. Add shared fetch, common errors, in-memory CSRF, cancellation and session-generation handling.
3. Configure same-origin Vite/Nginx forwarding and frontend-owned auth/proxy tests while preserving legacy local data.
4. Maintain lifecycle and completion evidence in this frontend Plan and its index.

## Approved Integration Decisions

1. Browser routing is same-origin. Proxy `/api/**` and `/oauth2/**` to the backend, preserving their paths. Ordinary frontend routes remain SPA routes.
2. Backend `/me` is the authenticated application bootstrap.
3. Preserve legacy localStorage records without using them as authenticated authority or automatically importing/deleting/assigning them.
4. Keep the existing disabled-account callback behavior in the initial integration; do not change backend redirect/error behavior to improve its UX.
5. No Workspace editing or unrelated business-feature integration.

Approval of this Plan additionally accepts the concrete auth-only screen boundary, test-only legacy regression entry, bounded CSRF recovery policy, local test topology and test fixture scope below. These are implementation choices for this Plan, not new repository-wide architectural rules.

## Existing Structure and Intended Boundary

Today `src/main.tsx` mounts `App → AppProviders → AppLayout → PageRouter`. AppProviders immediately mounts Projects, Tasks, Journals, Dashboard, Links and Milestones, then Workspace. Their localStorage/fixture fallbacks are used immediately. WorkspaceProvider holds navigation/search/toast/detail state and depends on Dashboard editing; it is not backend PersonalWorkspace state. Sidebar/Topbar/scaffold consume business providers and display static identity and local array counts.

The default production/development entry will instead compose:

```text
main.tsx (StrictMode)
  App
    app-owned auth/session composition + shared fetch transport
      checking / anonymous / disabled / bootstrap-error screens
      authenticated boundary, keyed by identity and session generation
        auth-only shell: displayName, workspace.name, logout
        ordinary route identification and integration-pending content
```

- Call `/me` before mounting any private feature provider. **No existing business provider is mounted even after authentication in this Plan**, because none has a server-backed implementation yet. Authentication success must not unlock the old local prototype as if it were synced data.
- Reuse pure route helpers, shared controls/tokens and appropriate presentational shell elements. Do not mount existing WorkspaceProvider/AppLayout solely for visual reuse: they currently pull in business state. Introduce a focused auth-only app shell, or separate presentational portions with explicit props, keeping this change small and avoiding a broad layout refactor.
- `/`, `/projects`, `/projects/:id`, `/tasks`, `/journals`, `/library` remain recognizable URLs after authentication. Show a clear feature-integration-pending state, not fabricated empty data, counters, active CRUD controls, local Dashboard widgets or an entity 404 inferred from a missing list. Unknown frontend paths may show the existing-style not-found state after the gate. This Plan does not resolve any Project ID through a business API.
- Public routing is decided outside the protected shell. Root `/` can serve the anonymous login entry or authenticated readiness screen. A separate `/login` route is not required and must not be confused with the backend login endpoint.
- Identity state is separate from the old UI Workspace state. An app-owned session provider/reducer can expose identity to app shell components; shared transport receives callbacks/dependencies through composition and does not import app hooks. Business features do not import a new auth feature under an unapproved cross-feature exception.
- Domain-specific request/response types belong at the auth boundary; `shared/http` contains feature-agnostic transport/error contracts only. Do not move User/Workspace ownership logic into shared or trust client identity fields for authorization.

## Auth API and Frontend Models

All API paths below are browser-relative under the approved common origin.

| Operation                           | Approved backend contract                                                                                                                                          | Frontend responsibility                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| GET `/api/v1/me`                    | 200 `{id,displayName,workspace:{id,name,revision}}`; authenticated session; 401 AUTH_REQUIRED, 403 ACCOUNT_DISABLED, applicable server failures                    | Validate/narrow the response; establish identity; no ownership query/header input      |
| GET `/api/v1/auth/login?returnTo=…` | 302 to `/oauth2/authorization/google`, then provider authorization                                                                                                 | Top-level browser navigation on explicit user action; no fetch-based OAuth transaction |
| GET `/api/v1/auth/callback/google`  | Spring Security callback; success redirects to validated local returnTo; ordinary failure to `/?authError=login_failed`; disabled-account edge may return 403 JSON | Proxy to backend; do not implement a frontend callback controller or token exchange    |
| GET `/api/v1/auth/csrf`             | 200 `{csrfToken}`; session-bound, no query token; 401/disabled 403/error possible                                                                                  | Keep in memory only; obtain before authenticated mutation                              |
| POST `/api/v1/auth/logout`          | Authenticated CSRF required; no-session request also returns bodyless 204 without CSRF; applicable 401/403 errors                                                  | Await actual outcome, clear private state and token; no business API call              |

Represent `User` as server ID and displayName; PersonalWorkspace as ID, name and its returned positive integer revision. Preserve the distinction between Workspace revision and session generation: Workspace revision is not a session counter. Do not synthesize email, avatar URL, memberships, workspace timestamps, permissions, dataRevision or business counts absent from `/me`. Presentation may derive an avatar initial from displayName. No persistence of identity or credential-bearing responses to localStorage/sessionStorage/IndexedDB.

Backend cookie name is configurable and HttpOnly. Frontend does not inspect, set or depend on a hard-coded cookie name. The backend owns cookie issuance, expiry, session fixation handling, disabled-account enforcement and ownership.

## Bootstrap State Machine and Route Behavior

| State             | Entry/result                                                           | Required UI and request behavior                                                                                       |
| ----------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `checking`        | Initial mount, explicit retry or identity revalidation                 | Accessible loading status; private tree absent/inert; no fixtures, background business reads or writes                 |
| `authenticated`   | Valid 200 `/me` for current generation                                 | Store User/Workspace in memory; mount auth-only shell; allow logout subject to CSRF readiness                          |
| `unauthenticated` | Current-generation 401; confirmed logout                               | Login entry, safe intended route; no private state or automatic redirect loop                                          |
| `disabled`        | Current-generation 403 ACCOUNT_DISABLED                                | Dedicated disabled notice; private state removed; no repeated login/token retries                                      |
| `bootstrap-error` | Network/timeout/5xx, malformed 200, unexpected 403 or response content | Retryable error distinct from unauthenticated; show safe message and requestId where available; no local/demo fallback |

- Trigger one logical `/me` bootstrap per active lifecycle. Deduplicate concurrent callers and tolerate StrictMode effect setup/cleanup/replay; cancelled/obsolete work must never settle a later generation. No useEffect performs login, logout, writes, local-data migration or Dashboard save.
- Treat identity as `(user.id, workspace.id)` for partition/remount purposes, with an independent monotonic in-memory generation for each invalidated/replaced session lifecycle. A successful revalidation that finds another identity destroys the old private scope before publishing the new one.
- At initial entry capture the current local path/query before any route canonicalization. Preserve supported deep-link state (`scope`, `q`, `archived`) through explicit login; use URL encoding for returnTo. Do not send fragments, external URLs, protocol-relative paths, API paths or encoded variants rejected by the backend policy. Validate local route intent, falling back to `/` when unsafe. Never accept a caller-provided remote redirect target.
- Read `authError=login_failed` before canonicalizing the URL, show a fixed safe login-failure message, and remove only the consumed error parameter without losing intended local route state. Do not display raw provider error descriptions or copy them into returnTo. The backend's ordinary failure redirect does not preserve every prior deep link; accept its current behavior without adding browser-persisted auth state or backend changes.
- A direct unauthenticated `/projects/<id>?…` shows the gate, and successful login returns to the same safe URL and then readiness content. A placeholder is not proof that the server grants access to that entity. Authorization for those routes' business data belongs to later feature Plans.
- Browser back/forward or resumed pages must never restore a previous identity's private tree without current session verification. On `pageshow` restoration and meaningful visibility/focus resumption, deduplicate `/me` revalidation and gate authenticated actions until it resolves. Avoid an unbounded polling loop.

## Shared Fetch Foundation

Create a small reusable fetch-based module under the frontend shared layer with app-composed auth/session dependencies. It must be testable using injected fetch or equivalent controlled transport; it must not import providers, route to UI itself or require a new library.

### Request and response boundary

- Default browser credentials to same-origin and restrict API requests to the configured relative `/api/v1` root. Reject accidental external API targets; Google navigation is a separate browser action. Do not add permissive CORS or `Authorization: Bearer` behavior.
- Supply JSON content headers only when appropriate, allow explicit per-request headers, and never attempt to set browser-owned Origin/Cookie. Do not log CSRF tokens, cookies, provider parameters or private response payloads.
- Support caller AbortSignal plus lifecycle cancellation; propagate intentional cancellation separately from network failure. If a timeout is used, make it a bounded, testable transport error rather than an auth-expiration inference.
- Distinguish expected empty success (logout 204) from JSON success. A JSON-required endpoint returning HTML 200, invalid JSON or an invalid DTO is a protocol/bootstrap error. Do not blindly call `.json()` on a 204 and do not accept the Nginx SPA fallback as `/me`.
- Parse non-success JSON into a common typed error carrying HTTP status, safe code/message, fieldErrors and requestId. Malformed/non-JSON errors get a safe generic representation. **HTTP 401 still invalidates the active generation even if its body cannot be parsed.** Expected aborts and obsolete generations do not create visible errors/toasts.
- Keep fieldErrors as a mapping for future forms; retain unknown error codes/statuses without crashing or treating them as success. Do not manufacture fields/revisions. No global “strip falsy values” serialization: omission, null, empty string, false and zero remain distinct.
- No generic automatic mutation retry. Preserve explicit request headers/body if callers later choose to retry an intent. No automatic Idempotency-Key generation or resource revision handling in this Plan; auth endpoints do not require those creation/revision inputs. Synthetic unit requests may test generic JSON mutation support without integrating business endpoints.

### Session generation and cancellation

- Capture generation before a request or CSRF acquisition is queued. Recheck before dispatch and before publishing results, executing auth callbacks, caching tokens or retrying anything. Maintain lifecycle-owned AbortControllers so a reset cancels queued/in-flight work.
- A stale response, including a stale 401/403 or an ignored-abort success, cannot modify a newer identity, clear its CSRF token, trigger navigation or display old errors. Cancellation alone is insufficient: tests must include a transport that resolves after cancellation.
- Increment/invalidate generation before teardown on explicit login transition, logout/session loss, identity change and relevant forced revalidation transitions. Retire each controller/token acquisition exactly once; avoid recursive `/me` retry from the global 401 callback.
- Shared transport reports events through injected callbacks; the app boundary owns state transitions and UI. `/me` bootstrap and CSRF responses use the same generation discipline without triggering circular token acquisition.

## Session and In-Memory CSRF Lifecycle

### Token acquisition and mutation policy

1. After a valid `/me`, allow a single-flight `/auth/csrf` acquisition, eagerly or before the first mutation. An authenticated shell may display while CSRF is pending, but logout/mutations await readiness.
2. Store the nonempty token in memory for the current generation only. Apply `X-CSRF-Token` to authenticated POST/PATCH/PUT/DELETE. Do not persist it, use cookie scraping, fetch it anonymously in a loop or attach a stale token after a generation change.
3. On current-generation 401, invalidate session state immediately. On 403 ACCOUNT_DISABLED, enter disabled and tear down private state. A 403 with code CSRF_INVALID does **not** itself imply logout.
4. For CSRF_INVALID, do not replay the failed mutation automatically. Permit at most one deduplicated `/me` revalidation and fresh-token acquisition for that recovery attempt, staying within the same confirmed identity; then show an explicit retry action. If identity changed, discard the old intent and require a fresh user action.
5. Repeated CSRF_INVALID after a refreshed token is an actionable token/Origin configuration error, not a reason for a token-refresh loop or relaxed Origin checks. Unexpected 403 is a generic forbidden/error state unless the contract identifies ACCOUNT_DISABLED.

### Login and logout

- Login is explicit browser navigation to the backend entry. Before leaving, cancel obsolete app work and retire private/token state; do not preserve a mutation queue across login. Backend handles the Google transaction. No app API request tries to follow Google's authorization redirects as JSON.
- Normal logout obtains a valid token, blocks duplicate clicks and sends POST; on 204 destroy private scope and show anonymous UI. No-session logout remains compatible with 204 without a token; a 401 during token acquisition/session revalidation is sufficient to enter unauthenticated state without fabricating successful mutation data.
- When logout receives CSRF_INVALID, follow bounded recovery and explicit retry above. A disabled result removes private state. Do not label every 403 as session expiration.
- When logout has a network-ambiguous result, hide/gate private state, retire old token/work and reconcile with `/me`. If reconciliation is 401, show unauthenticated; if still authenticated, show that logout was not confirmed and offer explicit retry. A network or bootstrap error remains retryable, not claimed logout success. Do not automatically resume queued actions.
- The auth-only shell has no business drafts. Teardown must nevertheless be structured independently of the prototype's dirty-navigation guard for later features; mandatory session invalidation cannot be cancelled by a dirty-form prompt. No implicit draft save occurs during teardown.
- Preserve current backend disabled-account callback JSON 403 as approved. Browser fixtures must assert this edge rather than rewriting it to a friendly SPA redirect. Do not promise a Google account-picker parameter not exposed by the backend login contract.

## Account Switch and Legacy Data Isolation

- User/PersonalWorkspace live only in the active in-memory auth scope. Clear identity, CSRF, pending errors, private modal/toast/route-derived presentation state, request/controller registries and any future private cache scope on identity change. Do not interpret Workspace revision or the old `history.state` session string as an identity boundary.
- Use an ephemeral same-origin auth-change notification, such as BroadcastChannel, for login/logout/session-change hints across tabs. Messages contain no tokens, identity payloads or business data; receivers invalidate/revalidate through `/me` rather than trusting a broadcast identity. Do not use localStorage as the event bus. Deduplicate to prevent broadcast/revalidation loops; feature-detect support and retain focus/pageshow revalidation when unavailable.
- Test known account switches and delayed responses between A and B. Do not claim instantaneous detection of every out-of-band cookie change: session cookies are HttpOnly and backend requests are authorized using the cookie at dispatch. This Plan introduces no business mutations or new server identity-binding protocol; later mutation integrations must continue to gate known identity transitions and use server ownership checks.
- On the default entry, never call the six legacy stores: `devspace.projects.v1`, `devspace.tasks.v1`, `devspace.journals.v1`, `devspace.milestones.v1`, `devspace.links.v1`, `devspace.layout.v1`. Do not read them into auth state or use fixture-backed providers for loading/error/anonymous/authenticated screens. Do not iterate and clear localStorage/sessionStorage as cleanup.
- Existing prototype business code, fixtures and keys can remain in source, isolated from the default application path. Do not add a user-facing demo/API mode toggle or fallback on auth failure.
- Keep existing model/unit tests. To retain meaningful legacy CRUD/navigation/accessibility regression tests, provide a **test-only legacy application entry** composing the old providers/layout/router. Its fixture origin/process and browser context must be isolated from the authenticated tests. It is not a deployable second application entry, is not included in production build output and cannot be selected by a production query parameter or runtime auth failure. Existing legacy scenarios must still execute there; do not skip/delete them merely because production entry now has an auth gate.
- Verify preservation using prepopulated valid and malformed sentinel values for all six keys, including existing user-like edits and an unrelated key. Inspect contents before/after bootstrap success/failure, login return, logout and account switch. A separate test should throw on legacy storage reads/writes and still allow the auth-only app to function.

## Same-Origin Vite and Deployment Proxy Strategy

### Development and test

- Add Vite proxies for `/api` and `/oauth2`, preserving prefixes, methods, queries and Cookie/Set-Cookie/Location handling. Do not rewrite `/api/v1` away or proxy normal SPA paths. Prefer the current browser Host semantics where supported; explicitly verify the authorization redirect URI and Origin handling instead of assuming proxy defaults are correct.
- Configure the backend upstream as a server-side development setting, not a browser-exposed credential or API-origin choice. Use loopback backend HTTP for local validation; the browser uses only the Vite origin except its intentional OAuth provider navigation.
- Canonical local development example: frontend `http://127.0.0.1:5173`, backend `http://127.0.0.1:8080`; align backend APP_ORIGIN and the configured Google callback to `http://127.0.0.1:5173/api/v1/auth/callback/google`. These are local defaults/documentation, not hard-coded production hostnames.
- Isolated browser acceptance: frontend `http://127.0.0.1:4175`, backend test server `http://127.0.0.1:18080`, local provider fixture as needed. Use explicit test-process APP_ORIGIN/callback settings. Do not mutate developer `.env`, conflate localhost with 127.0.0.1 or silently reuse a server with incompatible configuration.
- Serve only ordinary frontend paths through SPA fallback. API backend-unavailable responses must remain failures, not index.html. Fetch must also detect an HTML-success misconfiguration.

### Existing Nginx/Docker deployment configuration

- Extend the current frontend Nginx configuration with `/api/` and `/oauth2/` upstream locations **before** general SPA routing; handle exact prefix boundary paths deliberately so they cannot become index.html. Preserve backend status, redirects and cookies. API errors must not be intercepted into a SPA error page.
- Keep static assets and `try_files … /index.html` for ordinary routes/deep links. Backend need not serve frontend files. The frontend container needs a configured reachable upstream/service address, not loopback to itself.
- If runtime upstream substitution is needed, use the existing official Nginx image's configuration-template mechanism and document the deployment input; do not add a proxy framework or container orchestrator. Avoid unresolved Nginx variables or stripping path prefixes through a trailing-slash proxy_pass mistake. Validate rendered configuration.
- Production browser origin is HTTPS. Deployment documentation must identify APP_ORIGIN, Google redirect URI, backend Secure-cookie setting and trusted proxy/header handling together. Never fabricate an external host from untrusted client headers; use the configured callback and controlled ingress. The existing disabled callback and relative SPA redirects remain unchanged.
- Test the current frontend image locally through its HTTP entry with isolated nonproduction backend cookie settings. Nginx syntax/build tests plus a real proxied session verify the deployment routing mechanics; they are not a production TLS/Google deployment claim. A real production domain/credentials rollout is outside this Plan and is not required to complete local acceptance.

## Validation

### Static

Validate TypeScript/build, existing unit tests, dependency boundaries, document links and affected-file formatting in the frontend repository. The detailed checks are assigned to the Execution Sessions below.

### Runtime

Runtime validation is required for bootstrap, session transitions, proxy routing and browser behavior. The two test boundaries below distinguish deterministic frontend tests from real backend contract acceptance.

#### Frontend unit/component boundaries

- Use existing Vitest and controlled fetch/state transitions; avoid adding a component-test framework just to test the state machine. Assert every bootstrap state, DTO narrowing, non-JSON/HTML success rejection, empty 204, API error fields, cancellation and typed 401/403 handling.
- Control pending Promises and generations rather than relying on timing sleeps. Cover late A success/error after B, cancellation ignored by transport, CSRF acquisition completing after logout, overlapping revalidation, duplicate logout, repeated CSRF_INVALID and failed logout reconciliation.
- Test returnTo encoding/rejection, error-parameter consumption and preservation of safe route query state; keep route/model tests passing.

#### Browser acceptance: two distinct boundaries

1. **Deterministic frontend auth tests** can intercept only the approved auth endpoints to drive loading/401/403/5xx/malformed/late-response schedules. Test UI states, pending controls, deep links, two identities, resumption and storage non-use. Fail on any request to Project/Task/Journal/Milestone/Link/Dashboard/Overview APIs. Synthetic HTTP-helper mutation tests are not business integration.
2. **Real backend session/proxy tests** must use the unchanged security filter chain and PostgreSQL test setup, not only intercepted JSON or an injected browser principal. Exercise frontend login → backend authorization → local test OIDC provider → real callback → `/me`/CSRF/logout through Vite, and repeat the routing/session smoke through the built frontend Nginx container.

The existing backend test profile has local provider URLs but no complete running browser OIDC provider fixture. Plan a frontend-owned test-only provider/runner using existing tooling (for example Node built-ins for HTTP/crypto), with disposable signed tokens/metadata, state/nonce propagation, code handling and the PKCE exchange sufficient for Spring Security's real flow. Reuse the existing backend test launch/configuration unchanged. Seed/inspect only isolated test data using existing capabilities to exercise two accounts and the disabled-account edge; any missing capability requiring a backend file change is a separate scope decision, not authorization to modify the backend. No production login endpoint, fabricated production session cookie, security relaxation or new dependency is authorized. Clearly distinguish local-provider protocol evidence from optional real Google credential smoke tests.

Real-boundary assertions include anonymous `/me` 401, successful session restoration after reload, backend CSRF enforcement for logout, allowed versus forbidden Origin, ordinary callback failure redirect, accepted disabled callback JSON behavior, two-user `/me` isolation and absence of business-resource/Home-row creation from bootstrap. User/identity/Workspace creation on first valid login is expected; demo business seeding is not. Verify no test fixture code/endpoints or local provider credentials are packaged into the production artifact.

## Execution Policy: Recover Within the Approved Contract

After explicit approval, change status to `active` and execute sessions in order. Do not execute any session while this Plan is `proposed`.

- Diagnose, fix and revalidate recoverable implementation, TypeScript/build, fixture/server-readiness, fetch/proxy/cookie, OpenAPI assertion, concurrency/session-race and browser-harness failures within this Plan, then continue without requesting approval again for the same scope.
- Preserve useful failure evidence and root cause. Use controlled races and final-state assertions; a lucky rerun is not a fix. Repeat affected validations after correction and complete the required final suite.
- Do not weaken assertions, skip required tests, use untyped bypasses, relax CSRF/Origin/cookie/ownership boundaries, enable production fixture endpoints, import/delete local data, change backend contracts or integrate excluded business APIs to get a pass.
- Stop only for a genuine decision-level blocker: contradictory approved requirements; necessary unapproved dependency/architecture/backend contract or security changes; data-loss/identity-isolation risk that cannot be resolved within scope; unavailable external prerequisites after reasonable authorized recovery; or a root cause not reliably resolvable within the approved design.
- Missing production domain/Google credentials does not block the required local-provider acceptance. Unavailable local test prerequisites must first be diagnosed/recovered with authorized tools; do not substitute mocked evidence for required real backend/proxy checks.
- If blocked, keep `active`, leave incomplete checks unchecked, and record reproduction, diagnosis, attempted recovery, affected validations and the exact needed decision/prerequisite. Do not update shared guides or completed Plans to introduce this policy.
- During execution, ordinary environment permission requirements still apply to writes outside the active permitted workspace, process launches and dependency/browser downloads; approval of the Plan is not a sandbox bypass. Ask only when an actual tool permission or genuine decision blocker requires it.

## Execution Sessions

Execute all six sessions in order after approval. Each session must complete its implementation and validation before the next begins. The checkboxes below track execution and validation.

### Session 1: Auth-only entry boundary and preserved legacy regression harness

Objective: Remove fixture/localStorage authority from the default application composition without implementing business data features or deleting legacy data.

Implementation:

- [x] Recheck both repositories' applicable instructions, working-tree baselines, reviewed contracts and existing test setup. After explicit approval, activate this Plan and update its frontend index row in the same change; preserve unrelated changes and other frontend backlog statuses.
- [x] Separate the default auth-only shell/route placeholders from the old business-provider tree. Define User/PersonalWorkspace/auth-state types and presentation boundaries without importing business stores into bootstrap.
- [x] Establish the test-only legacy entry and separated browser-test contexts/configuration; preserve existing model and legacy behavior tests without exposing a production demo switch.

Validation:

- [x] Type/boundary checks pass. Auth-only placeholder composition renders no local business data and mounts none of the six persisted providers. No excluded API request occurs.
- [x] Sentinel legacy/unrelated keys remain byte-for-byte unchanged; auth-only rendering works when legacy storage access throws. Confirm the legacy harness alone still renders/runs existing prototype workflows.
- [x] Production entry/build inputs do not include or activate the test-only legacy entry.

### Session 2: Fetch, errors, cancellation and lifecycle primitives

Objective: Establish a reusable transport foundation with deterministic session-generation and response handling.

Implementation:

- [x] Implement shared fetch/JSON/empty-response/error parsing and injectable lifecycle callbacks; keep feature/app imports out of shared.
- [x] Implement cancellation/generation control and single-flight primitives needed by bootstrap/CSRF. Keep credentials same-origin and login navigation separate from JSON transport.

Validation:

- [x] Unit tests cover 200 DTO boundaries, HTML/malformed success, 204, malformed errors, fieldErrors/requestId, network/abort and HTTP-status-driven 401 behavior.
- [x] Controlled late-response/queued-request cases prove stale success/401/403 cannot affect a newer generation, even if transport ignores abort. Test correct JSON/header/omission behavior without any real business API integration.

### Session 3: Vite/Nginx proxies and isolated auth test infrastructure

Objective: Make the approved same-origin routes real and reviewable in development and the existing frontend container.

Implementation:

- [x] Configure Vite and Nginx `/api/**` and `/oauth2/**` proxying plus ordinary SPA fallback. Document upstream, frontend origin, callback and cookie-setting alignment using server-side/test-process configuration.
- [x] Add frontend-owned isolated local OIDC/browser fixtures and runners needed for actual session tests. Reuse the existing backend PostgreSQL Testcontainers setup and available seeding/assertion capabilities unchanged; do not edit backend files, add production endpoints or introduce runtime dependencies.

Validation:

- [x] Verify methods/queries/paths, backend failures rather than HTML fallback, ordinary deep links, Location/Set-Cookie propagation, correct browser-origin callback and backend Origin behavior through Vite.
- [x] Build/render Nginx configuration and run syntax/config checks; verify `/api`, `/oauth2`, nested paths and SPA routing through the container. Missing upstream is a failure, not a successful SPA response.
- [x] Local provider fixture can complete a real Spring Security callback in an isolated test run; no fixture code/credential is packaged or reachable in the production application. No developer secrets/env values are modified.

### Session 4: `/me` bootstrap, Google entry and User/Workspace shell

Objective: Replace placeholder bootstrap with the implemented authentication contract and correct route/state behavior.

Implementation:

- [x] Wire `/me` before the private boundary and implement checking/authenticated/unauthenticated/disabled/bootstrap-error states, retry, User/Workspace display and identity-keyed shell.
- [x] Implement explicit Google entry, safe returnTo/deep-link handling, ordinary callback-failure messaging and resumption revalidation. Keep business routes integration-pending and disabled callback behavior unchanged.

Validation:

- [x] Browser tests cover every state, malformed `/me`, StrictMode/reload behavior, safe and unsafe return paths, back/forward, failure URL consumption and absence of private/fixture flashes.
- [x] Through the real Vite/backend/local-provider boundary, verify login, first User/Workspace creation, `/me` after reload, two-user identity isolation and the approved disabled-account callback edge.
- [x] Assert no business/Home persistence or excluded endpoint use occurs. Frontend legacy storage remains untouched across these transitions.

### Session 5: CSRF, logout, session invalidation and account cleanup

Objective: Safely retire active private state and handle token/session transitions under concurrency and errors.

Implementation:

- [x] Add generation-bound in-memory CSRF acquisition, authenticated mutation header support and async logout with duplicate-click prevention, typed 403 recovery and ambiguous-result reconciliation.
- [x] Implement current-generation 401/disabled teardown, account-change remount/cleanup, ephemeral cross-tab hints and focus/pageshow revalidation with loop prevention. Do not preserve/replay an old user's mutation intent.

Validation:

- [x] Unit and browser races cover token-after-logout, late A responses after B, old 401 after new login, account-change 200, concurrent CSRF callers, repeated 403, duplicate logout, offline/malformed logout and failed reconciliation.
- [x] Real backend tests verify CSRF rejection without a valid token, successful bodyless logout, cookie-backed `/me` becoming 401, allowed/forbidden Origin and no-session logout compatibility without security changes.
- [x] Two-tab tests verify notifications/revalidation, fallback when BroadcastChannel is unavailable and complete private/token cleanup. All legacy/unrelated storage sentinels remain unchanged and unread by the authenticated path.

### Session 6: Complete regression, deployment smoke and evidence

Objective: Complete all acceptance boundaries and leave a documented foundation for later business-feature Plans.

Implementation:

- [x] Update frontend development/architecture documentation to describe actual auth-only behavior, same-origin configuration, preserved legacy-data policy and intentionally unintegrated features. Reference this frontend-owned PLAN-0006 and update its existing frontend index row with lifecycle status; do not update implementation guides without separate approval.
- [x] Record final commands, source revisions/diffs, failure recovery and test counts, plus safe browser/proxy artifacts. Ensure no credentials/session tokens are recorded in artifacts.

Validation:

- [x] Frontend `npm run check:boundaries`, `npm run check:docs`, `npm test`, `npm run build` and formatting validation pass for affected work; distinguish pre-existing unrelated formatting from introduced failures without broad refactoring.
- [x] Run the complete applicable Playwright suite: new authenticated entry/session tests and retained legacy regressions through their isolated harness. Verify mobile/keyboard/focus, deep links, loading/errors and no horizontal-overflow regressions in the new shell.
- [x] Run real session/proxy acceptance through built Nginx frontend plus backend/local OIDC fixture; capture and inspect screenshots/evidence. Production build cannot select the legacy harness or expose test fixtures. No live deployment is performed.
- [x] Validate against the unchanged backend contract/source: run its existing Java 21 `./gradlew.bat clean build --no-daemon` with PostgreSQL Testcontainers as external regression evidence. Verify generated auth OpenAPI and existing security/production documentation-policy regressions remain unchanged/passing; do not add backend implementation or test-support files under this Plan.
- [x] Recheck sentinel local data, no excluded API calls or persistence writes, no business-feature integration, no production backend behavior changes and no unresolved failures caused by the Plan. Stop only this Plan's own test processes and retain evidence.

## Completion Criteria

- [x] `/me` gates all private composition; five required auth/bootstrap states are distinct and correctly rendered.
- [x] User/PersonalWorkspace come from backend and remain separate from prototype navigation state; no Workspace editing or invented identity fields exist.
- [x] Google entry/returnTo, proxy callback, accepted disabled callback edge, logout and session restoration meet the unchanged backend contract.
- [x] CSRF is memory-only/current-generation, mutations require it, and 401/typed 403/logout failures follow the specified bounded policies.
- [x] Cancellation plus generation checks prevent stale identity/token/error publication; known account changes clear private state without legacy data loss.
- [x] Same-origin Vite and Nginx routing, SPA fallback and callback/cookie/Origin behavior pass real local backend tests.
- [x] Legacy localStorage is preserved and unused as authenticated authority; no automatic import/delete/owner assignment, demo fallback, business APIs or fixture seeding occurs.
- [x] Required frontend and backend suites/builds, controlled race tests, real browser/proxy tests and retained legacy regressions pass with final evidence recorded.
- [x] No failures caused by this Plan remain.
- [x] All Execution Sessions are complete.

### API Validation

This Plan adds no production HTTP API endpoint and changes no backend contract; new-endpoint/Bean Validation/Swagger implementation checklist items are not applicable. Consumer and regression checks remain required:

- [x] Frontend auth DTOs, HTTP methods, status/error handling and CSRF requirements match the existing generated document.
- [x] Existing backend OpenAPI/security/documentation-policy tests pass; no fixture-only route appears in production API documentation/artifacts.
- [x] No request to any excluded business API is introduced by authenticated bootstrap or shell routing.

## Clarifications and Unresolved Decisions

- The approved decisions resolve the earlier origin/local-data/callback questions. No unresolved product or backend contract decision remains in this approved scope.
- The authenticated UI is intentionally an auth-only readiness shell until later feature Plans; it does not mount local prototype business providers. Approval accepts this concrete staged behavior.
- Backend Home defaults, resource DTO adapters/revisions/idempotency/pagination and local import remain later Plans. This foundation must support future callers without implementing those features now.
- A deploy-time domain, upstream address, TLS termination and real Google credentials are operational inputs for a future live rollout. Required completion uses the specified isolated local topology and real backend with local provider fixture; it does not assert that production Google deployment is complete.
- If executing this Plan reveals that a real backend contract/security change or new dependency is necessary, report it as a decision-level blocker before changing the contract. Do not quietly expand scope or replace required real-boundary tests with mocks.

## Completion

The Plan may be changed to `completed` only after every required session/final validation item passes and final evidence is recorded. If execution is blocked, leave unfinished items unchecked and record the blocker with status `active`.

Register this Plan as `proposed` in the frontend [Plan index](README.md). On approval/activation and on completion, update that existing row in the same change as this file's status; mark it `completed` only after all required validation succeeds. Do not add or update a backend Plan-index entry for this frontend Plan. Explicit approval was received on 2026-09-13; execute and validate before recording completion.

## Execution evidence ? 2026-09-13

Session 1 completed. Frontend baseline `75e679358e482c64f5e79ac7699948029ae3d6d2`; existing uncommitted Plan relocation/index edits preserved. Backend existing contract-review/dashboard changes preserved; generated `.gradle/backend-openapi-review/after.json` and actual auth DTOs inspected. Build and boundary checks passed (73 source files / 230 imports). Legacy Playwright: 35 passed; isolated auth boundary: 1 passed, with all six legacy keys plus unrelated sentinel unchanged and storage methods throwing. Production Vite entry has no legacy imports; only default index is built.

Recovery: sandbox could not update the existing TypeScript cache; approved build rerun passed. Sandbox Playwright ran assertions successfully but stalled terminating Vite. Identified and stopped only its Vite processes; elevated reruns exited normally (35 tests / 27.2s; 1 test / 3.3s). Docker prerequisite verified as 28.3.2 after permission retry. Backend Git ownership check used a command-scoped safe.directory setting, with no global change.

Session 2 completed: `npm test` 48 passed across 8 files; build passed; boundary checks passed (76 files / 232 imports). Controlled deferred-response tests cover ignored cancellation for late success/401/403, queued old generations and single-flight cleanup. Response tests cover JSON/DTO failures, 204, status-authoritative malformed errors, typed disabled/CSRF errors, fields/requestId, omission/null/false/zero, network/abort/timeout and restricted targets. No runtime dependencies added.

Session 3 configuration: browser paths remain relative; Vite reads server-only `BACKEND_UPSTREAM` (root `.env` and `.env.example`, safe default `http://127.0.0.1:8080`). Local development pairs frontend `http://127.0.0.1:5173` with backend `APP_ORIGIN` and `OIDC_GOOGLE_REDIRECT_URI=http://127.0.0.1:5173/api/v1/auth/callback/google`. The official Nginx image renders `nginx.conf` as a template; deployment must supply a reachable HTTP(S) origin in `BACKEND_UPSTREAM`, without a path suffix. Missing upstream fails configuration. Browser production origin must be HTTPS; align backend APP_ORIGIN, registered Google callback and backend SESSION_COOKIE_SECURE=true. Configure the callback explicitly; trust forwarded headers only from controlled ingress. The local HTTP acceptance uses isolated test-process overrides and Secure=false. No production domain, TLS or real Google rollout is claimed. Proxy auth access logs are disabled to avoid retaining callback codes; test fixtures and browser artifacts are excluded from the Docker context.

Session 3 recovery: initial test backend and PostgreSQL started successfully; Vite failed because loadEnv was incorrectly imported from vitest/config. Corrected it to import from Vite and reran the real boundary. No backend file or security-policy change.

Session 3 completed: `node tests/real/run.mjs` and `node tests/real/run.mjs --nginx` passed, including real signed-token/nonce/state/PKCE callback, query-preserving deep link, cookie-backed reload, CSRF/Origin rejection and successful 204 logout. Both proxies return server failures after the owned backend is stopped, while deep SPA paths remain 200. Nginx `-T` passed; missing-upstream `docker run --rm devspace-plan0006 nginx -t` failed as expected. Disposable PostgreSQL confirmed one User/Workspace and zero Project/Task/Journal/Milestone/Link/Home rows. Safe evidence is in `.auth-validation/{vite,nginx}/result.json`, `entry.png` and rendered `nginx-config.txt`; no tokens or credentials are included. Build, 48 unit tests, boundaries and 26-document link checks passed. Additional recovery: use loadEnv without Node globals because the existing TS configuration has no Node global declarations. No dependency was introduced.

Session 4 completed: 70 unit tests, 10 isolated auth browser tests, build, boundaries and doc links passed. `node tests/real/run.mjs` passed with UI-initiated login, Alice/Bob distinct User and Workspace IDs, reload restoration, disabled Alice callback 403 ACCOUNT_DISABLED followed by anonymous /me, and ordinary cancelled-provider failure displayed safely then consumed. Three real PKCE exchanges validated. Valid-looking/malformed sentinels for six legacy keys plus unrelated storage remained unchanged. Final SQL sums remain zero for all excluded business/Home tables.

Session 5 completed: 89 unit tests and 20 auth browser tests passed. Real Vite/backend/OIDC run passed including UI POST logout with current CSRF, bodyless 204 and anonymous /me; existing missing-token/forbidden-Origin/no-session assertions also passed. Tests cover pending tokens, duplicate logout, late A success/401/403 after B, account change during recovery, repeated CSRF_INVALID without replay/refresh loops, disabled versus ordinary forbidden, offline/malformed/5xx logout reconciliation, 401/503 reconciliation, two-tab hints, BroadcastChannel fallback, focus and pre-BFCache teardown. Auth browser suites enforce unchanged sentinels and throw on storage reads/writes throughout.

Session 5 recovery: strengthened transport cancellation/timeout to settle even if injected fetch ignores abort and to suppress late body parsing errors. Replaced brittle fixed-microtask-count assertions with explicit request-start Promise signals; the complete affected suites passed after correction. Added generation checks after recovery revalidation so a superseding lifecycle cannot receive an old intent/error.

## Final validation ? 2026-09-13

All six Execution Sessions and completion/API checks passed. PLAN-0006 is completed. No backend source, contract, dependency, security policy or implementation guide was changed. No live deployment was performed; real Google credentials/TLS rollout remain outside this local acceptance.

| Validation                 | Final evidence                                                                                                                                                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend unit suite        | `npm test`: 90 passed across 11 files, including controlled late-response, token, session and timeout races.                                                                                                                                                                                                    |
| Source boundaries          | `npm run check:boundaries`: 83 files, 244 local imports; passed.                                                                                                                                                                                                                                                |
| Documentation              | `npm run check:docs`: 26 Markdown documents; all links resolve.                                                                                                                                                                                                                                                 |
| Production build           | `npm run build`: TypeScript and Vite passed; final JS `index-Bsp87onG.js`, CSS `index-Crvdr2r4.css`.                                                                                                                                                                                                            |
| Artifact isolation         | `node tools/check-auth-artifact.mjs`: 3 output files; no legacy storage markers, test provider/legacy entry or server-only proxy configuration. Existing backend production JAR also excludes its test launcher/login fixture.                                                                                  |
| Legacy browser regressions | `npm run test:e2e`: 35 passed, 32.1s, through the separate legacy Vite entry.                                                                                                                                                                                                                                   |
| Auth browser suite         | `npx playwright test --config playwright.auth.config.ts`: 20 passed, 8.4s; all transition scenarios preserve six legacy keys plus unrelated storage, forbid storage access and excluded business APIs.                                                                                                          |
| Real Vite acceptance       | `node tests/real/run.mjs`: passed against the unchanged backend security chain and fresh PostgreSQL; 3 signed-token/PKCE exchanges.                                                                                                                                                                             |
| Real Nginx acceptance      | `node tests/real/run.mjs --nginx`: fresh image build and rendered `nginx -T` passed; same 3 exchanges and full session smoke passed. Final image browser bundle matches the frontend build.                                                                                                                     |
| Real session assertions    | Anonymous /me, UI login, safe deep link, first User/Workspace creation, reload, Alice/Bob isolation, disabled callback 403, ordinary cancelled login, CSRF and forbidden Origin rejection, raw/UI bodyless 204 logout and no-session compatibility all passed. Both databases retained zero business/Home rows. |
| Generated contract         | Each real run fetched the live generated OpenAPI and verified auth operations/statuses and required Me/Workspace/CSRF fields; no test fixture route appears.                                                                                                                                                    |
| Backend regression         | Java 21.0.12.1 `./gradlew.bat clean build --no-daemon`: BUILD SUCCESSFUL, 2m23s; 183 tests in 36 suites, 0 failures/errors/skips. Includes AuthenticationOpenApiContractTests, BackendOpenApiContractTests, SecurityIntegrationTests and ProductionSwaggerSecurityTests.                                        |
| Formatting                 | All 30 format-supported affected files passed Prettier API checks; `git diff --check` passed. Full `npm run format:check` initially found 80 files: the new runner was formatted, leaving 79 verified unchanged/pre-existing failures. They were not broadly reformatted. Nginx syntax is validated separately. |
| Environment and cleanup    | Frontend root `.env` and `.env.example` both contain the safe server-only BACKEND_UPSTREAM default. No existing developer secrets were changed. All plan ports 4175/4176/4177/18080/18999 stopped serving; no plan-named Docker container remains.                                                              |

Final recovery: a stalled 401 response body could previously defer session invalidation or turn it into a timeout error. Invalidation now occurs from current-generation 401 headers, independently of body parsing. A controlled test passes without advancing its fake clock. The final 90-test suite, auth browser suite, build/artifact check and real Vite/Nginx boundaries were revalidated after this correction.

Source evidence: frontend HEAD remains `75e679358e482c64f5e79ac7699948029ae3d6d2`; implementation is an uncommitted reviewable diff (35 affected/new tracked-candidate files, plus ignored root `.env`). Backend HEAD is `cdd4bf01aaa3ff7e7a68802e74a88a93b1938379`; pre-existing backend working-tree changes were preserved. The 299-file backend source digest before/after final validation is unchanged: SHA-256 `69f59a12fe5d1093367ba410e7ce0cbe2718e75bb6d50389458994365d87c10c`.

Safe retained local artifacts: `.auth-validation/{vite,nginx}/result.json`, `auth-contract.json`, `authenticated-desktop.png`, `authenticated-mobile.png`, `entry.png`; `.auth-validation/nginx/nginx-config.txt`; `.auth-validation/backend-results.json`, `backend-source-before.json`, `format-affected.json`, `format-preexisting.json` and `final-source-manifest.json`. These artifacts are ignored and excluded from the image. Desktop/mobile authenticated and login-error screenshots were opened and inspected: readable identity, navigation and pending state, usable logout, and no horizontal overflow. Artifact scans found no JWTs or callback code/state/nonce values.

The authenticated entry remains an auth-only readiness shell. Business integration and the separate PLAN-0003 historical scope were outside this Plan; legacy records are preserved and unused by this entry. No decision-level blocker or unresolved failure caused by PLAN-0006 remains.
