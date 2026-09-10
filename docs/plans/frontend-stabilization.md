# Plan: Remaining frontend stabilization

## Goal

Preserve the remaining frontend backlog from the historical stabilization list. Execution is separate from the documentation and source reorganization approved on 2026-09-10.

## Scope

- In scope: the pending items below, preserving original identifiers and acceptance criteria.
- Out of scope: backend implementation, authentication, external synchronization, and automatic execution as part of source migration.

## Changes

| Original item | Priority | Work and acceptance criteria                                                                                                                                                         |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 11            | Medium   | Journal editing/deletion and date filters/sorting; preserve saved entries and retry behavior.                                                                                        |
| 12            | Medium   | Project-specific widget settings, item limits, and links to project detail.                                                                                                          |
| 13            | Medium   | Independent milestone creation, editing, completion, and deadlines.                                                                                                                  |
| 15            | Medium   | Mobile menu focus/Escape behavior, modal names, and accessible progress names; retain already implemented modal naming.                                                              |
| 16            | Low      | Operations widget disconnected/loading/error/stale/empty states without presenting fixtures as live monitoring.                                                                      |
| 17            | Low      | Layout position preview and touch dragging; define separate scope before free-height or multiple-layout expansion.                                                                   |
| 18            | Medium   | Open the existing task editor from a task title in project detail. Distinguish clicks from drags; synchronize detail/home/board after saving and preserve unsaved-change protection. |

Before implementation, select one item, expand its concrete steps and validation, and update the execution order in [README.md](README.md). Historical completed items remain in the [history](../references/history/frontend-stabilization-history.md).

## Validation

### Static

- Build, unit tests for changed domain behavior, formatting of changed files, and dependency validation.

### Runtime

- Add or extend Playwright scenarios for the selected item; run relevant existing regressions.
- Verify save failure/retry, persisted data reload, empty/long content, keyboard behavior, and mobile layouts as applicable.
- For item 18, verify edit click versus drag, cancellation, shared state after saving, and failed-save draft retention.

## Completion Criteria

- [ ] Planned changes are implemented.
- [ ] Required static validation passes.
- [ ] Runtime validation passes when applicable.
- [ ] Related documentation is updated if required.
