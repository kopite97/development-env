# Plans

This file tracks the execution order and status of project plans.

## Status

- `proposed` — proposed but not yet approved
- `active` — approved and currently being executed
- `completed` — implemented and successfully validated
- `rejected` — cancelled, explicitly rejected, superseded, or unable to reasonably continue

At most one plan may be `active` at a time.

## Execution Order

| Order | Status    | Plan                                                                                              | Description                                                                                             |
| ----- | --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1     | completed | [Documentation reorganization](PLAN-0001-documentation-reorganization.md)                         | Separate contracts, architecture, history, and pending work.                                            |
| 2     | completed | [Source structure migration](PLAN-0002-source-structure-migration.md)                             | Align source boundaries and preserve runtime behavior.                                                  |
| 3     | completed | [Journal and project widgets](PLAN-0004-journal-and-project-widgets.md)                           | Items 11–12 implemented; build, 16 unit tests and 30 browser tests passed.                              |
| 4     | completed | [Milestones and accessibility](PLAN-0005-milestones-and-accessibility.md)                         | Items 13 and 15 implemented; build, 19 unit tests and 35 browser tests passed.                          |
| 5     | proposed  | [Remaining frontend stabilization](PLAN-0003-frontend-stabilization.md)                           | Remaining backlog.                                                                                      |
| 6     | completed | [Frontend authentication and shared HTTP foundation](PLAN-0006-frontend-auth-http-integration.md) | Completed 2026-09-13; 90 unit, 55 browser and 183 backend tests; real Vite/Nginx auth passed.           |
| 7     | completed | [Project and Overview integration](PLAN-0007-project-overview-integration.md)                     | Completed 2026-09-13; 99 unit, 76 browser and 183 backend tests; real Vite/Nginx passed.                |
| 8     | completed | [Task integration without UI redesign](PLAN-0008-task-integration.md)                             | Completed 2026-09-13; 112 unit, 97 browser and 183 backend tests; real Vite/Nginx and UI parity passed. |

Both plans were registered as proposed on 2026-09-10. The user explicitly requested creating and immediately executing these plans in this session; this is authorization for their sequential activation.

PLAN-0004 was separately registered as proposed, activated under the user's explicit request to immediately execute items 11 and 12, and completed on 2026-09-10. PLAN-0003 retains the other pending items.

PLAN-0006 was relocated from the backend proposal on 2026-09-13 and explicitly approved for execution on that date. All six sessions completed on 2026-09-13 with final evidence recorded in the Plan. Its frontend file is the single source of truth. The user's instruction to execute PLAN-0006 takes precedence over the pending stabilization backlog; PLAN-0003 remains proposed.

PLAN-0007 was registered as `proposed` on 2026-09-13 for Plan creation only. Explicitly approved and activated on 2026-09-13, including all contract approval candidates; all six sessions completed on that date with final validation evidence recorded in the Plan. PLAN-0003 remains proposed and PLAN-0006 remains completed.

PLAN-0008 was registered as `proposed` on 2026-09-13 for Plan creation only. Explicitly approved and activated on 2026-09-13, including all approval candidates and temporary Task-only Home behavior. All six sessions completed on that date with final validation evidence in the Plan. Existing Task UI and legacy storage are preserved. Other Plan statuses remain unchanged.

## Rules

- Execute plans in the order listed above unless explicitly instructed otherwise.
- Treat the `active` plan as the current source of implementation work.
- Move a plan to `completed` only after its required validation succeeds.

* Move a plan to `rejected` when it is cancelled, explicitly rejected, superseded, or unable to reasonably continue.
* Temporary implementation or validation failures do not make a plan `rejected` if they can reasonably be resolved.

- Keep this file updated whenever a plan is added, activated, completed, rejected, or reordered.
