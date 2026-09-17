# Development

## Run locally

1. Use Node.js 22.12 or newer.
2. Run `npm install` in the repository root.
3. Run `npm run dev` and open the URL printed by Vite.
4. To use another port, run:

   `npm run dev -- --port 5174 --strictPort`

## Validate changes

Run the checks relevant to the changed scope:

1. `npm run check:boundaries`
2. `npm run check:docs`
3. `npm run build`
4. `npm test`
5. `npm run format:check`

Distinguish pre-existing failures from failures introduced by the current change.

For browser, visual, feature-specific, or real-backend validation, follow `testing.md`.

## Validate Project Categories

1. Run the backend on `http://127.0.0.1:8080` and verify `/v3/api-docs` before changing Category models or request semantics.
2. Run `npm test -- --run src/features/projects` for relation parsing, immutable replay, Category models/store, and targeted invalidation.
3. Run `npm run test:e2e -- --config playwright.projects.config.ts --workers=2 --output test-results/category-projects` for Category CRUD, errors, archived edits, draft/session recovery, and Category-only DTOs and absence of scope writes.
4. Run `npm run test:e2e -- --config playwright.shell.config.ts --workers=2 --output test-results/category-shell` for original-layout visual comparisons and desktop/mobile/landscape checks. Approved Category additions are excluded only from original-region pixel comparisons and are captured separately. Legacy and authenticated Vite servers use separate optimizer caches.
5. Run `node tests/real/run.mjs --category-only` and then `node tests/real/run.mjs --category-only --nginx`. The existing harness requires Docker, the sibling backend checkout, and its configured Java 21 runtime. It creates disposable DB/OIDC/backend processes, validates actual Category/Project/child/Link/Dashboard contracts, metadata, archived relations, replay and authentication against its owned backend. It does not mutate the running port-8080 workspace.
6. Inspect `.auth-validation/vite/category-only-evidence.json`, `.auth-validation/nginx/category-only-evidence.json`, their session/proxy `result.json`, and responsive screenshots. Keep browser output directories separate so later suites do not delete visual evidence.

Category names are display data, not IDs. Normal business reads/writes are v2; Category/auth and Widget configuration are v1. Home layout uses Dashboard v3 (`placements` and `layoutRevision`); Widget settings and typed data use Widget v1. Remove response-only `referenceState` from Widget writes and keep Widget `revision` separate from layout revision. Preserve historical v1 omission-based bodies and endpoints; never load legacy providers to resolve Categories or Widget data. Do not use old feature runner flags against a migrated backend: the runner rejects them. Its empty-test-DB Flyway override must never be copied into a populated workspace deployment. Re-run related feature browser suites when modifying Project serialization, Widget payloads or invalidation. See [PLAN-0023](../plans/PLAN-0023-widget-dashboard-api-refactoring.md) for the API acceptance matrix and [PLAN-0024](../plans/PLAN-0024-dashboard-widget-interactions.md) for the Widget interaction acceptance matrix.

## Development rules

Use `--bg` for canvas/Topbar, `--surface` for auxiliary grouping, `--surface-subtle` for lanes/inactive groups, and `--surface-raised` for readable/interactive elements. Large sections should stay transparent. Keep empty lane styling below drop-target priority. Record any small Pure White background exception by selector and contrast purpose. Preserve single-currentColor SVGs with monochrome interaction styling instead of splitting brand/status artwork into artificial duotone paths.

For theme changes, edit `src/shared/styles/tokens.css` first and retain semantic status colors and brand assets. Blueprint is opt-in on PageScaffold headings and the public login left region only; reuse `useBlueprintPointer`, keep tracking local, and preserve its RAF/media cleanup. Never animate static widgets/tasks or interfere with drag transforms. Review authenticated routes, focus and responsive states in the user's allowed validation mode; public login inspection alone does not validate the application shell.

- Follow `conventions.md` for naming, structure, dependencies, and reuse.
- Follow `environment.md` when adding or changing configuration or environment variables.
- Follow `testing.md` when adding or modifying tests.
- Preserve existing UI and behavior unless the task explicitly changes them.
- Do not use legacy fixtures or localStorage as authenticated application authority.
- Do not modify backend behavior merely to make frontend validation pass.

## Extend a page or widget

1. Read the source instructions governing the files being changed.
2. Keep feature-specific state and behavior inside its feature.
3. Use pages for route-level composition.
4. Use app code for routing, authenticated composition, and application-wide lifecycle.
5. Reuse shared controls and design tokens before adding new equivalents.
6. Preserve existing responsive and accessibility behavior.
7. Add regression coverage for the changed workflow.

For a new page:

- add route parsing and navigation under `src/app`
- compose the route under `src/pages`
- inject required feature/application dependencies through composition

For a Dashboard widget change:

- verify the implemented Dashboard contract first
- update Dashboard API models/catalog only when the contract requires it
- reuse existing API-backed feature surfaces
- keep the legacy Dashboard renderer isolated

## Persisted data

When changing persisted client data:

- define compatibility and migration explicitly
- do not change storage keys as a side effect of source refactoring
- do not clear user storage to simplify a migration
- preserve legacy storage unless an approved migration explicitly changes it

## Production preview

1. Run `npm run build`.
2. Run `npm run preview`.
3. Verify direct SPA routes resolve correctly.
4. Preserve SPA fallback in deployment configuration.

See repository `nginx.conf` for the production web-server configuration.

## References

- Architecture: `../architecture/frontend.md`
- Plans: `../plans/README.md`
- Conventions: `conventions.md`
- Environment: `environment.md`
- Testing: `testing.md`
