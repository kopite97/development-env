# Decision: Explicit project contracts across features

Date: 2026-09-10. Accepted as part of the user-approved source structure migration.

## Context

Tasks and journals reference projects and must reflect project renaming and classification changes. Dashboard, links, operations, and milestones also use project classification. Treating these concepts as feature-agnostic shared code would hide their domain ownership. The previous dashboard registry also imported all widget features, mixing feature behavior with page composition.

## Decision

Keep domain ownership in features and allow only these project modules as cross-feature contracts:

| Project module         | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `scope.ts`             | Scope type and display labels                                    |
| `model.ts`             | Project type, validation, and legacy seeded-name identity lookup |
| `ProjectsProvider.tsx` | Current project state for task/journal resolution and selection  |
| `ProjectSelect.tsx`    | Project selection UI in task/journal editors                     |
| `fixtures.ts`          | Seed relationships in other fixtures and tests only              |

Use explicit module paths; no general barrel exposing every project implementation detail. New cross-feature imports require updating this decision through a subsequent decision and adjusting the boundary checker. Feature composition belongs to pages or app. Project summary views receive the task status fields they need through props and do not import task implementation or types. Widget renderers live under pages/home; dashboard retains only metadata and layout behavior.

## Consequences

ProjectsProvider must remain above TasksProvider and JournalsProvider. Project fixtures can be used to preserve old task identity, but only projects/model owns this runtime compatibility lookup. Project fixture imports of model types are erased at runtime and do not create a runtime cycle.

The [boundary checker](../../tools/check-boundaries.mjs) parses TypeScript imports, exports, import types, and literal dynamic imports and resolves local modules using tsconfig. It rejects upward layer imports and undeclared feature-to-feature dependencies, including type-only imports. It is a static source check; it does not analyze computed runtime import strings or CSS selectors.

See [frontend architecture](../architecture/frontend.md) and the [migration plan](../plans/PLAN-0002-source-structure-migration.md).
