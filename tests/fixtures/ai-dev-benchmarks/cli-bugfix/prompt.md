# Fixture Prompt: CLI JSON output bug

`node bin/spec-first.js status --json` should print valid JSON without leading human text. The current helper emits a prose prefix before the JSON payload.

Expected work:

- Add or update a targeted unit test for the JSON renderer.
- Fix the renderer without changing unrelated CLI behavior.
- Update `CHANGELOG.md`.
- Verify with the targeted Jest test, `node --check`, and `git diff --check`.
