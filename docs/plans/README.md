# Plans

This file tracks the execution order and status of project plans.

## Status

- `proposed` — proposed but not yet approved
- `active` — approved and currently being executed
- `completed` — implemented and successfully validated
- `rejected` — cancelled, explicitly rejected, superseded, or unable to reasonably continue

At most one plan may be `active` at a time.

## Execution Order

| Order | Status    | Plan                                                            | Description                                                                                    |
| ----- | --------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1     | completed | [Documentation reorganization](documentation-reorganization.md) | Separate contracts, architecture, history, and pending work.                                   |
| 2     | completed | [Source structure migration](source-structure-migration.md)     | Align source boundaries and preserve runtime behavior.                                         |
| 3     | proposed  | [Remaining frontend stabilization](frontend-stabilization.md)   | Preserved backlog; not authorized for implementation by the structural reorganization request. |

Both plans were registered as proposed on 2026-09-10. The user explicitly requested creating and immediately executing these plans in this session; this is authorization for their sequential activation.

## Rules

- Execute plans in the order listed above unless explicitly instructed otherwise.
- Treat the `active` plan as the current source of implementation work.
- Move a plan to `completed` only after its required validation succeeds.

* Move a plan to `rejected` when it is cancelled, explicitly rejected, superseded, or unable to reasonably continue.
* Temporary implementation or validation failures do not make a plan `rejected` if they can reasonably be resolved.

- Keep this file updated whenever a plan is added, activated, completed, rejected, or reordered.
