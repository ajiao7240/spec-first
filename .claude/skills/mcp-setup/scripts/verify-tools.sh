#!/bin/bash
# verify-tools.sh - Verify host-level tool installation state after mcp-setup
# Writes ~/.claude/spec-first/host-setup.json as the host readiness marker
# Used by spec-bootstrap Host Readiness Gate

set -euo pipefail

CLAUDE_JSON="${HOME}/.claude.json"
HOST_SETUP_DIR="${HOME}/.claude/spec-first"
HOST_SETUP_FILE="${HOST_SETUP_DIR}/host-setup.json"

# ---- Detect abcoder ----
abcoder_installed=false
abcoder_binary_ok=false

if command -v abcoder >/dev/null 2>&1; then
  abcoder_installed=true
  if abcoder version >/dev/null 2>&1; then
    abcoder_binary_ok=true
  fi
fi

# ---- Detect MCP config presence ----
# Returns "true" or "false" (string, compatible with --argjson boolean parsing)
check_mcp_configured() {
  local tool="$1"
  if [ ! -f "$CLAUDE_JSON" ]; then
    echo "false"
    return
  fi
  if jq -e --arg t "$tool" '.mcpServers[$t]' "$CLAUDE_JSON" >/dev/null 2>&1; then
    echo "true"
  else
    echo "false"
  fi
}

serena_configured=$(check_mcp_configured "serena")
gitnexus_configured=$(check_mcp_configured "gitnexus")
context7_configured=$(check_mcp_configured "context7")
sequential_thinking_configured=$(check_mcp_configured "sequential-thinking")
abcoder_configured=$(check_mcp_configured "abcoder")

# ---- Detect java runtime ----
java_present=false
java_reason="java-not-found"

if command -v java >/dev/null 2>&1; then
  java_present=true
  java_reason="ok"
fi

# ---- Detect language runtimes ----

# Go
go_present=false
go_reason="go-not-found"
go_version=""
if command -v go >/dev/null 2>&1; then
  go_present=true
  go_reason="ok"
  go_version=$(go version 2>/dev/null | awk '{print $3}' || echo "unknown")
fi

# Python
python_present=false
python_reason="python-not-found"
python_version=""
if command -v python3 >/dev/null 2>&1; then
  python_present=true
  python_reason="ok"
  python_version=$(python3 --version 2>/dev/null | awk '{print $2}' || echo "unknown")
elif command -v python >/dev/null 2>&1; then
  python_present=true
  python_reason="ok"
  python_version=$(python --version 2>/dev/null | awk '{print $2}' || echo "unknown")
fi

# JDT cache writability (only when abcoder is installed + Java present)
jdt_cache_writable=false
jdt_cache_path=""
jdt_cache_reason="not-applicable"

if [ "$abcoder_installed" = "true" ] && [ "$java_present" = "true" ]; then
  # ABCoder stores JDT under Go module cache; path: $GOMODCACHE/github.com/cloudwego/abcoder@<ver>/lang/java/lsp/jdtls
  # Note: Go module cache uses nested dirs (github.com/cloudwego/abcoder@ver), not a flat name — use ls -d glob, not find -name
  if command -v go >/dev/null 2>&1; then
    gomodcache=$(go env GOMODCACHE 2>/dev/null || echo "")
    if [ -n "$gomodcache" ]; then
      abcoder_dir=$(ls -d "$gomodcache/github.com/cloudwego/abcoder@"* 2>/dev/null | head -1 || true)
      if [ -n "$abcoder_dir" ]; then
        jdt_cache_path="${abcoder_dir}/lang/java/lsp/jdtls"
        jdt_cache_reason="dir-exists"
        if [ -d "$jdt_cache_path" ]; then
          if [ -w "$jdt_cache_path" ]; then
            jdt_cache_writable=true
            jdt_cache_reason="writable"
          else
            jdt_cache_reason="not-writable"
          fi
        else
          # jdtls dir not yet created — check if parent is writable
          parent_dir="${abcoder_dir}/lang/java/lsp"
          if [ -d "$parent_dir" ] && [ -w "$parent_dir" ]; then
            jdt_cache_writable=true
            jdt_cache_reason="parent-writable"
          elif [ ! -d "$parent_dir" ]; then
            pop="${abcoder_dir}/lang/java"
            if [ -d "$pop" ] && [ -w "$pop" ]; then
              jdt_cache_writable=true
              jdt_cache_reason="ancestors-writable"
            else
              jdt_cache_reason="ancestor-not-writable"
            fi
          else
            jdt_cache_reason="parent-not-writable"
          fi
        fi
      else
        jdt_cache_reason="abcoder-not-in-modcache"
      fi
    else
      jdt_cache_reason="gomodcache-not-found"
    fi
  else
    jdt_cache_reason="go-not-available"
  fi
fi

# setup_success means the baseline host-level prerequisites for bootstrap are ready.
# Serena is mandatory; ABCoder and GitNexus are best-effort enhancements and do not block completion.
setup_success=false
if [ "$serena_configured" = "true" ] \
  && [ "$context7_configured" = "true" ] \
  && [ "$sequential_thinking_configured" = "true" ]; then
  setup_success=true
fi

# ---- Write host-setup.json ----
if ! mkdir -p "$HOST_SETUP_DIR" 2>/dev/null; then
  echo "verify-tools.sh: 无法创建目录 ${HOST_SETUP_DIR}" >&2
  exit 1
fi

if [ ! -w "$HOST_SETUP_DIR" ]; then
  echo "verify-tools.sh: 无法写入 ${HOST_SETUP_DIR}" >&2
  exit 1
fi

completed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Atomic write: mktemp in same dir → chmod 600 → build JSON → mv
# (chmod before mv so permissions are set before the file is visible at its final path)
tmp=$(mktemp "${HOST_SETUP_DIR}/host-setup.XXXXXX")
chmod 600 "$tmp"

jq -n \
  --arg     completed_at        "$completed_at" \
  --argjson abcoder_installed   "$abcoder_installed" \
  --argjson abcoder_binary_ok   "$abcoder_binary_ok" \
  --argjson abcoder_configured  "$abcoder_configured" \
  --argjson serena_configured   "$serena_configured" \
  --argjson gitnexus_configured "$gitnexus_configured" \
  --argjson context7_configured "$context7_configured" \
  --argjson sequential_thinking_configured "$sequential_thinking_configured" \
  --argjson setup_success       "$setup_success" \
  --argjson java_present        "$java_present" \
  --arg     java_reason         "$java_reason" \
  --argjson go_present          "$go_present" \
  --arg     go_reason           "$go_reason" \
  --arg     go_version          "$go_version" \
  --argjson python_present      "$python_present" \
  --arg     python_reason       "$python_reason" \
  --arg     python_version      "$python_version" \
  --argjson jdt_cache_writable  "$jdt_cache_writable" \
  --arg     jdt_cache_path      "$jdt_cache_path" \
  --arg     jdt_cache_reason    "$jdt_cache_reason" \
  '{
    "version": "2",
    "completed_at": $completed_at,
    "setup_success": $setup_success,
    "tools": {
      "abcoder":  { "installed": $abcoder_installed, "binary_ok": $abcoder_binary_ok, "configured": $abcoder_configured },
      "gitnexus": { "configured": $gitnexus_configured },
      "serena":   { "configured": $serena_configured },
      "context7": { "configured": $context7_configured },
      "sequential-thinking": { "configured": $sequential_thinking_configured }
    },
    "java_runtime": { "present": $java_present, "reason": $java_reason },
    "language_runtime": {
      "go":     { "present": $go_present,     "reason": $go_reason,     "version": $go_version },
      "python": { "present": $python_present, "reason": $python_reason, "version": $python_version }
    },
    "jdt_cache": { "writable": $jdt_cache_writable, "path": $jdt_cache_path, "reason": $jdt_cache_reason }
  }' > "$tmp"

mv "$tmp" "$HOST_SETUP_FILE"
