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

# ---- Detect java runtime ----
java_present=false
java_reason="java-not-found"

if command -v java >/dev/null 2>&1; then
  java_present=true
  java_reason="ok"
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
  --argjson serena_configured   "$serena_configured" \
  --argjson gitnexus_configured "$gitnexus_configured" \
  --argjson context7_configured "$context7_configured" \
  --argjson java_present        "$java_present" \
  --arg     java_reason         "$java_reason" \
  '{
    "version": "1",
    "completed_at": $completed_at,
    "setup_success": true,
    "tools": {
      "abcoder":  { "installed": $abcoder_installed, "binary_ok": $abcoder_binary_ok },
      "gitnexus": { "configured": $gitnexus_configured },
      "serena":   { "configured": $serena_configured },
      "context7": { "configured": $context7_configured }
    },
    "java_runtime": { "present": $java_present, "reason": $java_reason }
  }' > "$tmp"

mv "$tmp" "$HOST_SETUP_FILE"
