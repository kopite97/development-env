# Development

## Run locally

1. Use Node.js 22.12 or newer.
2. Run `npm install` in the repository root.
3. Run `npm run dev` and open the URL printed by Vite. To choose another port, run `npm run dev -- --port 5174 --strictPort`.

## Validate changes

1. Run `npm run check:boundaries` and `npm run check:docs` for dependency and documentation link checks.
2. Run `npm run build` for TypeScript checking and a production build.
3. Run `npm test` for unit tests.
4. Run `npm run format:check` and distinguish existing formatting issues from changed-file issues.
5. Install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. Playwright starts the isolated legacy Vite server on port 4175.
6. Run the authenticated Journal suite with a Vite server on port 4180: start `npm run dev -- --port 4180 --strictPort`, set `JOURNAL_REUSE_SERVER=1`, and run `npx playwright test --config playwright.journals.config.ts`.
7. Run the authenticated Milestone suite with Vite on port 4181: start `npm run dev -- --port 4181 --strictPort`, set `MILESTONE_REUSE_SERVER=1`, and run `npx playwright test --config playwright.milestones.config.ts`. It checks archived Project operations, cursor/detail boundaries, immutable creation retry, explicit conflict review, permanent deletion, session isolation, responsive controls and read-only Home defaults.
8. Stop any server on the acceptance ports, then run `node tests/real/run.mjs --milestones=final` and `node tests/real/run.mjs --milestones=final --nginx` sequentially. Use the Docker/Java/sibling-backend prerequisites in the root README. These runs use disposable OIDC/PostgreSQL and the unchanged backend, compare generated OpenAPI, exercise real UI mutations, inspect database results, and save screenshots/contracts/results under ignored `.auth-validation/`. Inspect responsive editor/list captures; a passing request assertion alone does not establish visual parity.

For Milestone changes, retain legacy `devspace.milestones.v1` data, use nullable calendar-date values rather than timestamp conversion, and allow owned archived Project relations. Diagnose and fix recoverable harness/proxy/Docker/test/visual failures within the approved frontend scope, then revalidate; do not modify backend security or substitute fixtures for real acceptance.

For Link changes, start Vite on port 4182 (`npm run dev -- --port 4182 --strictPort`), set `LINK_REUSE_SERVER=1`, and run `npx playwright test --config playwright.links.config.ts`. The suite covers preserved library/Home UI, server scope/search, CRUD, exact creation replay, resource/collection conflicts, stale filters/sessions, quota errors and draft retention. Reuse only a verified server from this checkout. On Windows, explicitly managing Vite and using the suite's reuse flag avoids child-server teardown hangs; stop only processes owned by the validation run.

Stop run-owned servers on ports 4175/4177/18080 before real acceptance. Run `node tests/real/run.mjs --links=final` and `node tests/real/run.mjs --links=final --nginx` sequentially with Docker access and the existing Java/sibling-backend prerequisites. Both use disposable data and test the full collection, common scopes/literal search, required creation key, exact mutation wrappers, 500-item quota, full permutation, external mutation conflicts, no-op/empty reorder and deletion gaps. Inspect `link-contract.json`, `links-result.json`, `link-library-*`, `link-editor-*`, and `link-home.png` under `.auth-validation/vite/` and `.auth-validation/nginx/`, comparing original UI captures rather than accepting unexplained visual changes.

Keep `devspace.links.v1` untouched. Never derive Link identity from fixture names or locally increment positions/revisions. Do not add pagination or pass limit/cursor to this full-collection API. Distinguish item revision conflicts from collection conflicts by the operation; neither ambiguous mutation nor reorder may replay silently. Diagnose and fix recoverable harness/proxy/OpenAPI/test/visual failures, revalidate and continue within the approved Plan.

With a dev server running, `node tools/capture-structure.mjs http://127.0.0.1:5173` captures desktop/mobile route screenshots and checks headings, page errors, and horizontal overflow. Results are written to the ignored `test-results/structure/` directory.

## Dashboard validation

1. Start a verified Vite server on 4183 (`npm run dev -- --port 4183 --strictPort`), set `DASHBOARD_REUSE_SERVER=1`, and run `npx playwright test --config playwright.dashboard.config.ts`. Tests cover exact configuration, empty/error states, draft/reset/drag/width controls, Project UUIDs, server revisions, ambiguous writes, session races, repeated boards, row pagination and responsive focus behavior. Existing feature suites use explicit saved Home test configurations where their original widget defaults matter.
2. For the direct visual comparison, also start the legacy server with `npm run dev -- --config tests/legacy/vite.config.ts --port 4175 --strictPort`, then run `node tests/dashboard/visual-parity.mjs`. It applies the same configuration to both entries and compares grid/frame/title/editor geometry at 1440×1000, 390×844 and 844×390. Inspect the original and API screenshots under `.auth-validation/`; content/loading differences do not excuse unexplained visual regressions.
3. Stop only run-owned acceptance-port processes, then run `node tests/real/run.mjs --dashboard=final` and `node tests/real/run.mjs --dashboard=final --nginx` sequentially. Both use the unchanged backend, disposable PostgreSQL/OIDC and real browser/API requests. Inspect `dashboard-contract.json`, `dashboard-result.json`, `dashboard-*.png`, and proxy `result.json` in `.auth-validation/vite/` and `.auth-validation/nginx/`.
4. Verify virtual reads leave persistence untouched, the first-save race has one winner, the frontend reset matches the live default, archived references resolve directly, and layout writes leave business rows unchanged. Never auto-save defaults, replay an uncertain PUT, or use `devspace.layout.v1` for recovery. Run unchanged-backend regression tests as required by the Plan.
5. Diagnose and fix recoverable OpenAPI, Docker/proxy, browser-harness, concurrency, type/test and visual failures; revalidate before completion. Stop only for a documented decision-level blocker. Do not change backend behavior, weaken tests or add fixture authority to obtain a pass.

## Extend a page or widget

1. Read the source instructions for the target directory. Implement feature-specific state and commands in its feature; use pages for composition.
2. For a new page, add its route parsing and navigation entry under `src/app`, compose the page under `src/pages`, and inject application inputs from PageRouter.
3. For a widget change, verify the implemented Dashboard contract, update dashboard/apiModel.ts and widgetCatalog.ts where applicable, and adapt ServerDashboardHome composition. Keep the legacy renderer isolated; new server types/contracts require separate approval.
4. Reuse shared controls and tokens. Put feature CSS in its feature and preserve responsive overrides at the end of app/styles/global.css.
5. When changing persisted data, define compatibility and migration explicitly. A source file move alone must not change storage keys or fixture IDs.
6. Add relevant domain tests and exercise direct navigation, saved data reload, editing cancellation, and save-failure retry for the affected workflow.

## Production preview

1. Run `npm run build`.
2. Run `npm run preview`.
3. Preserve SPA fallback when deploying: direct project URLs must serve index.html. See `nginx.conf` in the repository root.

Consult [architecture](../architecture/frontend.md) before changing source boundaries and [plans](../plans/README.md) for execution order. Browser storage contains user data; do not clear it to perform a source-only migration.
