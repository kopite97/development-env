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

With a dev server running, `node tools/capture-structure.mjs http://127.0.0.1:5173` captures desktop/mobile route screenshots and checks headings, page errors, and horizontal overflow. Results are written to the ignored `test-results/structure/` directory.

## Extend a page or widget

1. Read the source instructions for the target directory. Implement feature-specific state and commands in its feature; use pages for composition.
2. For a new page, add its route parsing and navigation entry under `src/app`, compose the page under `src/pages`, and inject application inputs from PageRouter.
3. For a new widget type, update dashboard/model.ts's types and validation, dashboard/widgetCatalog.ts's metadata, and pages/home/widgetRenderers.tsx's renderer.
4. Reuse shared controls and tokens. Put feature CSS in its feature and preserve responsive overrides at the end of app/styles/global.css.
5. When changing persisted data, define compatibility and migration explicitly. A source file move alone must not change storage keys or fixture IDs.
6. Add relevant domain tests and exercise direct navigation, saved data reload, editing cancellation, and save-failure retry for the affected workflow.

## Production preview

1. Run `npm run build`.
2. Run `npm run preview`.
3. Preserve SPA fallback when deploying: direct project URLs must serve index.html. See `nginx.conf` in the repository root.

Consult [architecture](../architecture/frontend.md) before changing source boundaries and [plans](../plans/README.md) for execution order. Browser storage contains user data; do not clear it to perform a source-only migration.
