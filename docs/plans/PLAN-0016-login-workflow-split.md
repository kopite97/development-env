# Plan: Split login and interactive development workflow

Date: 2026-09-15.
Status: rejected (superseded). The implemented split is retained; the approved PLAN-0017 replaces its interaction/theme direction and carries the remaining visual validation. This is not a claim that the outstanding validation passed.

## Goal

Recompose the public login screen into a 58% workflow / 42% login split at desktop sizes. Preserve the current Graphite + Light Workspace + Indigo system and all authentication behavior. The left side is an interactive illustration of development stages, not a real pipeline or a new application feature.

## Scope

- In scope: public login composition, isolated pointer/focus presentation state, workflow assets and tooltips, scoped CSS/tokens, mobile fallback and reduced-motion support.
- Out of scope: authenticated pages/sidebar/layout, OAuth providers/endpoints, session/bootstrap/returnTo logic, login guards, retries, persistence, backend calls, production pipelines and additional login-page navigation.
- Preserve the user's no-test/no-build instruction unless explicitly superseded. This planning task does not execute tests or change application files.

## Changes

### Current implementation and boundaries

`src/app/auth/AuthApp.tsx` currently renders an `.auth-login-shell` containing a centered, maximum-400px `.auth-login-panel`. The panel includes a non-link `devspace.` brand, Indigo square `CodeXml` icon, state-specific instructions/errors and the existing Google button. `auth.css` owns the public layout; `tokens.css` owns its faint radial background, border and shadow. Authenticated rendering returns separately before this public branch.

Keep `AuthSession`, `handleLogin`, `consumeLoginError`, `loginUrl`, session effects and authenticated rendering unchanged. Move only public presentation into the split. Checking, account-disabled and bootstrap-error states still occupy the right-hand area with their existing messages/roles. Do not suppress errors to meet the minimal normal-login appearance, add another retry control, or make the logo clickable.

### Files to change

| File | Planned responsibility |
| --- | --- |
| `src/app/auth/AuthApp.tsx` | Compose the new workflow left of the existing public login panel. Preserve every auth branch, callback, disabled state, error and accessible heading. No workflow state in AuthSession. |
| `src/app/auth/LoginWorkflow.tsx` (new) | Render the four-stage horizontal line, active node, one visible icon group and accessible tooltips. Own only temporary preview state and node references. No router, API, storage or feature stores. |
| `src/app/auth/loginWorkflowModel.ts` (new) | Typed static stage IDs/labels/technology asset references and pure nearest-stage selection. Keep it auth-presentation-local rather than creating a shared business abstraction. |
| `src/app/auth/login-workflow.css` (new) | Left-region sizing, line/node states, reserved icon lane, tooltips, bounded fade/scale and reduced-motion rules. Import from the workflow component. |
| `src/app/auth/assets/workflow/` (new) | Locally served approved technology brand icons, with an asset attribution/license record. No hotlinked icons, runtime logo package or generated fake logos. |
| `src/app/auth/auth.css` | Replace centered-shell layout with the 58/42 grid. Make the right region static/light, separated by a 1px border; reuse the compact login content without nesting another decorative card. Mobile right region fills the viewport width. Preserve shared auth/session-control rules outside the public shell. |
| `src/shared/styles/tokens.css` | Reuse surface, border, Indigo, muted text and radius tokens; add only a narrowly named workflow-background token if the existing soft palette cannot express the faint Lavender surface. No broad theme retuning. |
| `docs/architecture/frontend.md` | After implementation, document public presentation ownership, static workflow nature, responsive and motion boundaries. |

### Layout and visual composition

- Desktop proposal: at viewport widths >= 1024px, use `minmax(0, 58fr) minmax(0, 42fr)` grid tracks with no gap. The divider belongs to the right section and is included in sizing. Use a full-viewport minimum height, not a fixed height that clips landscape/error content.
- Left: faint Indigo/Lavender surface, vertically centered horizontal `Commit -> Build -> Test -> Deploy` presentation. No marketing hero, fake logs, counters, decorative floating objects or real build status. A connecting line and four stable-size nodes establish sequence.
- Right: static white/light surface, compact centered `devspace.` brand and existing instructions/Google button. Remove the standalone card's shadow/border in this composition so the section divider supplies separation. No animated right-side backgrounds, transforms or hover-driven layout changes.
- The existing login background token must not tint the whole split: scope Lavender to the left and keep the right static. The icon/brand remain Indigo and non-navigable; retain Pretendard and existing control design.
- Below 1024px, including mobile landscape, hide the workflow and give login 100% width. Do not leave a divider, blank column or reserved icon space. On desktop-sized touch devices, stage focus/selection provides the preview without requiring hover.

### Workflow state and geometry

1. Default to Commit. Keep the selected stage stable on pointer leave; do not run an automatic carousel or simulate pipeline execution.
2. Listen only inside the left region. For pointer movement, compare the pointer position with the four actual node centers in the same coordinate space and select the nearest center. Do not use viewport-wide mouse handlers or infer geometry from fixed pixel percentages.
3. Update React state only when the closest stage changes. Pointer samples may be coalesced with one requestAnimationFrame; cancel queued work on unmount/hide. Re-measure after responsive resizing, scrolling or font/layout changes as needed; use a local ResizeObserver for cached geometry if warranted.
4. Equal distances retain the current stage when it is one of the tied candidates; otherwise use visual order. Keep all node and icon-lane dimensions stable when active state changes.
5. Stage focus and desktop-touch activation select the same temporary preview. These controls do not navigate, log in, send data or persist state. The normal right-hand login button remains the only authentication action.

### Technology groups and positioning

| Stage | Assets |
| --- | --- |
| Commit | Git, GitHub, GitLab |
| Build | Docker, Gradle, Maven, npm |
| Test | JUnit, Jest, Playwright |
| Deploy | AWS, Kubernetes, Vercel |

- Source recognizable icons from official or appropriately licensed distributions during implementation; record actual source/license and do not assume permission for an arbitrary asset. Reuse a repository asset if already suitable. Keep official logo colors where required, without coloring surrounding cards/panels by brand.
- Render the current group's 3-4 icons only, with uniform 28-32px visual boxes and a stable maximum group width. Brand aspect ratios use contain fitting rather than stretching.
- Anchor each group to its active node center using the node/stage container, not to the page or right panel. Target the icon group's top edge 48px below the node's bottom edge, within the requested 40-60px range.
- Reserve an icon lane below the workflow line so icons never move the workflow or login content. Reserve enough left/right gutters for half the widest group plus tooltip padding; the first and last groups must remain truly centered on their nodes, not visually shifted by emergency clamping.
- The left region establishes a stacking/overflow boundary. Do not portal tooltips to the document body. Provide enough internal space above icons for tooltips so clipping is a fallback, not the normal presentation.
- On stage changes, remove the previous visible group before revealing the next. Use a short 160-200ms entrance from translateY(5px), scale(0.97), opacity 0 to the resting position. No idle animation, continuous particle effects or simultaneous old/new groups.
- Technology names appear in small tooltips directly above icons on hover and keyboard focus. Visible tooltips remain hoverable and can be dismissed with Escape; no external links or click actions are attached to technology icons.

### Accessibility and motion

- Represent stages as a labelled group of presentation-selection buttons with `type="button"` and `aria-pressed`; use existing focus styling. Tab/focus and Enter/Space provide a pointer-independent path. Their only effect is local visual selection; no new business functionality is introduced.
- Technology tooltip triggers have accessible names and focus treatment without pretending to be navigation links. Mark redundant icon artwork decorative and associate tooltip text when helpful. Do not announce every pointer movement through a live region.
- `prefers-reduced-motion: reduce` disables transitions/entrance animations entirely; stage and icon updates are immediate. Keep pointer/focus selection usable, without scale or translation.
- Hidden mobile workflow must have no tab stops or active pointer/resize/animation work. Use CSS for initial hidden layout and media-query-aware mounting/enabling for its interactive portion; clean up listeners without touching authentication lifetime.
- Protect login input/button accessibility, error/status roles, natural scrolling and focus visibility at short heights and increased text zoom. Never allow the left side to intercept right-panel pointer events.

### Implementation order

1. Confirm approval and resolve execution tracking: PLAN-0015 is currently active with visual review outstanding. Do not activate two Plans or mark PLAN-0015 complete without its required review. Record the user's chosen status resolution before activating this Plan.
2. Inspect applicable source rules and available assets. Establish the stage/asset model and attribution records; no new dependencies by default.
3. Implement static 58/42 public composition and mobile login-only fallback, preserving all auth branches. Check size/overflow before adding motion.
4. Implement node-based nearest-stage selection and keyboard/touch presentation alternatives inside the workflow boundary.
5. Add centered icon groups, reserved gutters/lane, tooltips and bounded animation/reduced-motion handling.
6. Review all public states and viewport sizes within the approved validation mode. Correct layout/focus issues, update current architecture/evidence, and complete only after the required review passes.

## Validation

### Static

- Review the diff for unchanged session/login/returnTo behavior and zero authenticated-route changes. Check local icon references/licenses, existing token usage and scoped selectors.
- Review stable geometry, event cleanup, mobile unmount/disable and reduced-motion branches.
- The user's current instruction excludes tests/build. Do not add test files, screenshot scripts, a new Playwright config or runner under this Plan unless separately authorized. If authorization changes, use existing auth/browser infrastructure and add nearest-node/viewport/motion coverage there, rather than inventing a feature runner.

### Runtime

- Directly review the running local **public** login page; do not attempt automated Google sign-in or bypass provider restrictions. If direct browser access is unavailable, obtain user visual feedback and explicitly record the gap.
- Desktop 1440x1000 and 1280x800: 58/42 split, fixed workflow sequence, first/last node centering, all four technology groups, correct tooltip placement and no right-panel overlap.
- Boundary widths 1023/1024, mobile 390x844 and landscape 844x390: login-only below the breakpoint, no horizontal overflow or hidden focus targets. Resizing must not leave stale node coordinates.
- Move quickly between stages and across node boundaries; only one icon group is visible. Pointer leave/right-panel movement must not change login content or trigger navigation. Confirm Commit initialization and stable leave behavior.
- Check keyboard stage selection, tooltip focus/Escape/hover behavior, touch-capable desktop use, reduced motion and text zoom. Check that no animation affects login content.
- Preserve checking, login-failed, account-disabled, network/bootstrap-error and login-pending rendering; do not create real account failures or mutate business data just for visual inspection. States unavailable under direct review are recorded as unverified unless separate validation is authorized.

## Completion Criteria

- [x] File-scoped presentation changes are implemented with unchanged authentication/business behavior.
- [ ] Desktop 58/42 and mobile login-only layouts meet the specified bounds.
- [ ] Nearest-stage selection, exclusive icon groups, tooltips and reduced-motion behavior are reviewed.
- [x] Assets are locally available with recorded provenance; no hidden external resource dependency is added.
- [ ] Required source and direct/user runtime reviews pass; unavailable states are disclosed and resolved before claiming full validation.
- [x] Current architecture and Plan index reflect the actual outcome.

## Execution Record

Created as proposed for planning only. No runtime source, asset or authentication changes were made. No tests/build were run. PLAN-0015 remains active and unchanged.

### 2026-09-15 implementation

- User accepted PLAN-0015 completion and approved PLAN-0016 execution. PLAN-0015 is completed; this Plan is active pending final visual acceptance.
- Implemented isolated workflow composition, nearest measured-node selection, keyboard/touch selection, exclusive local technology groups, tooltips and reduced-motion behavior. While inspecting a technology group, pointer selection is held so tooltip targets remain mounted.
- Downloaded all 13 unchanged SVG assets and MIT license from Devicon v2.17.0; recorded provenance beside assets. No dependency added.
- Direct inspection of the running public localhost frontend through browser DOM/geometry (no test runner, screenshots or build): 1440x1000, 1280x800, 1024x800, 1023x800, 390x844 and 844x390 had no horizontal overflow. At 1024px grid tracks were 593.906px / 430.078px. Below 1024px the workflow unmounted after the media-query update.
- Pointer selection at all four desktop stages showed exactly one group and all 13 local images loaded. Build keyboard focus selected its group. Reduced-motion computed animation was `none`.
- Moved labels above nodes during source review to avoid the tooltip lane overlapping stage labels. Formatting was applied only to the three new source files; tests/build were not run.
- AuthSession, login handlers, routes, API stores and authenticated composition were not changed. Existing public checking/error/disabled/pending JSX branches are retained.
- Remaining review: user visual acceptance, tooltip hover/Escape and touch/text-zoom usability, and public states not safely available in direct inspection. No automated Google login or deliberate account failure was attempted. Do not treat DOM geometry inspection as screenshot-based visual validation or mark this Plan completed before the remaining review is resolved.
