# AGENTS.md

This directory contains implementation and change plans.

## Templates

All plans must use one of the shared templates:

- Use `PLAN-TEMPLATE-DOCS.md` for documentation-only changes.
- Use `PLAN-TEMPLATE-RUNTIME.md` for all other changes.
- When runtime validation does not apply, explain why and define the appropriate static validation instead.

## Plan Tracking

`README.md` is the source of truth for plan execution order and status.

Plan statuses are:

- `proposed` — proposed but not yet approved
- `active` — approved and currently being executed
- `completed` — implemented and successfully validated
- `rejected` — cancelled, explicitly rejected, superseded, or unable to reasonably continue

Agents may update plan statuses as work progresses, with one exception:

- Every new plan must initially be registered as `proposed`.
- A plan may enter `active` only by transitioning from `proposed` after explicit user approval.
- A plan must never be changed to `active` without explicit user approval.
- `proposed`, `completed`, and `rejected` may be assigned by the agent when appropriate.
- Update `README.md` in the same change whenever a plan is added, reordered, or its status changes.
- Treat the `active` plan as the current source of implementation work.
- At most one plan may be `active` at a time.
- Plan filenames must use a sequential numeric prefix, such as `PLAN-0001-<name>.md`.
- Assign each new plan the next available number, based on the highest existing plan number.
- Plan numbers must be unique and must not be reused, including numbers from `completed` or `rejected` plans.
- Reordering plans in `README.md` does not change their assigned numbers.

## Status Transitions

- `proposed` → `active` requires explicit user approval.
- `active` → `completed` when all planned changes are implemented and all required validation succeeds.
- `proposed` or `active` → `rejected` when the plan is cancelled, explicitly rejected, superseded, or cannot reasonably continue.
- Do not mark a plan as `rejected` for temporary implementation or validation failures that can still be resolved.
- Agents may determine `completed` and `rejected` when these conditions are clearly satisfied.
- `completed` and `rejected` are terminal states and must not be changed unless explicitly requested by the user.

## Rules

- Do not create plans without using the appropriate template.
- Keep plans scoped to a clear, executable change.
- Base plans on the current codebase and existing documentation.
- Include only steps and validation relevant to the planned change.
- Update the plan if implementation materially diverges from it.
- Mark a plan as `completed` only after all required validation succeeds.
