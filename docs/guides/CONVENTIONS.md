# Conventions

- Follow existing project conventions before introducing a new pattern.
- Match the naming, file structure, imports, and organization of surrounding code.
- Keep changes scoped to the requested task.
- Avoid unrelated refactoring.
- Reuse existing components, stores, utilities, types, and patterns when appropriate.
- Do not create duplicate abstractions for behavior already represented in the project.
- Prefer precise domain names over generic names such as `data`, `item`, `manager`, or `helper`.
- Keep feature-specific code inside its feature boundary.
- Move code to `shared` only when it is genuinely feature-agnostic.
- Preserve existing API DTO, draft/view model, store, and presentation boundaries.
- Do not introduce a new dependency when the existing stack can reasonably solve the requirement.
- Preserve existing UI and behavior unless the task explicitly requires a change.
- Do not modify generated files or build artifacts unless explicitly required.