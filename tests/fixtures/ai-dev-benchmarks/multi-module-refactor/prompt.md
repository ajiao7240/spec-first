# Fixture Prompt: Multi-Module Refactor

Refactor the CLI renderer to return a stable display object with `label` and `value`.

Keep the change scoped to `packages/cli`:

- update `packages/cli/src/render.js`,
- update `packages/cli/tests/render.test.js`,
- update `CHANGELOG.md`.

Do not edit `packages/web` or `packages/shared` unless a source plan explicitly expands the scope. Sibling modules are context, not automatic change targets.
