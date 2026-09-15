# Environment Variables

- Reuse the existing environment-variable naming convention.
- When introducing a new environment variable, add it to both `.env` and `.env.example`.
- `.env.example` must contain only safe example or default values.
- Never place secrets, credentials, tokens, or private environment-specific values in `.env.example`.
- Application configuration should reference environment variables rather than hard-coded environment-specific values.
- When removing the final usage of an environment variable, remove the obsolete entry from `.env` and `.env.example`.
- Do not introduce environment variables for values that can remain normal application constants.