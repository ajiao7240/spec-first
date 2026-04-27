#!/bin/bash
# Shared Codex TOML helpers for MCP server sections.

set -euo pipefail

toml_table_key() {
  local key="$1"
  if printf '%s' "$key" | grep -Eq '^[A-Za-z0-9_]+$'; then
    printf 'mcp_servers.%s' "$key"
  else
    local escaped="${key//\"/\\\"}"
    printf 'mcp_servers."%s"' "$escaped"
  fi
}

toml_legacy_table_key() {
  local key="$1"
  printf 'mcp_servers.%s' "$key"
}

extract_toml_mcp_section() {
  local config_path="$1"
  local key="$2"
  [ -f "$config_path" ] || return 0

  python3 - "$config_path" "$key" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
text = path.read_text(encoding="utf-8") if path.exists() else ""
headers = [
    f"mcp_servers.{key}",
    'mcp_servers."' + key.replace('"', '\\"') + '"',
]

for header in headers:
    pattern = rf'(?ms)^\[{re.escape(header)}\]\r?\n(.*?)(?=^\[mcp_servers\.|\Z)'
    match = re.search(pattern, text)
    if match:
        sys.stdout.write(match.group(1).strip())
        if match.group(1).strip():
            sys.stdout.write("\n")
        break
PY
}

remove_toml_mcp_section() {
  local config_path="$1"
  local key="$2"
  local tmp="$3"

  python3 - "$config_path" "$key" "$tmp" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
out = Path(sys.argv[3])
text = path.read_text(encoding="utf-8") if path.exists() else ""
headers = [
    f"mcp_servers.{key}",
    'mcp_servers."' + key.replace('"', '\\"') + '"',
]

for header in headers:
    pattern = rf'(?ms)^\[{re.escape(header)}\]\r?\n.*?(?=^\[mcp_servers\.|\Z)'
    text = re.sub(pattern, "", text)

text = re.sub(r'\n{3,}', '\n\n', text).strip()
out.write_text((text + "\n") if text else "", encoding="utf-8")
PY
}

write_toml_mcp_section() {
  local config_path="$1"
  local key="$2"
  local section_body="$3"
  local tmp="$4"

  local table_key
  table_key="$(toml_table_key "$key")"
  local remove_tmp
  remove_tmp="$(mktemp "${TMPDIR:-/tmp}/spec-mcp-toml.XXXXXX")"
  remove_toml_mcp_section "$config_path" "$key" "$remove_tmp"

  {
    if [ -s "$remove_tmp" ]; then
      cat "$remove_tmp"
      printf '\n'
    fi
    printf '[%s]\n%s\n' "$table_key" "$section_body"
  } > "$tmp"

  rm -f "$remove_tmp"
}
