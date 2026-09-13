# Plan: Link integration

## Status

- Status: `completed`
- Registered: 2026-09-14
- Approved and activated on 2026-09-14, including all contract and presentation candidates. Execute all six sessions in order within the approved scope.
- All six sessions completed on 2026-09-14 with final validation evidence below. No unresolved decision-level blockers remain.
- Reuses completed [Auth](PLAN-0006-frontend-auth-http-integration.md), [Project/Overview](PLAN-0007-project-overview-integration.md), [Task](PLAN-0008-task-integration.md), [Journal](PLAN-0009-journal-integration.md), and [Milestone](PLAN-0010-milestone-integration.md) foundations.

## Goal

Replace authenticated Link fixture/localStorage authority with the implemented backend collection and mutations while preserving the existing library, editor, ordering controls, Home presentation, Korean labels, responsive layout, navigation, and accessibility. Adapt presentation boundaries rather than replace or simplify the UI.

## Scope

- In scope: authenticated library and Home Link reads, create/edit/permanent-delete, full-collection reorder, validated DTO/draft/presentation boundaries, resource and collection concurrency, async states, session isolation, invalidation, and frontend/visual/real Vite/Nginx/backend validation.
- Out of scope: backend changes, Dashboard API or saved-layout authority, new dependencies, Project relations for Links, new drag interactions, and legacy data import/conversion/migration/deletion. Existing unrelated integrations and legacy presentation remain intact.

## Verified baseline and contract

Read-only inspection on 2026-09-14 successfully fetched the running [generated OpenAPI](http://127.0.0.1:8080/v3/api-docs) and compared its Link operations/schemas with current backend source. [Swagger UI](http://127.0.0.1:8080/swagger-ui/index.html) exposes the same contract. No authenticated mutation probes were performed during proposal creation; runtime acceptance below occurs after approval.

Source evidence is in sibling backend `src/main/java/com/kopite/devspace/link/`: `presentation/LinkController.java`, request/response DTOs and `LinkRequestFields`, `application/command/LinkCommandService.java` and `LinkRequestHash.java`, query service/filter, `infrastructure/persistence/LinkSearchAdapter.java`, `domain/Link.java`, `LinkValues.java`, and `application/LinkLimits.java`. Recheck these with the runtime at execution start; older reference documents do not override implementation.

| Operation                              | Implemented contract                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/v1/links`                    | Optional `scope` default `all`, `query` default empty. Returns `{items,total,nextCursor:null,collectionRevision}` for the entire matching collection. `total` is matching item count. No pagination, limit, cursor, Project or alternate-order parameter; unknown or duplicate query parameters reject.                                                    |
| Filtering/order                        | `scope=all` includes every scope; `unity` includes unity and common all; `server` includes server and common all. Query is literal case-insensitive substring search independently across label, description, or URL, with `%`, `_`, and `!` escaped as literals. Query whitespace is not trimmed by the query service. Order is `position ASC, id ASC`.   |
| GET `/api/v1/links/{id}`               | Direct owned resource without collection wrapper. Missing/inaccessible resource returns 404 `RESOURCE_NOT_FOUND`.                                                                                                                                                                                                                                          |
| POST `/api/v1/links`                   | JSON `{label,url,description?,scope?}`; omitted description defaults empty and omitted scope defaults all. Required `Idempotency-Key`, 1–128 visible ASCII characters. Returns 201 `{item,collectionRevision}`. Appends after maximum live position, initially zero for an empty collection; creates resource revision 1 and advances collection revision. |
| PATCH `/api/v1/links/{id}`             | JSON `{revision,label?,description?,url?,scope?}`. Omission preserves fields; explicit null, unknown and duplicate fields reject. Position/audits/ID are not writable. Returns 200 `{item,collectionRevision}`. Every successful PATCH, including revision-only/same-value PATCH, advances both revisions.                                                 |
| DELETE `/api/v1/links/{id}?revision=N` | Required current resource revision query; no body. Returns 200 `{deletedId,collectionRevision}`. Permanent deletion advances collection revision, leaves position gaps, and does not renumber remaining rows. Repeat delete returns 404, with no restore/tombstone/trash workflow.                                                                         |
| PUT `/api/v1/links/order`              | JSON `{collectionRevision,ids:[UUID,...]}` and no query parameters. IDs must be the exact permutation of all live owned Links, including hidden scopes. Stale collection revision produces 409 before ID-set validation; duplicates/missing/extra IDs produce 400. Returns 200 the full unfiltered list wrapper.                                           |

Resource fields are `{id,revision,createdAt,updatedAt,label,description,url,scope,position}`. UUID identity and audit timestamps are server authority. Resource revision is a safe integer from 1; collection revision and position are safe integers from 0; maximum is `9007199254740991`. A never-mutated collection can have revision 0. The list's global collection revision and filtered rows share one database snapshot; filtered results still carry the global revision.

Label is required, nonblank, maximum 100 UTF-16 code units after backend trimming; URL is required, maximum 2000 after trimming, absolute HTTP/HTTPS with a host and no credentials. Description is non-null, maximum 300, and backend preserves its whitespace. Scope is exactly all/unity/server. Match backend validation without treating JavaScript URL normalization as proof of server acceptance. Preserve description text in drafts and payloads rather than applying the old editor's unconditional description trim.

The hard maximum is 500 live Links, with a configurable lower quota (`app.link.max-links`, default 500); the frontend must handle 429 `QUOTA_EXCEEDED` rather than assume the runtime quota is discoverable or always 500. OpenAPI advertises a maximum 8 MiB compact UTF-8 collection response. Do not introduce pagination to work around this bounded contract.

Each valid reorder advances collectionRevision once, even an empty or unchanged order. It assigns dense positions `0..n-1`; only rows whose numeric position changes advance their resource revision and updatedAt. Thus an unchanged ID sequence after deletion can compact gaps and change item revisions. Unmoved items retain revision/audits. The client never computes authoritative next revisions or positions.

POST replay is scoped to the workspace/key for 24 hours and returns the original mutation wrapper even if the resource was edited or deleted later. Reusing the key with a different fingerprint yields 409 `IDEMPOTENCY_KEY_REUSED`. The fingerprint uses original command fields, so normalization/omission changes are not interchangeable retry bodies. All mutations use existing session cookies and CSRF headers; responses are no-store. `REVISION_CONFLICT` also covers numeric exhaustion; do not assume every 409 is safely solvable by replay.

### Existing frontend preservation baseline

- [LinkLibrary](../../src/features/links/LinkLibrary.tsx) uses PageScaffold, the existing add button, 개발 레퍼런스 panel, QuickLinks rows, and modal editor. Successful save resets search and closes the editor.
- [QuickLinks](../../src/features/links/QuickLinks.tsx) shows icons, label, description, safe external anchors, scope labels, edit/delete confirmation, and 위로/아래로 buttons. Reorder is already disabled during search or non-all scope. Preserve this restriction and its Korean explanation.
- [LinkEditor](../../src/features/links/LinkEditor.tsx) has name, URL, description, and scope fields, their limits, autofocus, modal focus handling, and unsaved-change guards. Replace synchronous callback authority with awaited operations while retaining these fields and layout.
- Actual Link rows currently have no drag/drop handlers. Drag handles belong to Dashboard widget placement in `DashboardWorkspace`/`WidgetFrame`, not Link collection order. Preserve those existing legacy drag interactions and regression coverage; do not invent a Link drag interface or connect widget placement to `/links/order`. Any existing Link drag behavior discovered during baseline validation must be preserved through the same order-intent boundary.
- Legacy Home renders QuickLinks without editing callbacks, so it is already read-only. The default widget is 빠른 링크, small size, scope all, with no item limit. Do not copy recent-Journal or Milestone limits.
- Fixture IDs currently choose branded icons. API UUIDs must not be replaced with fixture IDs to retain icons. Proposed display-only icon mapping recognizes exact known URL hosts (GitHub, Unity documentation, Spring documentation, React documentation), with Globe fallback; icon keys never become identity or writable API fields. Verify comparable known-URL screenshots with different server UUIDs.

## Changes

### 1. Feature boundaries and models

Introduce a Link-owned API model/store on the existing private transport and Query lifecycle. Keep validated DTOs separate from editable `{label,description,url,scope}` drafts and the existing row presentation (`description` maps to `desc`). Drafts have no fabricated resource UUID, revision, position, or audit fields; editor target and baseline DTO are held separately. Validate UUIDs, safe integers, scope, text/URL fields, timestamps, wrapper shape, unique IDs/positions, sorted order, `total === items.length`, and `nextCursor === null` before publishing a collection. Position gaps are valid outside a confirmed reorder.

Adapt/extract the presentational QuickLinks/library/editor boundary with API controllers rather than mount the local LinksProvider in authenticated composition. Preserve the legacy provider in the isolated legacy entry. Reuse source-boundary guidance during execution; app owns authenticated store lifecycle, pages compose features, and shared components remain feature agnostic.

### 2. Collection reads, scope and direct detail

Use server-filtered GET requests keyed by exact scope/query and session identity. Debounce search without changing its literal value; reset/abort obsolete requests on filter changes. Preserve controls and displayed count; the backend's per-field search is authoritative rather than the legacy concatenated-string cross-field match. Do not add load-more controls, client cursors, or unsupported query parameters.

Keep the confirmed unfiltered `scope=all,query=''` snapshot separate from filtered/Home snapshots. A filtered list is never a full reorder base despite its global collectionRevision. Reordering requires a ready, non-stale, full snapshot; clearing filters loads that snapshot before enabling controls. Manual refresh/focus revalidation can discover external edits without adding polling infrastructure.

Use independent direct-detail reads by UUID to open/reconcile edits, preserving draft state while loading. Filter absence does not prove deletion. Only authoritative direct 404 establishes missing/inaccessible detail; failed list/detail requests remain error/unavailable states. Keep confirmed rows on refresh failure with stale notice/retry, and never render loading or errors as a genuinely empty collection. Distinguish successful filtered no-match from confirmed unfiltered empty; do not invent global emptiness from a filtered response.

### 3. Awaited create/edit/delete

Preserve modal fields, cancellation/discard prompts, external navigation and Korean labels. Add compact pending/error/retry/conflict content in existing containers, disable duplicate/competing submissions, and preserve drafts on validation, network, malformed acknowledgment, conflict, and reconciliation failures. Await confirmed success before closing/resetting search or removing rows. A refresh failure after validated mutation success is separately reported and must not invite duplicate mutation.

POST sends only the four writable fields with explicit defaults and a frozen serialized body/key held in identity-scoped memory. Retain the exact key/body on uncertain outcome; offer explicit same-intent retry within 24 hours, never automatic retry/new key. Changed input requires explicit resolution or abandonment of the uncertain original intent. After expiry/lost intent, do not promise duplicate prevention or identify records by label/URL. A replay wrapper can be old: reconcile direct resource and fresh collection before treating it as current, never resurrect a deleted replay or regress collection revision. Failed reconciliation retains the draft/intent.

PATCH sends current captured server revision and only intended dirty fields. A no-change save may close without a request; when sent, use the returned revision even for same-value writes. Validate returned UUID against the target and full resource/wrapper before success. DELETE keeps the existing named confirmation, sends the exact revision query/no body, validates `deletedId === target.id` and collectionRevision, and updates UI only after confirmation. No soft-delete UI is introduced.

Resource conflict handling preserves the draft and baseline, reads current detail, and presents explicit review/reconciliation before a new save/delete using the newly confirmed revision. Never silently overwrite or automatically replay PATCH/DELETE. Ambiguous acknowledgments require reads and explicit action; a subsequent 404 can establish current absence but is not a fabricated successful DELETE acknowledgment. Retain useful editing content even when its resource has disappeared.

### 4. Full-collection reorder and conflict recovery

Convert existing up/down actions (and any baseline-proven drag adapter) into an ordered UUID intent against the confirmed full snapshot and its collectionRevision. Serialize collection mutations so create/edit/delete and reorder do not compete locally. Preserve focus on the moved row/action and keyboard/touch operation. A transient ordering preview may contain only an ID sequence, never locally rewritten DTO positions/revisions; the simpler default is to retain confirmed rows while pending, then render the returned order.

PUT sends every live owned ID exactly once and no filters. Validate the response as an unfiltered wrapper, with exactly the submitted IDs in requested sequence and server-provided dense positions, before atomically installing it. Store all returned resource revisions/audits, including changed rows other than the directly moved row. Do not attach a newer collection revision to an older list and treat the pair as a valid reorder base.

Avoid unnecessary no-op submissions, but honor the backend's collection revision change if one is submitted. Test already-dense no-op, empty reorder, and unchanged sequence with gaps separately. DELETE gaps remain untouched until server reorder.

Both item and collection conflicts use `REVISION_CONFLICT`; identify the concurrency domain by operation and captured baseline rather than invent different backend codes. On reorder conflict/failure, discard preview, restore last confirmed order, mark it stale and reload the full collection. Explain external changes and require a new user ordering action; never silently rebase or replay the permutation. Failed recovery retains confirmed rows with retry and disables reorder. Unknown PUT outcome also requires full reload, since even a no-op retry would be a new collection mutation.

### 5. Session protection, cache and invalidation

Partition memory by identity/workspace/session generation and scope/query or detail UUID. Reuse transport cancellation, request sequence checks, lifecycle guards and mutation epochs. A route/filter change cancels obsolete reads; a confirmed mutation retires all earlier Link read results. Late responses, including late auth/security errors and mutation acknowledgments, must not affect a newer session or reopen a closed editor. Clearing/logout/account change disposes all Link caches and drafts/intents. Reuse same-identity recovery handoff only under the established Auth policy, retaining uncertain intent rather than automatically replaying it.

Every confirmed create/PATCH/DELETE/reorder invalidates all Link scope/search/Home snapshots and relevant detail caches. Reorder may change many item revisions: invalidate open editor baselines for explicit reconciliation. Install complete reorder responses atomically; mutation wrappers alone cannot prove full membership/order. Remove confirmed deletions from retained snapshots so failed refresh cannot resurrect them. Prevent older revisions/snapshots and old POST replay wrappers from overwriting newer confirmed state. Share request results where keys match; do not share one mutable collectionRevision variable across unrelated stale row sets.

Links have no Project relation or derived Project fields, so Project mutations do not require invented Link invalidation. Session changes and Link mutations do. No Overview/Dashboard mutation or persistent cache is added.

### 6. Authenticated Home and legacy storage

Compose a fixed authenticated Home Link surface through the existing app/page slots. Preserve the current small 빠른 링크 widget frame, icon/row layout and read-only external anchors; default scope all, empty search, and no client/server item limit (bounded by backend collection maximum). Respect explicit supported scope inputs. Management remains in the library through existing navigation. Do not load saved widget layouts or add Dashboard API authority; legacy widget drag/placement remains unchanged in its current surface.

Keep `devspace.links.v1` byte-for-byte preserved, including malformed or empty legacy values, but neither read it as authenticated authority nor seed API caches/requests from it. No fixture fallback on errors, import, migration, deletion, storage-event synchronization, or persistent mutation queue. Retain existing legacy tests alongside authenticated API tests and assert storage sentinels remain unchanged.

## Validation

### Static

Proposal validation checks Markdown formatting, relative documentation links, and Plan/index consistency only. Runtime implementation tests do not apply until approval; live OpenAPI/source inspection above is contract evidence, not a claim of completed integration.

During execution run model/store/intent unit tests, type/build, boundary, authenticated artifact, documentation-link and changed-file format/diff checks. Cover malformed DTOs/wrappers/IDs/integers, gaps, filtered counts, unsupported pagination, literal search, safe URL rendering, exact dirty payloads, idempotency body preservation, replay-after-delete, invalid acknowledgments, stale session/read/mutation races, and global versus item concurrency. Test quota handling at 500 and a lower configured limit without hard-coding discovery assumptions.

### Runtime

- Capture original library/editor/Home at desktop, mobile and landscape using comparable seeded data before adaptations. Compare final screenshots and inspect spacing, icons, text wrapping, row/actions layout, focus ring, modal scroll, keyboard tab/Escape/focus return, discard confirmation, delete confirmation, touch targets, and navigation. Preserve existing Dashboard drag/drop regression tests. Unexplained visual or interaction differences are failures requiring fixes, not accepted new snapshots.
- Deterministic browser tests cover loading/error/empty/no-match, refresh failure with retained rows, async double-click protection, successful and failed CRUD, draft retention, resource/collection conflicts, concurrent tabs, reconciliation failures, security/session generation changes, filter races, order success/rollback/retry and focus recovery. Verify Home common-link scopes, read-only behavior, library navigation, and unchanged storage/excluded Dashboard requests.
- Real browser acceptance uses Vite and a fresh built Nginx artifact against the unchanged backend with existing disposable authentication/database harness. Confirm cookies/CSRF/proxies and actual envelopes, full collection/no pagination, scope inclusion and literal search, direct detail, POST replay/key mismatch, dirty PATCH, permanent DELETE response/repeat 404, collection-size quota, and two-session conflicts.
- Exercise full permutation including mixed scopes, stale revision preceding invalid-ID errors, duplicate/missing IDs, numeric positions and revision changes, no-op/empty/gapped reorder, and external create/delete between read and reorder. Keep tests in run-owned disposable data; record cleanup and no backend source/config changes. Reuse unchanged-backend regression checks from recent Plans where required by the real harness.
- Run affected Auth/Project/Overview/Task/Journal/Milestone and retained legacy suites for composition regressions. Record commands, pass counts, OpenAPI/source comparison, response/database assertions, screenshot paths, and all recoveries. Do not weaken assertions or substitute fixtures for required real-backend acceptance.

## Execution Sessions

Execute sequentially only after explicit approval; each session records evidence and resolves recoverable failures before continuing.

1. **Completed — Contract and presentation baseline:** transition proposed to active with index update; recheck live contract/source and applicable source instructions; capture original UI/drag/focus baseline; confirm DTO and presentation boundaries, Home defaults, and icon mapping.
2. **Completed — Validated reads and library:** implement DTO/draft/view mapping, collection/direct-detail store, server scopes/search, async read states and cancellation; adapt current library rows without changing layout; pass read/model and initial real-backend acceptance.
3. **Completed — CRUD and reconciliation:** connect awaited editor/create/PATCH/permanent-delete, frozen creation intents, target acknowledgment validation, conflict review and draft retention; pass deterministic and real mutation checks.
4. **Completed — Reorder and Home:** implement complete-permutation order intents, collection concurrency/rollback, no-op/gap semantics and focus preservation; compose the proposed read-only all-scope/no-limit Home surface; validate cross-surface invalidation and no Dashboard authority.
5. **Completed — Recovery and visual parity:** finish session/epoch/handoff races, cache coherence, uncertain outcomes and error recovery; run affected feature/legacy/browser suites; visually compare desktop/mobile/landscape and validate keyboard/touch/drag/navigation, fixing all regressions.
6. **Completed — Final acceptance and documentation:** complete static/unit/build and real Vite/fresh Nginx/backend validation; record evidence, cleanup and recovery history; update relevant frontend architecture/development/root documentation. Only when every required check passes mark completed and update the Plan index together.

## Self-recovery execution policy

Diagnose, fix within approved scope, revalidate, and continue after recoverable implementation, type/build, test, OpenAPI comparison, proxy, Docker, browser-harness, integration, or visual-parity failures. Record cause, repair and confirming evidence. Temporary failures are not reasons to reject the Plan or repeatedly request permission. Do not change backend behavior/security or weaken validation to obtain a pass.

Stop only for a genuine decision-level blocker: contradiction that cannot be reconciled with implemented backend contract, required unapproved architecture/security/backend change, unavoidable new dependency, unresolved data/identity policy, or fundamental UI/backend incompatibility outside approved scope. Record concrete evidence and the decision needed, leaving the Plan active and incomplete during execution. Proposal inspection found no such blocker.

## Approval candidates and unresolved decisions

The user approved the contract and all six sessions on 2026-09-14, including adapting existing presentation boundaries; server per-field search; preserving description whitespace; display-only known-host icons; full unfiltered reorder with serialized mutations and explicit reconciliation; and the fixed read-only Home default all/empty-query/no-limit surface without Dashboard or saved-layout authority.

No unresolved contract decision was found. Existing Link reorder is button-based; Dashboard drag is separate and preserved. This evidence-based distinction does not require introducing a new drag feature. All approval candidates are authorized; implementation and validation evidence is recorded below.

## Execution evidence and recovery history (2026-09-14)

- Sessions 1–4: rechecked live OpenAPI/source; captured original desktop/mobile/landscape library/editor/Home images in `.auth-validation/link-baseline-*`. Added validated full collection/direct detail, exact CRUD/replay, serialized complete-permutation reorder, preserved library shell and read-only all-scope Home. No Link drag/drop or backend change was introduced.
- Session 5: session-generation handoff, stale filter/read/mutation suppression, CSRF explicit retry, conflict review and draft preservation passed deterministic browser coverage. Original Link/mobile and full legacy tests retain widget/Task drag coverage. Screenshot inspection confirms matching Link rows, icons, editor fields/modal geometry, focus and responsive wrapping; the new refresh/pending/error controls are scoped additions.
- Recovery: corrected a TypeScript optional-data guard, a search test that asserted a single locator before debounce completed, and a real-harness search expectation (two matching descriptions, not three). Docker access used the established elevated harness. Windows Playwright-owned server teardown hangs were resolved with explicitly managed Vite servers and verified reuse flags. A quota test exposed generic error text; Link now renders a Korean quota explanation and preserves editable inputs. No assertions or backend behavior were weakened.
- Session 6 completed: all required static, browser, visual, real Vite/fresh Nginx/backend validation passed. Architecture, development guide, root README and Plan index reflect the implemented authority. No required work remains.
- Final static evidence: frontend unit tests **145 passed** (26 files), production TypeScript/Vite build passed, source boundary and authenticated-artifact checks passed, changed-file Prettier and `git diff --check` passed, and documentation links resolve across **31 documents**. After the final delete-review/acknowledgment guards, the 14 Link unit tests and build were revalidated successfully.
- Final browser evidence: Link **15**, Auth **20**, Project/Overview **21**, Task **21**, Journal **7**, Milestone **13**, retained legacy **35** tests passed (**132 total**). Coverage includes account change and same-identity draft recovery, late 201/401/403, CSRF no-replay, literal filter races, lower configured quota error handling, direct-detail deletion review, failed refresh with retained order, and original widget/Task drag interactions. Explicit Vite reuse resolved the Windows teardown problem; all recorded final suite runs exited successfully.
- Real Vite acceptance passed against disposable PostgreSQL/OIDC and the unchanged backend. Full collection/no pagination, scope inclusion/literal search, required key and old replay wrappers, dirty and no-op PATCH, exact DELETE and repeat 404, complete permutation validation, stale collection conflict precedence, no-op/empty order, gap compaction, external item/collection mutations and **500 live Links** with quota rejection were checked. Browser create/edit/reorder/delete/conflict review, responsive screenshots, read-only Home, database cleanup, preserved storage and zero Dashboard requests passed.
- The unchanged backend at `238aaa11108ea301e32d36690aaf616e5817ab0e` passed `APP_ORIGIN=http://localhost:8080 gradlew.bat clean test --no-daemon`: JUnit XML reports **183 tests, zero failures/errors**. The Origin override was process-only; backend working tree remains clean.
- Review recovery: final audit strengthened DELETE conflict handling to read current detail and require explicit `검토 후 삭제`; pending list mutations participate in navigation guards, and PATCH/DELETE reject nonadvancing collection acknowledgments. These changes were revalidated in Link unit/browser/build and real Vite acceptance. No new dependency, backend changes, Link drag/drop, fixture fallback, or legacy data mutation was introduced.
- Final `node tests/real/run.mjs --links=final` and `node tests/real/run.mjs --links=final --nginx` both exited successfully after the last implementation changes. Nginx built the final production artifact and repeated full Link acceptance, including 500-item quota and cleanup. Existing session/proxy smoke passed callback/PKCE/reload/CSRF/Origin/logout, zero business rows and zero excluded requests. Runtime artifacts are `.auth-validation/{vite,nginx}/link-contract.json`, `links-result.json`, `result.json`, `link-library-{desktop,mobile,landscape}.png`, `link-editor-{desktop,mobile,landscape}.png`, and `link-home.png`. Final Nginx mobile editor/Home images were visually inspected against the preserved presentation. Source boundaries report **163 files / 555 local imports**.

## Completion Criteria

- [x] Existing library/editor/Home layout, Korean labels, successful navigation, ordering controls, drag boundaries and accessibility are preserved.
- [x] Authenticated authority uses validated server IDs, item/collection revisions, positions and audits, with exact collection/scope/search and direct-detail contracts.
- [x] Awaited CRUD/idempotency/reorder/conflicts/reconciliation preserve drafts and confirmed state without silent ambiguous replay.
- [x] Session isolation and mutation invalidation prevent stale/cross-account publication throughout library, editor and Home.
- [x] Legacy Link storage is preserved and unused; backend and Dashboard API/layout authority remain outside scope.
- [x] Required static, visual/browser and real Vite/Nginx/backend acceptance passes with evidence and recovery history recorded.
- [x] Relevant documentation and Plan index reflect completion only after successful validation.
