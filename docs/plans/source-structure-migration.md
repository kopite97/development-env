# Plan: Source structure migration

## Goal

Align application ownership and dependency direction with the repository instructions while preserving existing behavior and saved data.

## Scope

- In scope: application shell, page inputs, reusable UI and hooks, feature fixtures and types, dashboard composition, CSS ownership, architecture documentation, dependency validation.
- Out of scope: new features, new dependencies, backend integration, storage schema changes, visual redesign.

## Changes

1. Move App and application layouts into app; move reusable UI, hooks, utilities, and styles into shared.
2. Make PageScaffold feature-agnostic. Inject page inputs and presentation slots from PageRouter, removing all page imports from app. Move project/journal/link editor state into feature workspaces and project-detail editor state into a project hook so pages remain composition-only.
3. Give projects ownership of Scope and demo project identity; split tasks and journal types and fixtures into their features. Document intentional cross-feature public dependencies.
4. Separate dashboard metadata from page-level widget renderers. Move home layout editing into the dashboard feature and inject content rendering.
5. Place styles with their owners, preserving CSS cascade order. Update imports and README.
6. Document the implemented architecture and feature dependency decision. Add a static dependency check to prevent upward imports.

## Validation

### Static

- Run the dependency checker, TypeScript/Vite build, unit tests, Markdown link checks, and formatting checks for changed files.
- Run repository formatting checks and distinguish pre-existing issues from changed-file failures.
- Check the diff for whitespace errors and unchanged storage keys.

### Runtime

- Run the full existing Playwright suite: routing, saved filters/history, projects/tasks, journal and link editing, dashboard editing, and mobile layouts.
- Verify localStorage reload compatibility, save-failure behavior, unsaved-change navigation protection, and dashboard cancellation preserving task changes through existing regression tests.
- Capture desktop and mobile screenshots and check for horizontal overflow after CSS relocation.

## Completion Criteria

- [x] Planned changes are implemented.
- [x] Required static validation passes.
- [x] Runtime validation passes when applicable.
- [x] Related documentation is updated if required.

## Validation Results

Validated on 2026-09-10:

- `npm run build`: passed TypeScript checking and Vite production build.
- `npm test`: 13 tests passed in 4 files.
- `npm run check:boundaries`: passed for 66 TypeScript files and 212 local imports.
- `npm run check:docs`: links resolved in 19 documents.
- `npm run test:e2e -- --workers=2`: all 26 existing Chromium tests passed. Initial sandbox execution could not load Vite configuration; the approved unrestricted rerun passed.
- `node tools/capture-structure.mjs`: 16 screenshots, including home and widget editor at 1366x768 and 390x844. All 14 route/viewport combinations had a single nonempty heading, no page errors, and no horizontal page overflow. Home rendered all six default widgets. Home and mobile editor screenshots were visually inspected.
- Compared pre-migration Git source with current project/task/journal fixtures: all seed values, generated journal IDs/dates, project defaults, and persistence/history keys match.
- Changed-file Prettier check and `git diff --check`: passed.
- Full `npm run format:check`: still reports 11 pre-existing, untouched files: app/AppProviders.tsx, app/routes.test.ts, app/useBrowserNavigation.ts, journal/styles.css, links/model.test.ts, links/styles.css, and five existing Playwright files (links-mobile, project-detail, project-tasks, routing, search-statistics). These are outside this structural change; the required changed-file formatting check passed.

Screenshots and route metrics are generated under `test-results/structure/` (ignored by Git). The development server was left running at `http://127.0.0.1:5173`. Remaining stabilization features are tracked separately and were not implemented by this plan.
