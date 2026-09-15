# Decision: ProjectCategory-only authenticated classification

Date: 2026-09-15.
Status: accepted through explicit approval of [PLAN-0014](../plans/PLAN-0014-project-category-only-transition.md), including its frontend boundary and UX candidates.

## Context

The backend now exposes Category-only business contracts on v2 and Dashboard schema 2. The user approved replacing scope across authenticated resources. This supersedes the scope-preservation and deferred-filtering constraints of [the original Category Decision](project-category-boundary.md); that accepted historical record remains unchanged.

## Decision

Project Category UUID is the single authenticated classification identity. Names are mutable presentation values, never identifiers. Task, Journal and Milestone derive Category from their Project; Link derives it from its optional Project. No frontend scope/name inference or migration is permitted.

Category CRUD remains owned by the Project feature. Narrow pure `categoryFilter.ts` contracts and the props-only `CategoryFilterControl.tsx` may be consumed across features like existing explicit Project contracts. Stores remain feature-owned; app/page composition supplies reference options and coordinates invalidation. Other features do not import CategoryStore. Legacy scope models/providers remain test-only and are not normal authenticated authority.

Business APIs use v2; auth and Category CRUD remain v1. Versioned immutable pending creations retain original endpoint/body/key, with isolated historical response parsing. Response workspace revisions govern freshness, separately from resource edit revisions.

Dashboard schema 2 stores explicit selection. URL-driven Home selection is a view-only override, including Links but excluding Deploy. It never modifies saved configuration. Missing Category references never silently become all or another same-name Category.

## Rationale

Server-backed membership, filtering and aggregate contracts now make scope compatibility unnecessary in authenticated reads and writes. Separating reference names, entity concurrency and query freshness preserves rename and reassignment correctness without restoring fixture authority.

## Consequences

All authenticated DTOs, filters, aggregates, query keys, selectors and widget serialization must transition together. Existing UI is preserved except approved classification controls and neutral Project appearance. Backend migration manifests and production cutover remain backend/deployment responsibilities. Implementation and validation gates are maintained in PLAN-0014 rather than duplicated here.
