# Plan: Graphite sidebar and Indigo workspace theme

Date: 2026-09-15.
Status: completed. User confirmed visual acceptance and completion on 2026-09-15; tests/build omitted at the user's request.

## Goal

Apply Graphite Sidebar + Warm White Workspace + Indigo Accent throughout Devspace, preserving Pretendard, spacing, layout structure and all behavior.

## Scope

- In scope: shared `tokens.css`, base/UI/content styles, every application and feature CSS file, semantic color aliases, sidebar states, focus, borders, shadows and radii.
- Out of scope: HTML/JS changes, API/session/store behavior, dependency changes, typography/spacing redesign and backend work.

## Changes

1. Define the requested palette and semantic surface, text, feedback, focus and sidebar tokens in `src/shared/styles/tokens.css` (the repository's actual token filename).
2. Replace CSS color literals outside tokens with semantic references. Keep success/warning indicators at the requested colors and use readable darker text companions on light surfaces.
3. Apply Graphite sidebar descendants and mobile navigation; neutralize decorative purple surfaces while keeping Indigo for primary, selected and focus states. Use 10-12px card/modal radii, existing small control radii and nearly no shadows.
4. Audit every CSS file and unchanged layout declarations; validate within the user's approved validation scope and record evidence.

## Validation

### Static

- Inspect all CSS declarations for remaining literal colors, undefined custom properties and unintentional layout changes.
- The user explicitly confirmed skipping tests/build. Use source inspection and user visual review; do not run validation commands that override that instruction.

### Runtime

- Review login, Home, Projects/list/detail, Tasks, Journals, Library, forms/modals and desktop/mobile/landscape sidebar states.
- The user declined tests/build. Final visual review is performed in the user's already-authenticated browser; do not claim automated or agent-authenticated runtime validation.
- No real business data mutations. Theme-only changes do not require backend contract acceptance.

## Completion Criteria

- [x] Planned CSS-only changes are implemented.
- [x] Source CSS parsing/token inspection passes; tests/build are omitted at the user's explicit request.
- [x] User confirmed visual acceptance and requested completion; automated runtime validation is not claimed.
- [x] Plan index and theme documentation are current.

## Execution Record

Registered as proposed, then activated under the user's explicit creation-and-immediate-execution request. The user subsequently confirmed that tests/build should be skipped.

### Implementation

- Rebuilt the existing `tokens.css` palette around the supplied values; retained compatibility aliases for green/amber/blue consumers and added readable status text, overlay, progress and sidebar tokens.
- Audited all 16 CSS files and replaced literal colors outside the token sheet. Removed gradients and box shadows, tokenized card/control radii, and neutralized decorative purple backgrounds.
- Sidebar surface/text/border aliases are scoped locally, with explicit dark active/hover/avatar/badge/profile/mobile-close and focus styles. White workspace, login, modal and content-panel surfaces remain independent.
- Updated the current architecture style section. No HTML/JS, font asset, API, session or data changes were made in this task.

### Inspection and pending review

- Parsed all 16 stylesheets with the already-installed PostCSS parser: 1,328 declarations; zero literal colors outside `tokens.css`; zero unresolved CSS custom-property references.
- Source edits preserve layout/spacing properties. Color, background, border-color, shadow, radius and focus/scrollbar presentation are the intended changes.
- No test suites, screenshot scripts or build were run. The user explicitly answered that tests/build should be skipped.
- Authenticated visual inspection is not claimed: the available separate browser cannot use the user's existing Google session. Review in the user's running frontend is outstanding. Keep this Plan active until the applicable final validation/review gate is resolved.

### Resumed execution

- Re-inspected the current CSS on the user's request to execute PLAN-0015 first. Its implementation is already present; no duplicate theme rewrite is necessary.
- Source search again found no literal CSS colors outside `tokens.css`. All box shadows use shared tokens; the only remaining gradient is the explicitly requested login background token.
- Preserve subsequent user-requested refinements: softer blue-gray Graphite, 10-12px controls/cards, Indigo branding, compact login spacing, subtle login-only border/shadow/gradient, reduced Home hero spacing and subdued workspace switch. These override the initial blanket gradient/shadow removal without changing application behavior.
- Updated current architecture and index to remove obsolete validation-authorization wording. PLAN-0016 remains proposed and unstarted.
- Only user visual acceptance remains before completion. Neither this execution request nor skipping tests is treated as proof of visual acceptance.

### Closeout

The user subsequently explicitly confirmed completion and requested execution of PLAN-0016. This satisfies the user-review gate. Marked completed; no automated test/build or agent-authenticated visual pass is claimed.
