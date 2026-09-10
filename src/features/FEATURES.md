# AGENTS.md

- Organize code in this directory by user-facing feature.
- Keep each feature self-contained and focused on a single domain responsibility.
- Place feature-specific components, hooks, state, and API logic inside its feature boundary.
- Do not depend on other features directly unless the dependency is intentionally shared.
- Move reusable, feature-agnostic code to `shared`.
- Feature code may depend on `shared`, but must not depend on `app`.
