# IDE detection for browser handoff

Polish attempts to hand the running dev-server URL off to a supported host's browser surface so the user can test without a context switch. Detection is best-effort — failure falls through to printing the URL in the interactive summary.

## Detection order

Probe environment variables in this order and stop at the first positive match. Earlier entries are more specific; later entries are general fallbacks.

| Order | Signal | IDE | Handoff method |
|-------|--------|-----|----------------|
| 1 | `CLAUDE_CODE` env var set (any value) | Claude Code desktop | Print `claude-code://browser?url=http://localhost:<port>` as a clickable hint; Claude Code's desktop app intercepts `claude-code://` URLs. |
| 2 | Codex or any non-Claude terminal context | Terminal | Print the URL. No unsupported IDE handoff attempt. |

## Why env-var probe, not a fancier approach

- Env vars are cross-platform (macOS, Linux, Windows/WSL)
- They fail open — if a probe returns nothing, polish still works
- They don't require any IDE API or socket connection
- They encode "is this shell running inside a supported host" without guessing

## Codex

Codex does not expose an embedded-browser handoff. Polish falls through to the terminal branch and prints the URL.

## Detection failure is never fatal

If environment probing fails or returns ambiguous results, polish prints the URL verbatim and continues. The dev server is already running by this point — the user can always copy-paste the URL into any browser. The IDE handoff is a convenience, not a gate.

## Probe pattern (reference)

The skill consumes these probes inline rather than via a shell script (no state, no parsing, one-shot reads). Typical usage:

```
if [ -n "${CLAUDE_CODE:-}" ]; then
  IDE="claude-code"
else
  IDE="none"
fi
```

Never chain probes with `||` between different variables — a missing env var must resolve to "no signal", not "error". The `${VAR:-}` default-to-empty pattern is mandatory under `set -u`.
