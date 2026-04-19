---
title: Bash 3.2 Portability Pitfalls on macOS for CI-Grade Shell Scripts
date: 2026-04-01
last_updated: 2026-04-19
category: developer-experience
module: spec-mcp-setup
problem_type: developer_experience
component: tooling
severity: medium
applies_when:
  - "在 macOS 默认 Bash 3.2 上编写或维护 CI 级 shell 脚本"
  - "脚本启用 set -euo pipefail 且依赖 jq、原子写入或文件锁"
tags: [bash, macos, portability, shell-scripting, jq, posix]
---

# Bash 3.2 Portability Pitfalls on macOS for CI-Grade Shell Scripts

## Context

macOS 自带 Bash 3.2，缺少很多 Linux / Bash 4.x+ 环境里常见的能力，例如 `mapfile`、更稳定的空数组处理，以及团队默认会依赖的一些 shell 习惯。脚本如果只在现代 Bash 环境里验证，很容易在 macOS 上出现不兼容问题。

## Guidance

把 shell 脚本默认按 Bash 3.2 / POSIX 兼容面来写，尤其在 `set -euo pipefail`、`jq`、原子写入和锁语义上提前规避不兼容点。

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

## Why This Matters

Bash 3.2 不是边缘环境，而是 macOS 的默认现实。团队如果把“能在我机器上跑”默认等同于“能在 macOS 上跑”，就会在 `set -u`、`jq` 键访问、文件锁和权限保留这些细节上反复踩坑。

Each fix uses POSIX-compatible constructs that work across Bash versions:
- `${var+x}` parameter expansion is POSIX
- `while read` loops are POSIX
- `mkdir` atomicity is a filesystem guarantee
- `jq --arg` is the official way to pass external values into jq

## When to Apply

- 需要支持 macOS 开发机、本地 CI、或任何默认 Bash 3.2 环境时
- shell 脚本依赖数组、`jq`、文件锁、临时文件重命名、或 JSON 构造时
- 评审 shell 代码时，发现脚本明显假设 Bash 4.x+ 能力时

## Examples

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

## Related

- `docs/solutions/documentation-gaps/spec-graph-bootstrap-mysql-consistency-precheck-contract-2026-04-19.md` — different module, same tooling category
