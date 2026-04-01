---
title: Bash 3.2 Portability Pitfalls on macOS for CI-Grade Shell Scripts
date: 2026-04-01
category: docs/solutions/developer-experience
module: mcp-setup
problem_type: developer_experience
component: tooling
symptoms:
  - "unbound variable crash on empty array expansion under set -u"
  - "mapfile: command not found on macOS bash 3.2"
  - "jq error: thinking/0 is not defined when accessing hyphenated keys"
  - "mv overwrites file permissions (chmod 600 lost)"
  - "flock: command not found on macOS"
  - "JSON injection through shell variable interpolation in jq strings"
root_cause: incomplete_setup
resolution_type: code_fix
severity: medium
tags: [bash, macos, portability, shell-scripting, jq, posix]
---

# Bash 3.2 Portability Pitfalls on macOS for CI-Grade Shell Scripts

## Problem

macOS ships with Bash 3.2, which lacks features common in Bash 4.x+ (mapfile, associative arrays, proper empty array handling). Scripts developed on Linux or modern Bash environments crash or behave unexpectedly on macOS, especially under `set -euo pipefail`.

## Symptoms

- `SKIP_ARRAY[@]: unbound variable` when an array is empty under `set -u`
- `mapfile: command not found` — builtin added in Bash 4.0
- `jq: error: thinking/0 is not defined` when interpolating hyphenated keys like `sequential-thinking` into jq dot notation
- File permissions reset after `mv` — 600 becomes 0644 or default umask
- `flock: command not found` — not installed by default on macOS
- Shell variables containing quotes/special chars break JSON output when interpolated into jq string literals

## What Didn't Work

- **Initializing empty arrays as `arr=()` and using `${arr[@]}`**: Bash 3.2 treats `arr=()` as unset under `set -u`, causing unbound variable errors on expansion.
- **Using `mapfile -t arr < <(jq ...)`**: mapfile is a Bash 4.0+ builtin. macOS Bash 3.2 has no equivalent.
- **Dot notation for hyphenated keys in jq**: `jq ".mcpServers.$tool.command"` with `tool="sequential-thinking"` parses as arithmetic `thinking/0`.
- **Relying on `mv` to preserve permissions**: `mv` across filesystems (or some implementations) re-creates the file with default permissions.
- **Using `flock` for file locking**: Not available on macOS without `brew install util-linux`.

## Solution

### 1. Empty Array Expansion Under `set -u`

```bash
# Wrong (crashes on Bash 3.2 when array is empty)
printf '%s\n' "${arr[@]}" | jq -R . | jq -s .

# Correct (guarded expansion)
printf '%s\n' ${arr[@]+"${arr[@]}"} | jq -R . | jq -s .
```

The `${arr[@]+"${arr[@]}"}` pattern expands to nothing when the array is unset/empty, avoiding the unbound variable error.

### 2. Replace mapfile with while-read Loop

```bash
# Wrong (Bash 4.0+ only)
mapfile -t all_tools < <(jq -r '.tools[] | .id' "$TOOLS_JSON")

# Correct (POSIX-compatible)
all_tools=()
while IFS= read -r line; do
  all_tools+=("$line")
done < <(jq -r '.tools[] | .id' "$TOOLS_JSON")
```

### 3. jq Bracket Notation for Hyphenated Keys

```bash
# Wrong (jq parses hyphen as minus, slash as divide)
jq ".mcpServers.$tool.command" "$file"

# Correct (use --arg + bracket notation)
jq --arg t "$tool" '.mcpServers[$t].command' "$file"
```

### 4. Preserve File Permissions After mv

```bash
# Wrong (permissions may be lost)
mv "$tmp" "$target"

# Correct (chmod before mv)
chmod 600 "$tmp"
mv "$tmp" "$target"
```

### 5. mkdir-Based Locking for macOS

```bash
acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 200>"$LOCK_FILE"
    flock -w 10 200
  else
    local lock_dir="${TARGET}.lock.d"
    local attempts=0
    while ! mkdir "$lock_dir" 2>/dev/null; do
      attempts=$((attempts + 1))
      [ $attempts -ge 100 ] && { echo "Could not acquire lock" >&2; return 1; }
      sleep 0.1
    done
    LOCK_DIR="$lock_dir"
  fi
}
```

`mkdir` is atomic on POSIX filesystems — it either succeeds or fails, no race condition.

### 6. Safe JSON Construction with jq --arg

```bash
# Wrong (shell injection through version string)
echo "{\"version\": \"$version\"}"

# Correct (jq handles escaping)
jq -n --arg ver "$version" '{"version": $ver}'
```

For building command strings that embed shell variables, construct in shell first, then pass via `--arg`:

```bash
install_cmd="curl -sL https://go.dev/dl/go${ver}.\$(uname -s)-\$(uname -m).tar.gz"
jq -n --arg cmd "$install_cmd" '{install_suggestion: $cmd}'
```

## Why This Works

Bash 3.2 predates several quality-of-life features added in Bash 4.x. The root issue is that macOS licenses Bash 3.2 as the last GPLv2 version, and many developers target Bash 4+ without realizing it.

Each fix uses POSIX-compatible constructs that work across Bash versions:
- `${var+x}` parameter expansion is POSIX
- `while read` loops are POSIX
- `mkdir` atomicity is a filesystem guarantee
- `jq --arg` is the official way to pass external values into jq

## Prevention

- **Test on macOS default Bash**: Run `bash --version` to confirm 3.2; test under `set -euo pipefail`
- **Guard all array expansions**: Use `${arr[@]+"${arr[@]}"}` as a default pattern in any script using arrays under `set -u`
- **Avoid Bash 4+ builtins**: Replace `mapfile`, `readarray`, associative arrays, `|&` with POSIX equivalents
- **Use jq --arg for all external values**: Never interpolate shell variables into jq filter strings
- **Same-directory tempfile for atomic write**: `mktemp "${target}.XXXXXX"` ensures `mv` is a rename (same filesystem), which preserves permissions
- **Feature-detect, not version-detect**: Use `command -v flock` rather than parsing bash version numbers

### Test Pattern

```bash
# Test idempotency: run twice, config unchanged
before=$(jq -S . "$config")
run_install
after=$(jq -S . "$config")
[ "$before" = "$after" ] || echo "FAIL: config changed on rerun"

# Test empty-array safety: simulate missing optional args
HOME="$fake_home" bash script.sh --skip-all  # should not crash
```

## Related Issues

- `docs/solutions/logic-errors/mcp-mysql-hostname-validation-logic-flaw-2026-04-01.md` — different module, same tooling category
