# Decision: ProjectCategory as a separate Project relation

Date: 2026-09-14.
Status: accepted. Explicitly approved for architectural direction only; this record does not authorize implementation or creation of an implementation Plan. Backend-dependent contract details remain unresolved until the backend Decision is completed.

## Context

The current [Project API model](../../src/features/projects/apiModel.ts) stores `scope: 'unity' | 'server'`. The shared [Project fields](../../src/features/projects/ProjectFields.tsx) present that value as the user-facing development area. Scope is also an independent compatibility and filtering axis used by Home, Dashboard, Task, Journal, Milestone, Link, navigation, and aggregate queries through [scope labels](../../src/features/projects/scope.ts) and feature-specific API contracts.

Project identity already comes from server UUIDs. App-owned Project option adapters supply those IDs to related-resource editors; names are display values, not authenticated resource identity. The current frontend has no ProjectCategory API model, store, or management UI.

Repository investigation confirmed that a separate Category relation can be added without changing Task, Journal, Milestone, or Dashboard scope behavior, provided the backend continues to support the existing scope fields and their meanings. Category management does not require redefining the shared scope enum.

This proposal follows the current [frontend architecture](../architecture/frontend.md) and [explicit Project contracts decision](feature-dependencies.md). It neither replaces that accepted record nor enables additional feature-to-feature store dependencies.

## Decision

Introduce `ProjectCategory` as a separate, server-backed, user-managed Project relation.

| Concept       | Frontend responsibility                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `scope`       | Preserve the existing compatibility, filtering, aggregate, and widget-configuration axis. |
| `categoryId`  | Reference the server Category selected for user-managed Project classification.           |
| Category name | Display mutable server data; never serve as identity, a cache key, or a relation value.   |

Do not infer scope from Category ID or name, or infer Category identity from scope. Category creation, rename, deletion, or reassignment must not silently change Project scope.

Replacing `scope` with ProjectCategory is explicitly outside this change. Do not replace the shared scope enum or scope-based APIs. Category filtering of Project lists, Dashboard widgets, or other resources is not approved by this Decision.

## Rationale

Scope currently carries behavior beyond Project presentation. Replacing it with an arbitrary user-managed list would change strict API parsers, aggregate keys, sidebar counts, widget configuration, and related-resource filters. Keeping the axes separate limits the migration to Project classification while preserving completed integrations.

Stable server Category IDs allow renaming without changing Project relations. Keeping Category state feature-owned and server-backed avoids introducing fixture or localStorage authority into authenticated flows.

## Frontend boundaries

- Category API models, validation, queries, and store initially belong under `src/features/projects/`. Exact filenames are implementation details; Category state remains separate from Project entity and cursor caches.
- Project DTO parsing, drafts, validation, create serialization, and dirty-field update serialization will support the Category relation according to the agreed backend contract. Response display fields must not become writable request fields accidentally.
- The Project editor selects server Category IDs. Shared presentation components may receive Category options or composed controls through props; they must not acquire legacy providers to resolve Categories.
- Category CRUD reuses the existing authenticated transport, session-generation isolation, cancellation, typed-error, and CSRF recovery patterns. Mutation replay/idempotency details depend on the Category API contract, not assumptions copied from another resource.
- App/pages own cross-feature composition. [PrivateWorkspace](../../src/app/auth/PrivateWorkspace.tsx) connects store lifetimes and invalidation; feature code does not import app/pages.
- Task, Journal, Milestone, and Dashboard must not directly depend on CategoryStore. Their existing Project selectors continue to use Project UUIDs and preserve their existing active/archived selection rules.
- Category state is neither seeded from nor persisted to legacy Project fixtures/localStorage. Existing test-only models and providers remain isolated and compatible.
- This proposal does not expand the cross-feature import allowlist in the [boundary checker](../../tools/check-boundaries.mjs). Any future expansion requires separate architectural review.

## UX responsibilities

The frontend must support the following capabilities without committing to a specific management route, modal, or inline layout:

- Load available Categories and distinguish loading, successful empty results, and errors. An unavailable list must not be represented as an empty list or an automatic default selection.
- Select a Category in Project creation and editing using its server ID. Preserve the selected ID across renames and refreshes; handle a selected Category outside the loaded options or no longer available without silently switching to another Category.
- Create and rename Categories with validation feedback, pending state, duplicate-submit prevention, and draft preservation on failure. Required validation and normalization follow the server contract.
- Delete a Category through an explicit user action with appropriate confirmation and pending/error feedback. Only confirmed success removes it from authoritative client state.
- Handle server rejection of deletion for an in-use Category with a clear explanation while retaining the Category and existing Project relations. Do not silently detach, reassign, or delete Projects, and do not assume a preflight usage check eliminates concurrent-use errors.
- Preserve Project drafts through Category-option refreshes and failed Category operations. Session loss/account change still takes precedence over draft retention; same-identity recovery follows existing patterns and never automatically submits a business mutation.
- Preserve Category display for archived Projects. Whether those Projects may change Category is a backend-policy dependency, not a frontend assumption.

The current composition permits more than one management entry point and does not make one clearly preferable. The exact screen location, interaction design, and Category display placements remain deferred.

## Compatibility

Preserve existing scope filters, URL scope semantics, Home scope behavior, Dashboard scope configuration, Task/Journal/Milestone scope behavior, and Link scope behavior. Keep existing Project UUID relations, archived-resource rules, and legacy test-only Project models and fixtures unchanged.

[Overview](../../src/features/overview/apiModel.ts) remains scope/Project-based. [Dashboard widgets](../../src/features/dashboard/apiModel.ts) retain the current schema and `scope`, optional `projectId`, and `limit` behavior. No Category field is added to widget configuration or other-resource API requests by this Decision.

How scope is presented in the future Project editor requires UX agreement, but the editor must retain a valid compatibility value. Hiding the existing input must not introduce an implicit Category-to-scope mapping or an invented server default.

## Backend-contract dependencies

The following must be resolved against the backend before implementation of the affected behavior. This record does not specify endpoints, payloads, status codes, defaults, or concurrency rules for them.

| Dependency         | Required clarification                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Identity           | Category UUID/identity format, validation, and stability rules.                                               |
| Ownership          | User/workspace ownership scope, authorization, and visibility.                                                |
| Listing            | Ordering, pagination, and resolving a selected Category outside a loaded page.                                |
| Names              | Normalization, length constraints, uniqueness, and duplicate-name handling.                                   |
| Concurrency        | Category revisions, rename/delete preconditions, conflict semantics, and retry/idempotency guarantees.        |
| Mutation responses | Create/update/delete request and response contracts and confirmation of successful deletion.                  |
| Project relation   | Whether Category is required or nullable; omitted versus null values in create/update and existing responses. |
| Defaults           | Default Categories and assignment rules for existing Projects and existing/new workspaces.                    |
| In-use deletion    | Whether archived Projects count as usage, rejection behavior/error code, and concurrent assignment handling.  |
| Archived Projects  | Whether an archived Project may change Category.                                                              |
| Project reads      | Whether responses include only `categoryId` or also derived Category display data.                            |
| Freshness          | Effects of Category rename on Project revision, response freshness, and cache invalidation.                   |

## Consequences and risks

- **Immutable Project creation retries:** [createIntent](../../src/features/projects/createIntent.ts) freezes the explicit request body and key. Adding Category selection must not mutate an in-flight/retry body or reuse its key for different data. Category deletion or rename during an uncertain create must lead to explicit recovery, not silent request rewriting.
- **Future filtering:** [ProjectStore](../../src/features/projects/apiStore.ts) keys lists by scope, status, query, and page size. If Category filtering is separately approved, Category identity must join query/cache keys and cursor-reset behavior. Filtering only the currently loaded rows would produce incorrect results and counts.
- **Rename freshness:** Project revisions may remain unchanged when derived Category display data changes. Updating one entity entry does not update every query snapshot or editor option. The eventual implementation must choose a contract-compatible Category lookup or refresh strategy and prevent stale names from reappearing after late responses.
- **Targeted invalidation:** Category creation refreshes available options; rename refreshes affected displays; confirmed deletion revalidates options and selected references. Exact Project-cache invalidation depends on response shape. Do not indiscriminately reuse the current Project invalidation fan-out, which also invalidates Overview, Dashboard, Task, Journal, Milestone, and their options.
- **Dashboard strictness:** Dashboard parsing rejects unsupported fields. Adding `categoryId` to saved widgets requires a separate backend contract change and subsequent Decision/Plan, not a presentation-only adjustment.
- **Legacy coupling:** The current Project presentation type is shared with legacy validation and fixtures. Making Category fields mandatory there can invalidate saved test-only data. Extend the authenticated boundary without requiring legacy Category resources or migrating localStorage.
- **Selection and failure safety:** Renames must preserve selection by ID; missing/deleted Categories and in-use deletion errors must not create fabricated successful state. New Category caches and drafts must respect existing auth teardown and account isolation.

Validation for a later implementation should cover Category CRUD/errors/concurrency, Project serializers and immutable retries, rename freshness, selected-option recovery, archived policy, auth/CSRF isolation, unchanged scope queries, legacy storage isolation, and responsive Project/editor presentation. Existing `tests/projects`, related-resource suites, `tests/dashboard`, `tests/shell`, and real-backend fixtures will need contract-appropriate additions. Category UI checks must be distinguished from unchanged legacy visual regions.

## Migration direction

The recommended sequence, subject to separate implementation authorization and a later implementation Plan, is:

1. Establish the Category API/store boundary using agreed backend contracts.
2. Extend Project API model, draft, validation, and serialization.
3. Integrate server Category selection into the Project editor.
4. Add Category management UI with the required recovery and deletion states.
5. Add Category display where useful, with an explicit freshness strategy.
6. Consider Category-based filtering only in a separate later Decision/Plan.

This is accepted architectural direction, not an executable Plan. Category-management location, final visual design, filter/aggregate behavior, Dashboard Category configuration, and any eventual scope replacement remain deferred. Acceptance does not authorize implementation or creation of an implementation Plan.
