# Codex Custom Subagents

This folder defines project-local Codex custom subagents.

Files use markdown with YAML frontmatter:

- `name`
- `description`
- `tools`

Available subagents:

- `ui-implementation`
- `ui-unit-tests`
- `backend-implementation`
- `backend-unit-tests`

Expected flow:

1. Delegate implementation to UI/backend implementation agents.
2. Delegate tests to UI/backend test agents.
3. Enforce stop-time checks using `.codex/hooks/*`.
4. Validate integration scope using the relevant skill strict validator.
