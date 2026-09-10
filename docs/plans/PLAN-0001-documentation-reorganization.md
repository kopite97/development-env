# Plan: Documentation reorganization

## Goal

Separate current architecture, proposed API contracts, execution plans, and historical results.

## Scope

- In scope: relocate the API contract; split the stabilization backlog and history; repair links; document current architecture and development workflows.
- Out of scope: backend implementation, restoring user-deleted reports, implementing pending stabilization features.

## Changes

1. Move the unimplemented API contract to `../references/api/backend-api-contract.md`.
2. Preserve previous stabilization results in `../references/history/frontend-stabilization-history.md` and register remaining work in `frontend-stabilization.md` using the runtime template.
3. Write `../architecture/overview.md`, `../architecture/frontend.md`, and `../guides/development.md` from the current source. Update these paths as part of the source migration.
4. Repair README and document links; remove links to deleted reports without restoring them.

## Validation

- Check Markdown links and referenced repository paths.
- Check changed documents with Prettier and compare architecture descriptions with imports and storage code.
- Keep historical validation explicitly dated; do not treat it as current validation.
- Runtime validation is not required because this plan changes documentation only.

## Completion Criteria

- [x] Planned documentation changes are complete.
- [x] References and links are valid.
- [x] Documentation is consistent with the repository.

Validation on 2026-09-10: `node tools/check-doc-links.mjs` resolved links in 18 documents; changed documents were formatted with Prettier. Architecture was checked against current imports, providers, persistence, and routing. The source migration will update these descriptions alongside its code changes.
